import assert from "node:assert/strict";
import { test } from "node:test";
import { createSseParser, type SseMessage } from "../src/sse.ts";

function collect(chunks: readonly string[], end = true) {
  const messages: SseMessage[] = [];
  const parser = createSseParser((message) => messages.push(message));
  for (const chunk of chunks) parser.push(chunk);
  if (end) parser.end();
  return { messages, parser };
}

test("frames survive arbitrary chunk boundaries and CRLF line endings", () => {
  const frame = ': keepalive\r\nid: 7\r\nevent: agui\r\ndata: {"seq":7}\r\n\r\n';
  const messages: SseMessage[] = [];
  const parser = createSseParser((message) => messages.push(message));
  for (const character of frame) parser.push(character);
  assert.deepEqual(messages, [{ id: "7", event: "agui", data: '{"seq":7}' }]);
  assert.equal(parser.buffered(), 0);
});

test("multi-line data, comments and retry fields follow EventSource semantics", () => {
  const { messages } = collect([
    "retry: 1500\n: a comment\nevent: notice\ndata: first line\ndata: second line\n\n",
  ]);
  assert.deepEqual(messages, [{ event: "notice", data: "first line\nsecond line", retry: 1500 }]);
});

test("the last event id survives frames that carry no data", () => {
  const { messages } = collect(["id: 9\n\n", "data: body\n\n", "data: next\n\n"]);
  assert.deepEqual(messages, [
    { id: "9", event: "message", data: "body" },
    { id: "9", event: "message", data: "next" },
  ]);
});

test("a final frame without a blank line is flushed on end", () => {
  const parser = createSseParser(() => {});
  const messages: SseMessage[] = [];
  const collecting = createSseParser((message) => messages.push(message));
  collecting.push('event: ready\ndata: {"protocol":1}');
  collecting.end();
  assert.deepEqual(messages, [{ event: "ready", data: '{"protocol":1}' }]);
  parser.push("partial");
  parser.end();
});

test("reset drops half a frame and the remembered event id", () => {
  const messages: SseMessage[] = [];
  const parser = createSseParser((message) => messages.push(message));
  parser.push("id: 4\ndata: old\n\nhalf");
  parser.reset();
  parser.push("data: fresh\n\n");
  assert.deepEqual(messages, [
    { id: "4", event: "message", data: "old" },
    { event: "message", data: "fresh" },
  ]);
});

test("an oversized unterminated frame is discarded instead of growing the heap", () => {
  const messages: SseMessage[] = [];
  const parser = createSseParser((message) => messages.push(message));
  parser.push(`data: ${"x".repeat(2 * 1024 * 1024 + 1)}`);
  assert.deepEqual(messages, []);
  assert.equal(parser.buffered(), 0);
  parser.push("data: recovered\n\n");
  assert.deepEqual(messages, [{ event: "message", data: "recovered" }]);
});
