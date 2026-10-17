import { useCallback, useEffect, useRef, useState } from "react";
import type { LingTaiApi } from "./api";
import { createSseParser, type SseMessage } from "./sse";

export interface StreamRun {
  runId: string;
  status: "running" | "finished" | "error";
  startedAt: string;
  updatedAt: string;
}

export interface StreamEnvelope {
  threadId: string;
  seq: number;
  ts: string;
  runId: string;
  event: {
    type: string;
    messageId?: string;
    delta?: string;
    message?: string;
    code?: string;
    [key: string]: unknown;
  };
}

export interface ReadyPayload {
  protocol: number;
  threadId: string;
  reset: boolean;
  replayFrom: number;
  active: boolean;
  lastEventId: number;
  oldestEventId: number;
  eventCount: number;
  run: StreamRun | null;
}

export interface ConversationDraft {
  id: string;
  text: string;
  done: boolean;
  runId: string;
  seq: number;
  updatedAt: number;
}

export type StreamPhase = "idle" | "connecting" | "live" | "reconnecting" | "error";

export interface ConversationStreamState {
  phase: StreamPhase;
  lastEventId: number | null;
  activeRunId: string | null;
  drafts: Record<string, ConversationDraft>;
  order: string[];
  error?: string;
  /** A sequence gap was observed; the hook must reconnect and let the server replay. */
  resync: boolean;
  gaps: number;
  applied: number;
}

export function initialStreamState(): ConversationStreamState {
  return {
    phase: "idle",
    lastEventId: null,
    activeRunId: null,
    drafts: {},
    order: [],
    resync: false,
    gaps: 0,
    applied: 0,
  };
}

function addDraft(
  state: ConversationStreamState,
  envelope: StreamEnvelope,
  id: string,
  delta: string,
  done = false,
): ConversationStreamState {
  const previous = state.drafts[id];
  const next: ConversationDraft = {
    id,
    text: (previous?.text ?? "") + delta,
    done: done || previous?.done || false,
    runId: envelope.runId,
    seq: envelope.seq,
    updatedAt: Date.now(),
  };
  const order = previous ? state.order : [...state.order, id];
  const drafts = { ...state.drafts, [id]: next };
  // Keep the last 100 message drafts; a very long thread should not grow the hook forever.
  if (order.length > 100) {
    for (const stale of order.slice(0, order.length - 100)) delete drafts[stale];
  }
  return {
    ...state,
    drafts,
    order: order.slice(-100),
    activeRunId: state.activeRunId ?? envelope.runId,
    applied: state.applied + 1,
  };
}

function markRunDone(state: ConversationStreamState, runId: string) {
  let changed = false;
  const drafts = { ...state.drafts };
  for (const [id, draft] of Object.entries(drafts)) {
    if (draft.runId === runId && !draft.done) {
      drafts[id] = { ...draft, done: true };
      changed = true;
    }
  }
  return {
    ...state,
    ...(changed ? { drafts } : {}),
    activeRunId: state.activeRunId === runId ? null : state.activeRunId,
  };
}

/** Apply one `agui` SSE frame. Duplicate sequence numbers are ignored. */
export function applyEnvelope(
  state: ConversationStreamState,
  envelope: StreamEnvelope,
): ConversationStreamState {
  const last = state.lastEventId;
  if (typeof envelope.seq !== "number" || !Number.isFinite(envelope.seq)) return state;
  if (last !== null && envelope.seq <= last) return state;
  if (last !== null && envelope.seq > last + 1) {
    // Do not apply an event after a hole: the server replay from the active run start
    // is the only safe way to rebuild the text without silently dropping a delta.
    return { ...state, resync: true, gaps: state.gaps + 1 };
  }

  const base: ConversationStreamState = {
    ...state,
    lastEventId: envelope.seq,
    phase: "live",
    error: undefined,
    resync: false,
  };
  const event = envelope.event;
  const messageId = typeof event.messageId === "string" ? event.messageId : undefined;
  const delta = typeof event.delta === "string" ? event.delta : "";

  switch (event.type) {
    case "RUN_STARTED":
      return {
        ...base,
        activeRunId: envelope.runId,
        applied: base.applied + 1,
      };
    case "TEXT_MESSAGE_START":
      return messageId
        ? { ...addDraft(base, envelope, messageId, "", false), activeRunId: envelope.runId }
        : { ...base, activeRunId: envelope.runId };
    case "TEXT_MESSAGE_CONTENT":
    case "TEXT_MESSAGE_CHUNK":
      return messageId
        ? { ...addDraft(base, envelope, messageId, delta, false), activeRunId: envelope.runId }
        : base;
    case "TEXT_MESSAGE_END":
      if (!messageId) return base;
      return {
        ...addDraft(base, envelope, messageId, "", true),
        activeRunId: state.activeRunId ?? envelope.runId,
      };
    case "RUN_FINISHED":
      return markRunDone({ ...base, applied: base.applied + 1 }, envelope.runId);
    case "RUN_ERROR": {
      const finished = markRunDone({ ...base, applied: base.applied + 1 }, envelope.runId);
      return {
        ...finished,
        phase: "error",
        error:
          typeof event.message === "string" && event.message.trim()
            ? event.message
            : "The reply ended unexpectedly.",
      };
    }
    default:
      return { ...base, applied: base.applied + 1 };
  }
}

