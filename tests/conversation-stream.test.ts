import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { BaseEvent } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import { CopilotRuntime, createCopilotHonoHandler } from "@copilotkit/runtime/v2";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createSseParser } from "../apps/mobile/src/sse.ts";
import { createApp } from "../apps/server/src/app.ts";
import type { Config } from "../apps/server/src/config.ts";
import { createStore, type Store } from "../apps/server/src/db.ts";
import { ConversationAgent } from "../apps/server/src/engine/conversation.ts";
import {
  ConversationStream,
  type StreamEnvelope,
  type StreamStatus,
} from "../apps/server/src/engine/stream.ts";
import {
  type ConversationStreamRouteOptions,
  conversationStreamRoutes,
} from "../apps/server/src/engine/stream-routes.ts";

class MemoryStore {
  readonly records = new Map<string, unknown>();
  async get<T>(owner: string, kind: string, id: string): Promise<T | null> {
    return (this.records.get(`${owner}\u0000${kind}\u0000${id}`) as T | undefined) ?? null;
  }
  async put<T extends { id: string }>(owner: string, kind: string, value: T): Promise<T> {
    this.records.set(`${owner}\u0000${kind}\u0000${value.id}`, structuredClone(value));
    return value;
  }
}

function store() {
  return new MemoryStore() as unknown as Store;
}

function runStarted(runId = "run-1"): BaseEvent {
  return { type: EventType.RUN_STARTED, threadId: "thread-1", runId } as BaseEvent;
}

function textStart(messageId = "message-1"): BaseEvent {
  return { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" } as BaseEvent;
}

function textDelta(delta: string, messageId = "message-1"): BaseEvent {
  return { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta } as BaseEvent;
}

function textEnd(messageId = "message-1"): BaseEvent {
  return { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent;
}

function runFinished(runId = "run-1"): BaseEvent {
  return { type: EventType.RUN_FINISHED, threadId: "thread-1", runId } as BaseEvent;
}

async function publishTurn(stream: ConversationStream, owner = "owner-1", threadId = "thread-1") {
  const events = [
    runStarted(),
    textStart(),
    textDelta("Hello"),
    textDelta(" world"),
    textEnd(),
    runFinished(),
  ];
  for (const event of events) await stream.publish(owner, threadId, "run-1", event);
}

test("a reconnect replays only the missing suffix from the event ledger", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0 });
  await publishTurn(stream);
  let ready: { status: StreamStatus; reset: boolean; from: number } | undefined;
  const events: StreamEnvelope[] = [];
  const attachment = await stream.attach("owner-1", "thread-1", 2, {
    onReady(status, reset, from) {
      ready = { status, reset, from };
    },
    onEvent(envelope) {
      events.push(envelope);
    },
  });
  assert.deepEqual(
    events.map((event) => event.seq),
    [3, 4, 5, 6],
  );
  assert.equal(ready?.reset, false);
  assert.equal(ready?.from, 2);
  assert.equal(ready?.status.lastEventId, 6);
  assert.equal(ready?.status.run?.status, "finished");
  attachment.unsubscribe();
  await stream.close();
});

test("the retained byte budget counts UTF-8 bytes instead of UTF-16 code units", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0, maxBytes: 500 });
  const delta = "中".repeat(60);
  await stream.publish("owner-1", "thread-1", "run-1", textDelta(delta));
  await stream.publish("owner-1", "thread-1", "run-1", textDelta(delta));

  const status = await stream.status("owner-1", "thread-1");
  // Each frame is 312 UTF-8 bytes but only 192 UTF-16 code units. The first
  // frame must be evicted even though two string lengths fit in 500.
  assert.equal(status.eventCount, 1);
  assert.equal(status.oldestEventId, 2);
  assert.equal(status.lastEventId, 2);
  await stream.close();
});

