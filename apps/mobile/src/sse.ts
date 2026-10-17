/** One dispatched Server-Sent Events frame. Comment-only frames are never emitted. */
export interface SseMessage {
  id?: string;
  event: string;
  data: string;
  retry?: number;
}

export interface SseParser {
  /** Feed decoded text. Chunk boundaries are irrelevant: frames may split anywhere. */
  push(chunk: string): void;
  /** Flush a final frame if the server closed without a trailing blank line. */
  end(): void;
  reset(): void;
  /** Bytes of a frame that has not completed yet. Exposed for diagnostics/tests. */
  buffered(): number;
}

const MAX_BUFFER = 2 * 1024 * 1024;

/**
 * Incremental SSE parser for fetch streams and React Native XHR.
 *
 * It follows the EventSource field rules: `\n`, `\r\n` and lone `\r` line endings,
 * multi-line `data:`, comment lines, and an `id` that survives events without data.
 */
export function createSseParser(onMessage: (message: SseMessage) => void): SseParser {
  let buffer = "";
  let lastEventId: string | undefined;
  let eventName = "";
  let data: string[] = [];
  let retry: number | undefined;

  const dispatch = () => {
    if (data.length === 0) {
      eventName = "";
      retry = undefined;
      return;
    }
    const message: SseMessage = {
      event: eventName || "message",
      data: data.join("\n"),
      ...(lastEventId === undefined ? {} : { id: lastEventId }),
      ...(retry === undefined ? {} : { retry }),
    };
    eventName = "";
    data = [];
    retry = undefined;
    onMessage(message);
  };

  const consume = (frame: string) => {
    let hasData = false;
    for (const line of frame.split("\n")) {
      if (!line) continue;
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      switch (field) {
        case "id":
          // The spec ignores NUL in ids; retaining the rest is safer than dropping the frame.
          lastEventId = value.replace(/\0/g, "");
          break;
        case "event":
          eventName = value;
          break;
        case "data":
          data.push(value);
          hasData = true;
          break;
        case "retry": {
          const parsed = Number(value);
          if (Number.isInteger(parsed) && parsed >= 0) retry = parsed;
          break;
        }
      }
    }
    if (hasData) dispatch();
    else {
      eventName = "";
      retry = undefined;
    }
  };

  const drain = (flush: boolean) => {
    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      consume(frame);
      end = buffer.indexOf("\n\n");
    }
    if (flush && buffer.trim()) {
      consume(buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
      buffer = "";
    }
  };

  return {
    push(chunk) {
      if (!chunk) return;
      buffer += chunk;
      // Hold a trailing CR so a CRLF split across chunks is not seen as two line breaks.
      if (buffer.endsWith("\r")) {
        buffer = `${buffer.slice(0, -1).replace(/\r\n/g, "\n").replace(/\r/g, "\n")}\r`;
      } else {
        buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      }
      if (buffer.length > MAX_BUFFER) {
        // A broken or hostile peer must not grow the app's heap without bound.
        buffer = "";
        data = [];
        eventName = "";
        retry = undefined;
        return;
      }
      drain(false);
    },
    end() {
      drain(true);
    },
    reset() {
      buffer = "";
      lastEventId = undefined;
      eventName = "";
      data = [];
      retry = undefined;
    },
    buffered() {
      return buffer.length;
    },
  };
}