/** Apply `ready` / `stream_error` control frames emitted by the app's SSE route. */
export function applyControlMessage(
  state: ConversationStreamState,
  message: SseMessage,
): ConversationStreamState {
  if (message.event === "ready") {
    let ready: ReadyPayload;
    try {
      ready = JSON.parse(message.data) as ReadyPayload;
    } catch {
      return state;
    }
    if (ready.reset) {
      return {
        ...initialStreamState(),
        phase: "live",
        activeRunId: ready.run?.status === "running" ? ready.run.runId : null,
        // Replay frames that follow carry their own ids; starting from null avoids
        // treating the replay's first seq as a duplicate of a pre-reset cursor.
        lastEventId: null,
      };
    }
    return {
      ...state,
      phase: "live",
      activeRunId: ready.run?.status === "running" ? ready.run.runId : state.activeRunId,
      error: undefined,
      resync: false,
    };
  }
  if (message.event === "stream_error") {
    let detail = "The live reply channel is unavailable.";
    try {
      const parsed = JSON.parse(message.data) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) detail = parsed.message;
    } catch {
      // Keep the generic sentence for malformed control frames.
    }
    return { ...state, phase: "error", error: detail };
  }
  return state;
}

export interface IntegrityReport {
  checked: number;
  matched: number;
  pending: string[];
  /** A saved assistant message matched a finished draft by text after the runtime
   *  replaced the event message id. The saved message remains authoritative. */
  matchedByText: { id: string; messageId: string }[];
  mismatched: { id: string; streamed: string; final: string }[];
}

/**
 * Compare completed stream drafts with the persisted thread messages. A completed
 * draft with no persisted counterpart is pending (the runtime may still be saving);
 * one whose text differs is a real integrity failure and the UI should prefer the
 * persisted assistant text.
 */
export function verifyDrafts(
  drafts: Record<string, ConversationDraft>,
  messages: readonly { id: string; role: string; content?: unknown }[],
): IntegrityReport {
  const persisted = messages
    .filter(
      (message): message is { id: string; role: string; content: string } =>
        message.role === "assistant" && typeof message.content === "string",
    )
    .map((message) => ({ id: message.id, content: message.content }));
  const byId = new Map(persisted.map((message) => [message.id, message.content]));
  const claimed = new Set<string>();
  const report: IntegrityReport = {
    checked: 0,
    matched: 0,
    pending: [],
    matchedByText: [],
    mismatched: [],
  };
  const finished = Object.values(drafts)
    .filter((draft) => draft.done)
    .sort((a, b) => b.seq - a.seq);
  for (const draft of finished) {
    report.checked += 1;
    const final = byId.get(draft.id);
    if (final !== undefined) {
      claimed.add(draft.id);
      if (final.trim() === draft.text.trim()) report.matched += 1;
      else report.mismatched.push({ id: draft.id, streamed: draft.text, final });
      continue;
    }
    // The runtime can persist an assistant message under a new id. Only the latest
    // unclaimed message with exactly the same text is a safe fallback; matching any
    // older identical reply would hide a legitimate new answer.
    let fallback: { id: string; content: string } | undefined;
    for (let index = persisted.length - 1; index >= 0; index -= 1) {
      const message = persisted[index];
      if (!claimed.has(message.id) && message.content.trim() === draft.text.trim()) {
        fallback = message;
        break;
      }
    }
    if (fallback) {
      claimed.add(fallback.id);
      report.matched += 1;
      report.matchedByText.push({ id: draft.id, messageId: fallback.id });
    } else {
      report.pending.push(draft.id);
    }
  }
  return report;
}

class StreamRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "StreamRequestError";
  }
}

interface SseHandlers {
  onOpen(): void;
  onText(text: string): void;
  onError(error: Error): void;
  onClose(): void;
}

interface SseTransport {
  close(): void;
}

function headers(token: string, after: number | null) {
  return {
    Accept: "text/event-stream",
    Authorization: `Bearer ${token}`,
    "Cache-Control": "no-cache",
    ...(after === null ? {} : { "Last-Event-ID": String(after) }),
  };
}