test("a fresh connection follows an active run from its first event", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0 });
  for (const event of [runStarted(), textStart(), textDelta("Part")]) {
    await stream.publish("owner-1", "thread-1", "run-1", event);
  }
  const events: number[] = [];
  let reset = true;
  let from = -1;
  const attachment = await stream.attach("owner-1", "thread-1", null, {
    onReady(status, nextReset, replayFrom) {
      reset = nextReset;
      from = replayFrom;
      assert.equal(status.active, true);
    },
    onEvent(envelope) {
      events.push(envelope.seq);
    },
  });
  assert.equal(reset, false);
  assert.equal(from, 0);
  assert.deepEqual(events, [1, 2, 3]);
  attachment.unsubscribe();
  await stream.publish("owner-1", "thread-1", "run-1", textEnd());
  await stream.publish("owner-1", "thread-1", "run-1", runFinished());
  const idle: number[] = [];
  const idleAttachment = await stream.attach("owner-1", "thread-1", null, {
    onReady(status, _reset, replayFrom) {
      assert.equal(status.active, false);
      assert.equal(replayFrom, status.lastEventId);
    },
    onEvent(envelope) {
      idle.push(envelope.seq);
    },
  });
  assert.deepEqual(idle, []);
  idleAttachment.unsubscribe();
  await stream.close();
});

test("a fresh connection replays the retained tail after an active run start is evicted", async () => {
  const stream = new ConversationStream(store(), {
    flushMs: 0,
    maxEvents: 3,
    maxBytes: 1024 * 1024,
  });
  for (const event of [runStarted(), textStart(), textDelta("A"), textDelta("B"), textDelta("C")]) {
    await stream.publish("owner-1", "thread-1", "run-1", event);
  }

  const status = await stream.status("owner-1", "thread-1");
  assert.equal(status.run?.status, "running");
  assert.equal(status.oldestEventId, 3);

  const events: StreamEnvelope[] = [];
  let reset = true;
  let from = -1;
  const attachment = await stream.attach("owner-1", "thread-1", null, {
    onReady(_status, nextReset, replayFrom) {
      reset = nextReset;
      from = replayFrom;
    },
    onEvent(envelope) {
      events.push(envelope);
    },
  });

  assert.equal(reset, false);
  assert.equal(from, 2);
  assert.deepEqual(
    events.map((event) => event.seq),
    [3, 4, 5],
  );
  assert.ok(events.every((event) => event.runId === "run-1"));
  attachment.unsubscribe();
  await stream.close();
});

test("a persisted ledger is sorted, deduplicated, and resumes from its last event", async () => {
  const memory = new MemoryStore();
  const ts = new Date().toISOString();
  await memory.put("owner-1", "conversation-streams", {
    id: "thread-1",
    seq: 2,
    oldestSeq: 99,
    events: [
      { seq: 3, ts, runId: "run-1", event: textDelta("three-old") },
      { seq: 1, ts, runId: "run-1", event: textDelta("one") },
      { seq: 2, ts, runId: "run-1", event: textDelta("two") },
      { seq: 3, ts, runId: "run-1", event: textDelta("three-new") },
      { seq: 0, ts, runId: "run-1", event: textDelta("zero") },
      { seq: "4", ts, runId: "run-1", event: textDelta("string") },
      { seq: 4, ts, runId: "run-1", event: {} },
    ],
    run: null,
    updatedAt: ts,
  });

  const stream = new ConversationStream(memory as unknown as Store, { flushMs: 0 });
  const status = await stream.status("owner-1", "thread-1");
  assert.equal(status.oldestEventId, 1);
  assert.equal(status.lastEventId, 3);
  assert.equal(status.eventCount, 3);

  const events: StreamEnvelope[] = [];
  const attachment = await stream.attach("owner-1", "thread-1", 0, {
    onReady() {},
    onEvent(envelope) {
      events.push(envelope);
    },
  });
  assert.deepEqual(
    events.map((event) => event.seq),
    [1, 2, 3],
  );
  assert.equal(events[2].event.delta, "three-new");
  attachment.unsubscribe();

  const next = await stream.publish("owner-1", "thread-1", "run-1", textDelta("four"));
  assert.equal(next.seq, 4);
  await stream.close();
});

