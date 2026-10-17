import { Hono } from "hono";
import { backgroundFailure } from "../log.ts";
import type { ConversationStream, StreamAttachment, StreamEnvelope } from "./stream.ts";

const HEARTBEAT_MS = 15_000;
const MAX_BUFFERED_BYTES = 2 * 1024 * 1024;
const RETRY_MS = 3_000;

export interface ConversationStreamRouteOptions {
  heartbeatMs?: number;
  maxBufferedBytes?: number;
  retryMs?: number;
}

function frame(event: string, data: unknown, id?: string) {
  return `${id === undefined ? "" : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Standard SSE endpoint for one conversation thread.
 *
 * `GET /api/conversation/stream/:threadId`
 *   Last-Event-ID: <seq>       (or ?after=<seq>)
 *
 * A fresh connection with no cursor follows the run that is active right now. A
 * reconnecting client sends the last id it applied and receives exactly the gap.
 */
export function conversationStreamRoutes(
  stream: ConversationStream,
  options: ConversationStreamRouteOptions = {},
) {
  const app = new Hono<{ Variables: { owner: string } }>();
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;
  const maxBufferedBytes = options.maxBufferedBytes ?? MAX_BUFFERED_BYTES;
  const retryMs = options.retryMs ?? RETRY_MS;

  app.get("/:threadId", async (c) => {
    const owner = c.get("owner");
    const threadId = c.req.param("threadId");
    const raw = c.req.header("last-event-id") ?? c.req.query("after");
    const after = raw === undefined || raw === "" ? null : Number(raw);
    const encoder = new TextEncoder();
    let attachment: StreamAttachment | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;

    return new Response(
      // A byte stream makes `desiredSize` count queued bytes. A default stream counts
      // chunks, so the threshold below would never trigger for realistic SSE traffic.
      new ReadableStream<Uint8Array>({
        type: "bytes",
        start(controller) {
          const cleanup = () => {
            if (closed) return;
            closed = true;
            if (heartbeat) clearInterval(heartbeat);
            heartbeat = undefined;
            attachment?.unsubscribe();
            attachment = undefined;
            c.req.raw.signal.removeEventListener("abort", cleanup);
          };
          const send = (chunk: string) => {
            if (closed) return false;
            try {
              // A client that stops reading is dropped instead of growing server memory.
              // Its next request carries Last-Event-ID and catches up from the ledger.
              if (controller.desiredSize !== null && controller.desiredSize < -maxBufferedBytes) {
                cleanup();
                controller.close();
                return false;
              }
              controller.enqueue(encoder.encode(chunk));
              return true;
            } catch (error) {
              cleanup();
              backgroundFailure("conversation.stream.write", error);
              return false;
            }
          };
          const sendEvent = (envelope: StreamEnvelope) => {
            send(frame("agui", envelope, String(envelope.seq)));
          };
          const abort = () => {
            cleanup();
            try {
              controller.close();
            } catch {
              // The consumer may already have cancelled the stream.
            }
          };
          c.req.raw.signal.addEventListener("abort", abort, { once: true });

          // Tell EventSource-compatible clients and our fetch reader that reconnects
          // should start after a short delay; the app adds jitter and exponential backoff.
          send(`retry: ${retryMs}\n\n`);
          void stream
            .attach(owner, threadId, after, {
              onReady(status, reset, replayFrom) {
                send(
                  frame("ready", {
                    protocol: 1,
                    reset,
                    replayFrom,
                    ...status,
                  }),
                );
              },
              onEvent: sendEvent,
            })
            .then((attached) => {
              if (closed) {
                attached.unsubscribe();
                return;
              }
              attachment = attached;
              heartbeat = setInterval(() => {
                // Comment frames keep proxies and the client watchdog from treating an
                // idle-but-healthy stream as a dead connection.
                send(`: heartbeat ${Date.now()}\n\n`);
              }, heartbeatMs);
              heartbeat.unref?.();
            })
            .catch((error) => {
              backgroundFailure("conversation.stream.attach", error);
              send(frame("stream_error", { message: "The live reply channel is unavailable." }));
              abort();
            });
        },
        cancel() {
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          attachment?.unsubscribe();
          attachment = undefined;
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          // Nginx and similar reverse proxies buffer by default; this keeps chunks live.
          "X-Accel-Buffering": "no",
        },
      },
    );
  });

  return app;
}