function statusError(status: number): StreamRequestError {
  if (status === 401 || status === 403)
    return new StreamRequestError("Your session expired. Sign in again.", status, false);
  if (status === 404)
    return new StreamRequestError("This conversation is no longer available.", status, false);
  return new StreamRequestError(`Live reply connection failed (${status}).`, status);
}

// React Native's XHR keeps every character in responseText until the request ends. Rotate
// a long-lived stream well below the ledger budget and resume from Last-Event-ID instead
// of retaining an unbounded page of text for the lifetime of the app session.
const XHR_ROTATE_CHARS = 1024 * 1024;

function openFetchStream(
  url: string,
  token: string,
  after: number | null,
  handlers: SseHandlers,
): SseTransport {
  const controller = new AbortController();
  let cancelled = false;
  void (async () => {
    let response: Response;
    try {
      response = await fetch(url, { headers: headers(token, after), signal: controller.signal });
    } catch (error) {
      if (!cancelled) handlers.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    if (!response.ok) {
      if (!cancelled) handlers.onError(statusError(response.status));
      return;
    }
    if (!response.body) {
      if (!cancelled)
        handlers.onError(new StreamRequestError("This device cannot stream replies."));
      return;
    }
    handlers.onOpen();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.length) handlers.onText(decoder.decode(value, { stream: true }));
      }
      if (!cancelled) {
        const tail = decoder.decode();
        if (tail) handlers.onText(tail);
        handlers.onClose();
      }
    } catch (error) {
      if (!cancelled) handlers.onError(error instanceof Error ? error : new Error(String(error)));
    }
  })();
  return {
    close() {
      cancelled = true;
      controller.abort();
    },
  };
}

/** React Native's fetch does not expose a reliable response stream on every runtime;
 *  XHR's progressive `responseText` does, so native uses it directly. */
function openXhrStream(
  url: string,
  token: string,
  after: number | null,
  handlers: SseHandlers,
): SseTransport {
  const xhr = new XMLHttpRequest();
  let offset = 0;
  let opened = false;
  let failed = false;
  const fail = (error: Error) => {
    if (failed) return;
    failed = true;
    handlers.onError(error);
  };
  xhr.open("GET", url);
  for (const [name, value] of Object.entries(headers(token, after)))
    xhr.setRequestHeader(name, value);
  xhr.onreadystatechange = () => {
    if (xhr.readyState !== 2) return;
    if (xhr.status < 200 || xhr.status >= 300) {
      fail(statusError(xhr.status || 0));
      return;
    }
    opened = true;
    handlers.onOpen();
  };
  xhr.onprogress = () => {
    if (failed) return;
    const text = xhr.responseText || "";
    if (text.length <= offset) return;
    const chunk = text.slice(offset);
    offset = text.length;
    handlers.onText(chunk);
    if (!failed && offset >= XHR_ROTATE_CHARS) {
      failed = true;
      xhr.abort();
      handlers.onClose();
    }
  };
  xhr.onerror = () => fail(new StreamRequestError("Live reply connection was lost."));
  xhr.ontimeout = () => fail(new StreamRequestError("Live reply connection timed out."));
  xhr.onloadend = () => {
    if (!failed && opened) handlers.onClose();
  };
  xhr.send();
  return {
    close() {
      failed = true;
      xhr.abort();
    },
  };
}

function openStream(url: string, token: string, after: number | null, handlers: SseHandlers) {
  // A browser exposes document + ReadableStream. React Native's fetch does not
  // reliably expose a progressive response body, so native uses XHR instead.
  const browserStreaming = typeof document !== "undefined" && typeof ReadableStream !== "undefined";
  return browserStreaming
    ? openFetchStream(url, token, after, handlers)
    : openXhrStream(url, token, after, handlers);
}

const HEARTBEAT_TIMEOUT_MS = 45_000;
const MAX_RECONNECT_ATTEMPTS = 12;

function reconnectDelay(attempt: number) {
  const base = Math.min(15_000, 500 * 2 ** attempt);
  // Jitter prevents many clients from reconnecting in the same instant after an outage.
  return base + Math.floor(Math.random() * Math.min(400, base / 4));
}

export interface UseConversationStreamOptions {
  api: Pick<LingTaiApi, "token" | "url">;
  threadId: string;
  enabled: boolean;
}

export interface ConversationStreamControl {
  state: ConversationStreamState;
  retry(): void;
}

/**
 * Subscribe to the app-owned SSE mirror for one conversation thread.
 *
 * The hook reconnects with exponential backoff and resumes from the last applied
 * sequence number. A heartbeat watchdog catches half-open connections that never
 * deliver a FIN. Unmount/thread change aborts the request and clears every timer.
 */