test("a persisted ledger with an internal hole replays only its contiguous suffix", async () => {
  const memory = new MemoryStore();
  const ts = new Date().toISOString();
  await memory.put("owner-1", "conversation-streams", {
    id: "thread-1",
    seq: 9,
    oldestSeq: 1,
    events: [
      { seq: 1, ts, runId: "run-1", event: textDelta("one") },
      { seq: 2, ts, runId: "run-1", event: textDelta("two") },
      { seq: 4, ts, runId: "run-1", event: textDelta("four") },
      { seq: 5, ts, runId: "run-1", event: textDelta("five") },
      { seq: 6, ts, runId: "run-1", event: textDelta("six") },
    ],
    run: null,
    updatedAt: ts,
  });

  const stream = new ConversationStream(memory as unknown as Store, { flushMs: 0 });
  const status = await stream.status("owner-1", "thread-1");
  assert.equal(status.oldestEventId, 4);
  assert.equal(status.lastEventId, 6);
  assert.equal(status.eventCount, 3);

  const events: number[] = [];
  let reset = false;
  const attachment = await stream.attach("owner-1", "thread-1", 0, {
    onReady(_status, nextReset) {
      reset = nextReset;
    },
    onEvent(envelope) {
      events.push(envelope.seq);
    },
  });
  assert.equal(reset, true);
  assert.deepEqual(events, [4, 5, 6]);
  attachment.unsubscribe();

  const next = await stream.publish("owner-1", "thread-1", "run-1", textDelta("seven"));
  assert.equal(next.seq, 7);
  await stream.close();
});

test("a cursor outside the retained window triggers reset and a tail replay", async () => {
  const stream = new ConversationStream(store(), {
    flushMs: 0,
    maxEvents: 3,
    maxBytes: 1024 * 1024,
  });
  for (let index = 0; index < 5; index += 1) {
    await stream.publish("owner-1", "thread-1", "run-1", textDelta(String(index)));
  }
  const old: number[] = [];
  let oldReset = false;
  let oldFrom = -1;
  const oldAttachment = await stream.attach("owner-1", "thread-1", 0, {
    onReady(_status, reset, from) {
      oldReset = reset;
      oldFrom = from;
    },
    onEvent(envelope) {
      old.push(envelope.seq);
    },
  });
  assert.equal(oldReset, true);
  assert.equal(oldFrom, 2);
  assert.deepEqual(old, [3, 4, 5]);
  oldAttachment.unsubscribe();

  const ahead: number[] = [];
  let aheadReset = false;
  const aheadAttachment = await stream.attach("owner-1", "thread-1", 99, {
    onReady(_status, reset) {
      aheadReset = reset;
    },
    onEvent(envelope) {
      ahead.push(envelope.seq);
    },
  });
  assert.equal(aheadReset, true);
  assert.deepEqual(ahead, [3, 4, 5]);
  aheadAttachment.unsubscribe();
  await stream.close();
});

test("publishers fan out to concurrent subscribers and drop only failing ones", async () => {
  const stream = new ConversationStream(store(), {
    flushMs: 0,
    maxEvents: 10_000,
    maxBytes: 16 * 1024 * 1024,
  });
  const counts = new Array(200).fill(0) as number[];
  const attachments = [];
  for (let index = 0; index < counts.length; index += 1) {
    attachments.push(
      await stream.attach("owner-1", "thread-1", 0, {
        onReady() {},
        onEvent() {
          counts[index] += 1;
        },
      }),
    );
  }
  assert.equal(stream.subscriberCount("thread-1"), 200);
  for (let index = 0; index < 50; index += 1) {
    await stream.publish("owner-1", "thread-1", "run-1", textDelta(String(index)));
  }
  assert.ok(counts.every((count) => count === 50));
  for (const attachment of attachments) attachment.unsubscribe();
  assert.equal(stream.subscriberCount("thread-1"), 0);

  let armed = false;
  const good: number[] = [];
  const failing = await stream.attach("owner-1", "thread-1", null, {
    onReady() {},
    onEvent(envelope) {
      if (armed) throw new Error("slow client");
      good.push(envelope.seq);
    },
  });
  const healthy = await stream.attach("owner-1", "thread-1", null, {
    onReady() {},
    onEvent(envelope) {
      good.push(envelope.seq);
    },
  });
  armed = true;
  await stream.publish("owner-1", "thread-1", "run-1", textDelta("after"));
  assert.equal(stream.subscriberCount("thread-1"), 1);
  failing.unsubscribe();
  healthy.unsubscribe();
  await stream.close();
});