export function useConversationStream({
  api,
  threadId,
  enabled,
}: UseConversationStreamOptions): ConversationStreamControl {
  const [state, setState] = useState<ConversationStreamState>(initialStreamState);
  const stateRef = useRef(state);
  const [nonce, setNonce] = useState(0);

  const commit = useCallback((next: ConversationStreamState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Switching threads must never show the previous thread's in-flight text.
  useEffect(() => {
    const fresh = initialStreamState();
    stateRef.current = fresh;
    setState(fresh);
  }, [threadId]);

  useEffect(() => {
    if (!enabled) {
      const idle = { ...stateRef.current, phase: "idle" as const, activeRunId: null };
      stateRef.current = idle;
      setState(idle);
      return;
    }

    let disposed = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let transport: SseTransport | undefined;
    let gaveUp = false;
    // Every transport gets a generation. A late callback from a connection we
    // already replaced must never apply text to the new connection's state.
    let generation = 0;
    const parser = createSseParser((message) => {
      if (disposed) return;
      if (message.event === "ready" || message.event === "stream_error") {
        commit(applyControlMessage(stateRef.current, message));
        return;
      }
      if (message.event !== "agui") return;
      let envelope: StreamEnvelope;
      try {
        envelope = JSON.parse(message.data) as StreamEnvelope;
      } catch {
        return;
      }
      if (!envelope || typeof envelope !== "object" || !envelope.event) return;
      const next = applyEnvelope(stateRef.current, envelope);
      commit(next);
      if (next.resync && !disposed) {
        // A hole means the current connection lost at least one frame. Reconnect
        // immediately with the last applied id; the server replays the missing
        // suffix from its ledger. Do not wait for the 45-second watchdog.
        attempt = 0;
        reconnectNow();
      }
    });

    const clearTimers = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      if (watchdog) clearTimeout(watchdog);
      watchdog = undefined;
    };

    const detach = () => {
      generation += 1;
      transport?.close();
      transport = undefined;
      parser.reset();
    };

    const reconnectNow = () => {
      if (disposed || gaveUp) return;
      clearTimers();
      detach();
      commit({
        ...stateRef.current,
        phase: stateRef.current.applied ? "live" : "reconnecting",
      });
      reconnectTimer = setTimeout(connect, 25);
    };

    const schedule = (error?: Error) => {
      if (disposed || gaveUp) return;
      detach();
      // A transport can report both an error and a close. Keep one pending retry.
      if (reconnectTimer) return;
      const retryable = !(error instanceof StreamRequestError) || error.retryable;
      if (!retryable) {
        gaveUp = true;
        clearTimers();
        commit({ ...stateRef.current, phase: "error", error: error?.message });
        return;
      }
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        gaveUp = true;
        clearTimers();
        commit({
          ...stateRef.current,
          phase: "error",
          error: error?.message || "Could not reconnect to the live reply channel.",
        });
        return;
      }
      const delay = reconnectDelay(attempt++);
      commit({
        ...stateRef.current,
        phase: "reconnecting",
        ...(error ? { error: error.message } : {}),
      });
      reconnectTimer = setTimeout(connect, delay);
    };

    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        schedule(new StreamRequestError("The live reply channel stopped responding."));
      }, HEARTBEAT_TIMEOUT_MS);
    };

    function connect() {
      if (disposed || gaveUp) return;
      reconnectTimer = undefined;
      if (watchdog) clearTimeout(watchdog);
      watchdog = undefined;
      if (attempt === 0)
        commit({
          ...stateRef.current,
          phase: stateRef.current.applied ? "live" : "connecting",
        });
      const after = stateRef.current.lastEventId;
      parser.reset();
      armWatchdog();
      const connection = ++generation;
      const current = () => !disposed && connection === generation;
      transport = openStream(
        api.url(`/api/conversation/stream/${encodeURIComponent(threadId)}`),
        api.token,
        after,
        {
          onOpen() {
            if (!current()) return;
            armWatchdog();
            commit({ ...stateRef.current, phase: "live", error: undefined });
          },
          onText(text) {
            if (!current()) return;
            // Only a connection that actually delivers bytes proves the transport is
            // healthy. Resetting in onOpen would let an open-then-close loop retry
            // forever at the base delay.
            attempt = 0;
            armWatchdog();
            parser.push(text);
          },
          onError(error) {
            if (!current()) return;
            schedule(error);
          },
          onClose() {
            if (!current()) return;
            // Some proxies close a complete frame without the trailing blank line.
            parser.end();
            schedule();
          },
        },
      );
    }

    connect();
    return () => {
      disposed = true;
      clearTimers();
      detach();
    };
  }, [api, commit, enabled, nonce, threadId]);

  const retry = useCallback(() => setNonce((value) => value + 1), []);
  return { state, retry };
}