test("the retained ledger survives a process restart through the Store", async () => {
  const db = store();
  const first = new ConversationStream(db, { flushMs: 0 });
  await publishTurn(first);
  await first.close();
  const second = new ConversationStream(db, { flushMs: 0 });
  const events: number[] = [];
  const attachment = await second.attach("owner-1", "thread-1", 0, {
    onReady() {},
    onEvent(envelope) {
      events.push(envelope.seq);
    },
  });
  assert.deepEqual(events, [1, 2, 3, 4, 5, 6]);
  attachment.unsubscribe();
  await second.close();
});

test("close drains a batch that becomes dirty while the previous write is in flight", async () => {
  const db = store();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const base = db as unknown as MemoryStore;
  const slow = {
    get: base.get.bind(base),
    put: async <T extends { id: string }>(owner: string, kind: string, value: T) => {
      await gate;
      return base.put(owner, kind, value);
    },
  } as unknown as Store;
  const stream = new ConversationStream(slow, { flushMs: 0 });
  await stream.publish("owner-1", "thread-1", "run-1", textDelta("first"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  await stream.publish("owner-1", "thread-1", "run-1", textDelta("second"));
  const closing = stream.close();
  release();
  await closing;

  const second = new ConversationStream(db, { flushMs: 0 });
  const events: number[] = [];
  const attachment = await second.attach("owner-1", "thread-1", 0, {
    onReady() {},
    onEvent(envelope) {
      events.push(envelope.seq);
    },
  });
  assert.deepEqual(events, [1, 2]);
  attachment.unsubscribe();
  await second.close();
});

function routeApp(stream: ConversationStream, options?: ConversationStreamRouteOptions) {
  const app = new Hono<{ Variables: { owner: string } }>();
  app.use("*", async (c, next) => {
    c.set("owner", "owner-1");
    await next();
  });
  app.route("/api/conversation/stream", conversationStreamRoutes(stream, options));
  return app;
}

async function readSse(response: Response, complete: (text: string) => boolean) {
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // Hono's in-memory response has no socket to keep Node alive; the real server does.
  const keepAlive = setTimeout(() => undefined, 5_000);
  let text = "";
  const deadline = Date.now() + 3_000;
  try {
    while (!complete(text)) {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for SSE frames:\n${text}`);
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    clearTimeout(keepAlive);
    await reader.cancel();
  }
  return text;
}

interface ReplayState {
  lastEventId: number | null;
  text: string;
}

function applyReplayEnvelope(state: ReplayState, envelope: StreamEnvelope) {
  if (state.lastEventId !== null && envelope.seq !== state.lastEventId + 1) {
    throw new Error(`sequence gap after ${state.lastEventId}, got ${envelope.seq}`);
  }
  state.lastEventId = envelope.seq;
  if (envelope.event.type === EventType.TEXT_MESSAGE_CONTENT) {
    state.text += String(envelope.event.delta ?? "");
  }
}

async function pumpAgui(
  response: Response,
  stateRef: { state: ReplayState },
  stop: () => boolean,
  chunkSeed: number,
) {
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser((message) => {
    if (message.event !== "agui") return;
    try {
      applyReplayEnvelope(stateRef.state, JSON.parse(message.data) as StreamEnvelope);
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  });
  const deadline = Date.now() + 10_000;
  try {
    while (!stop()) {
      if (Date.now() > deadline) throw new Error("Timed out reading a simulated SSE client");
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      let offset = 0;
      while (offset < text.length) {
        // Deliberately split frames across sizes that do not match server chunks.
        const size = 1 + ((offset + chunkSeed) % 7);
        parser.push(text.slice(offset, offset + size));
        offset += size;
        if (stop()) return;
      }
    }
  } finally {
    await reader.cancel();
  }
}

test("the SSE route honors Last-Event-ID, emits ids and resets stale cursors", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0 });
  await publishTurn(stream);
  const app = routeApp(stream);

  const resumed = await app.request("/api/conversation/stream/thread-1?after=0", {
    headers: { "Last-Event-ID": "2" },
  });
  assert.equal(resumed.status, 200);
  assert.match(resumed.headers.get("content-type") ?? "", /text\/event-stream/);
  const resumedText = await readSse(resumed, (text) => text.includes("id: 6"));
  assert.match(resumedText, /event: ready/);
  assert.match(resumedText, /"replayFrom":2/);
  assert.match(resumedText, /"reset":false/);
  assert.match(resumedText, /id: 3/);
  assert.match(resumedText, /id: 6/);
  assert.doesNotMatch(resumedText, /id: 1\n/);

  const reset = await app.request("/api/conversation/stream/thread-1", {
    headers: { "Last-Event-ID": "99" },
  });
  const resetText = await readSse(reset, (text) => text.includes("id: 6"));
  assert.match(resetText, /"reset":true/);
  assert.match(resetText, /id: 1/);
  assert.match(resetText, /id: 6/);
  await stream.close();
});

test("a fractional Last-Event-ID resets instead of becoming a replay cursor", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0 });
  await publishTurn(stream);
  const app = routeApp(stream);

  const response = await app.request("/api/conversation/stream/thread-1", {
    headers: { "Last-Event-ID": "2.5" },
  });
  const text = await readSse(response, (body) => body.includes("id: 6"));
  assert.match(text, /"reset":true/);
  assert.match(text, /"replayFrom":0/);
  assert.match(text, /id: 1/);
  assert.match(text, /id: 6/);
  await stream.close();
});

test("idle SSE streams emit heartbeat comments and the configured retry hint", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0 });
  const app = routeApp(stream, { heartbeatMs: 15, retryMs: 17 });
  const response = await app.request("/api/conversation/stream/thread-1", {
    headers: { "Last-Event-ID": "0" },
  });
  const text = await readSse(response, (body) => body.includes(": heartbeat"));
  assert.match(text, /retry: 17/);
  assert.match(text, /event: ready/);
  await stream.close();
});

test("a slow reader is disconnected at the byte limit and resumes without losing deltas", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0, maxEvents: 100 });
  const chunks = Array.from({ length: 6 }, () => "x".repeat(16 * 1024));
  for (const chunk of chunks) {
    await stream.publish("owner-1", "thread-1", "run-1", textDelta(chunk));
  }

  const limited = routeApp(stream, { maxBufferedBytes: 4 * 1024 });
  const dropped = await limited.request("/api/conversation/stream/thread-1", {
    headers: { "Last-Event-ID": "0" },
  });
  const truncated = await readSse(dropped, () => false);
  const delivered = [...truncated.matchAll(/\nid: (\d+)\n/g)].map((match) => Number(match[1]));
  assert.ok(delivered.length > 0);
  assert.ok(delivered.length < chunks.length, "the slow reader should be closed before the tail");
  assert.equal(new Set(delivered).size, delivered.length);

  const resumed = routeApp(stream, { maxBufferedBytes: 1024 * 1024 });
  const response = await resumed.request("/api/conversation/stream/thread-1", {
    headers: { "Last-Event-ID": String(delivered.at(-1)) },
  });
  const tail = await readSse(response, (text) => text.includes(`id: ${chunks.length}`));
  assert.doesNotMatch(tail, /\nid: 1\n/);
  for (let seq = (delivered.at(-1) ?? 0) + 1; seq <= chunks.length; seq += 1) {
    assert.match(tail, new RegExp(`\\nid: ${seq}\\n`));
  }
  await stream.close();
});

test("200 dropped clients re-chunk every frame and rebuild the same reply exactly", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0, maxEvents: 5000 });
  const deltas = Array.from({ length: 80 }, (_, index) => `part-${index};`);
  const events = [
    runStarted(),
    textStart(),
    ...deltas.map((delta) => textDelta(delta)),
    textEnd(),
    runFinished(),
  ];
  for (const event of events) await stream.publish("owner-1", "thread-1", "run-1", event);
  const app = routeApp(stream);
  const expected = deltas.join("");

  await Promise.all(
    Array.from({ length: 200 }, async (_, index) => {
      const stateRef = { state: { lastEventId: null, text: "" } as ReplayState };
      const cut = 30 + (index % 20);
      const first = await app.request("/api/conversation/stream/thread-1", {
        headers: { "Last-Event-ID": "0" },
      });
      await pumpAgui(first, stateRef, () => (stateRef.state.lastEventId ?? 0) >= cut, index);
      const resumed = await app.request("/api/conversation/stream/thread-1", {
        headers: { "Last-Event-ID": String(stateRef.state.lastEventId) },
      });
      await pumpAgui(
        resumed,
        stateRef,
        () => stateRef.state.lastEventId === events.length,
        index + 3,
      );
      assert.equal(stateRef.state.lastEventId, events.length);
      assert.equal(stateRef.state.text, expected);
    }),
  );
  assert.equal(stream.subscriberCount("thread-1"), 0);
  await stream.close();
});

test("a real loopback HTTP stream survives a disconnect and resumes its suffix", async () => {
  const stream = new ConversationStream(store(), { flushMs: 0 });
  const app = routeApp(stream);
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const port = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/api/conversation/stream/thread-1`;
  const stateRef = { state: { lastEventId: null, text: "" } as ReplayState };
  try {
    for (const event of [runStarted(), textStart(), textDelta("hello ")]) {
      await stream.publish("owner-1", "thread-1", "run-1", event);
    }
    const first = await fetch(url, { headers: { "Last-Event-ID": "0" } });
    await pumpAgui(first, stateRef, () => stateRef.state.lastEventId === 3, 2);

    for (const event of [textDelta("world"), textEnd(), runFinished()]) {
      await stream.publish("owner-1", "thread-1", "run-1", event);
    }
    const resumed = await fetch(url, {
      headers: { "Last-Event-ID": String(stateRef.state.lastEventId) },
    });
    await pumpAgui(resumed, stateRef, () => stateRef.state.lastEventId === 6, 5);
    assert.equal(stateRef.state.text, "hello world");
  } finally {
    (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await stream.close();
  }
});

test("a complete HTTP AG-UI run is mirrored into the replayable SSE ledger", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lingtai-stream-e2e-"));
  const db = await createStore({ dataDir: join(directory, "db") });
  const config: Config = {
    mode: "sample",
    port: 8787,
    host: "127.0.0.1",
    publicUrl: "http://localhost:8787",
    dataDir: directory,
    agentBackend: "sample",
    intelligenceApiKey: "test-project-key-never-sent",
    googleRedirectUri: "http://localhost:8787/api/google/callback",
    allowedOrigins: ["http://localhost:8081"],
  };
  const server = await createApp(db, config);
  const stream = new ConversationStream(db, { flushMs: 0 });
  try {
    const conversation = new ConversationAgent(config, server.agent, "local-user", undefined);
    conversation.use((input, next) =>
      stream.observe("local-user", input.threadId, input.runId, next.run(input)),
    );
    const runtime = new CopilotRuntime({
      agents: async () => ({ default: conversation }),
    });
    const handler = createCopilotHonoHandler({ runtime, basePath: "/api/copilotkit" });
    const app = new Hono();
    app.all("/api/copilotkit/*", async (c) => {
      const response = await handler.fetch(c.req.raw);
      const encoder = new TextEncoder();
      const body = response.body?.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
          },
        }),
      );
      return new Response(body, { status: response.status, headers: response.headers });
    });
    app.route("/api/conversation/stream", conversationStreamRoutes(stream));

    const response = await app.request("/api/copilotkit/agent/default/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        threadId: "e2e-thread",
        runId: "e2e-run",
        state: null,
        messages: [{ id: "e2e-user", role: "user", content: "hello" }],
        tools: [],
        context: [],
        forwardedProps: {},
      }),
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200, await response.clone().text());
    const direct = await response.text();
    assert.match(direct, /TEXT_MESSAGE_CONTENT/);
    assert.match(direct, /RUN_FINISHED/);

    const status = await stream.status("local-user", "e2e-thread");
    assert.equal(status.active, false);
    assert.ok(status.eventCount >= 5, `expected the full run, saw ${status.eventCount} events`);

    const events: StreamEnvelope[] = [];
    const attachment = await stream.attach("local-user", "e2e-thread", 0, {
      onReady() {},
      onEvent(envelope) {
        events.push(envelope);
      },
    });
    attachment.unsubscribe();
    const content = events
      .filter((event) => event.event.type === EventType.TEXT_MESSAGE_CONTENT)
      .map((event) => String(event.event.delta ?? ""))
      .join("");
    assert.match(content, /What would you like/);
    assert.equal(events.at(-1)?.event.type, EventType.RUN_FINISHED);
  } finally {
    await server.conversationStream.close();
    await stream.close();
    await server.agent.stop();
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
