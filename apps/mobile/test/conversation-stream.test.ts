import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyControlMessage,
  applyEnvelope,
  type ConversationDraft,
  initialStreamState,
  type StreamEnvelope,
  verifyDrafts,
} from "../src/conversation-stream.ts";

function envelope(
  seq: number,
  type: string,
  extra: Record<string, unknown> = {},
  runId = "run-1",
): StreamEnvelope {
  return {
    threadId: "thread-1",
    seq,
    ts: new Date(seq).toISOString(),
    runId,
    event: { type, ...extra },
  };
}

test("text deltas accumulate by message id and duplicate sequence numbers are ignored", () => {
  let state = initialStreamState();
  state = applyEnvelope(state, envelope(1, "RUN_STARTED"));
  state = applyEnvelope(state, envelope(2, "TEXT_MESSAGE_START", { messageId: "message-1" }));
  state = applyEnvelope(
    state,
    envelope(3, "TEXT_MESSAGE_CONTENT", { messageId: "message-1", delta: "Hel" }),
  );
  const duplicate = applyEnvelope(
    state,
    envelope(3, "TEXT_MESSAGE_CONTENT", { messageId: "message-1", delta: "XXX" }),
  );
  assert.equal(duplicate, state);
  state = applyEnvelope(
    state,
    envelope(4, "TEXT_MESSAGE_CONTENT", { messageId: "message-1", delta: "lo" }),
  );
  state = applyEnvelope(state, envelope(5, "TEXT_MESSAGE_END", { messageId: "message-1" }));
  state = applyEnvelope(state, envelope(6, "RUN_FINISHED"));

  assert.equal(state.drafts["message-1"].text, "Hello");
  assert.equal(state.drafts["message-1"].done, true);
  assert.equal(state.activeRunId, null);
  assert.equal(state.phase, "live");
  assert.equal(state.applied, 6);
  assert.equal(state.lastEventId, 6);
});

test("a sequence hole requests a replay instead of applying a partial reply", () => {
  let state = initialStreamState();
  state = applyEnvelope(state, envelope(1, "RUN_STARTED"));
  state = applyEnvelope(state, envelope(2, "TEXT_MESSAGE_START", { messageId: "message-1" }));
  state = applyEnvelope(
    state,
    envelope(3, "TEXT_MESSAGE_CONTENT", { messageId: "message-1", delta: "A" }),
  );
  const before = state;
  const gapped = applyEnvelope(
    state,
    envelope(5, "TEXT_MESSAGE_CONTENT", { messageId: "message-1", delta: "C" }),
  );
  assert.equal(gapped.resync, true);
  assert.equal(gapped.gaps, 1);
  assert.equal(gapped.lastEventId, 3);
  assert.equal(gapped.applied, before.applied);
  assert.equal(gapped.drafts["message-1"].text, "A");

  state = applyEnvelope(
    gapped,
    envelope(4, "TEXT_MESSAGE_CONTENT", { messageId: "message-1", delta: "B" }),
  );
  state = applyEnvelope(
    state,
    envelope(5, "TEXT_MESSAGE_CONTENT", { messageId: "message-1", delta: "C" }),
  );
  assert.equal(state.drafts["message-1"].text, "ABC");
  assert.equal(state.resync, false);
});

test("RUN_ERROR closes the draft and exposes a retryable error", () => {
  let state = initialStreamState();
  state = applyEnvelope(state, envelope(1, "RUN_STARTED"));
  state = applyEnvelope(state, envelope(2, "TEXT_MESSAGE_START", { messageId: "message-1" }));
  state = applyEnvelope(
    state,
    envelope(3, "TEXT_MESSAGE_CONTENT", { messageId: "message-1", delta: "Half" }),
  );
  state = applyEnvelope(state, envelope(4, "RUN_ERROR", { message: "Model unavailable" }));
  assert.equal(state.phase, "error");
  assert.equal(state.error, "Model unavailable");
  assert.equal(state.activeRunId, null);
  assert.equal(state.drafts["message-1"].done, true);
  assert.equal(state.drafts["message-1"].text, "Half");
});

test("ready reset clears drafts and the cursor before replay begins", () => {
  let state = initialStreamState();
  state = applyEnvelope(state, envelope(1, "RUN_STARTED"));
  state = applyEnvelope(state, envelope(2, "TEXT_MESSAGE_START", { messageId: "old" }));
  state = applyEnvelope(
    state,
    envelope(3, "TEXT_MESSAGE_CONTENT", { messageId: "old", delta: "stale" }),
  );
  state = applyControlMessage(state, {
    event: "ready",
    data: JSON.stringify({
      protocol: 1,
      threadId: "thread-1",
      reset: true,
      replayFrom: 0,
      active: true,
      lastEventId: 8,
      oldestEventId: 3,
      eventCount: 6,
      run: {
        runId: "run-2",
        status: "running",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
  });
  assert.equal(state.phase, "live");
  assert.equal(state.lastEventId, null);
  assert.equal(state.activeRunId, "run-2");
  assert.deepEqual(state.drafts, {});
});

test("replay after reset rebuilds a mid-ledger run without reporting a false gap", () => {
  let state = initialStreamState();
  state = applyEnvelope(state, envelope(1, "RUN_STARTED"));
  state = applyEnvelope(
    state,
    envelope(2, "TEXT_MESSAGE_CONTENT", {
      messageId: "old",
      delta: "stale",
    }),
  );
  state = applyControlMessage(state, {
    event: "ready",
    data: JSON.stringify({
      protocol: 1,
      threadId: "thread-1",
      reset: true,
      replayFrom: 9,
      active: true,
      lastEventId: 12,
      oldestEventId: 10,
      eventCount: 3,
      run: {
        runId: "run-2",
        status: "running",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
  });

  state = applyEnvelope(
    state,
    envelope(
      10,
      "TEXT_MESSAGE_CONTENT",
      {
        messageId: "tail",
        delta: "partial ",
      },
      "run-2",
    ),
  );
  state = applyEnvelope(
    state,
    envelope(
      11,
      "TEXT_MESSAGE_CONTENT",
      {
        messageId: "tail",
        delta: "reply",
      },
      "run-2",
    ),
  );
  state = applyEnvelope(state, envelope(12, "RUN_FINISHED", {}, "run-2"));

  assert.equal(state.resync, false);
  assert.equal(state.gaps, 0);
  assert.equal(state.lastEventId, 12);
  assert.equal(state.drafts.old, undefined);
  assert.equal(state.drafts.tail.text, "partial reply");
  assert.equal(state.drafts.tail.done, true);
  assert.equal(state.activeRunId, null);
});

test("a retained run whose start was evicted still accumulates its tail", () => {
  let state = initialStreamState();
  state = applyEnvelope(
    state,
    envelope(101, "TEXT_MESSAGE_CONTENT", {
      messageId: "message-1",
      delta: "tail ",
    }),
  );
  state = applyEnvelope(
    state,
    envelope(102, "TEXT_MESSAGE_CONTENT", {
      messageId: "message-1",
      delta: "of the reply",
    }),
  );
  state = applyEnvelope(state, envelope(103, "RUN_FINISHED"));

  assert.equal(state.resync, false);
  assert.equal(state.drafts["message-1"].text, "tail of the reply");
  assert.equal(state.drafts["message-1"].done, true);
  assert.equal(state.activeRunId, null);
});

test("finished drafts are checked against saved messages, including a renamed id", () => {
  const drafts: Record<string, ConversationDraft> = {
    first: {
      id: "first",
      text: "Hello",
      done: true,
      runId: "run-1",
      seq: 1,
      updatedAt: 1,
    },
    renamed: {
      id: "renamed",
      text: "Saved under a new id\n",
      done: true,
      runId: "run-1",
      seq: 2,
      updatedAt: 2,
    },
    changed: {
      id: "changed",
      text: "Streamed value",
      done: true,
      runId: "run-1",
      seq: 3,
      updatedAt: 3,
    },
    pending: {
      id: "pending",
      text: "Still saving",
      done: true,
      runId: "run-1",
      seq: 4,
      updatedAt: 4,
    },
    live: {
      id: "live",
      text: "Not finished",
      done: false,
      runId: "run-1",
      seq: 5,
      updatedAt: 5,
    },
  };
  const report = verifyDrafts(drafts, [
    { id: "first", role: "assistant", content: "Hello" },
    { id: "persisted-2", role: "assistant", content: "Saved under a new id\n" },
    { id: "changed", role: "assistant", content: "Final value" },
    { id: "user-1", role: "user", content: "Still saving" },
  ]);
  assert.equal(report.checked, 4);
  assert.equal(report.matched, 2);
  assert.deepEqual(report.pending, ["pending"]);
  assert.deepEqual(report.matchedByText, [{ id: "renamed", messageId: "persisted-2" }]);
  assert.deepEqual(report.mismatched, [
    { id: "changed", streamed: "Streamed value", final: "Final value" },
  ]);
});

test("text fallback picks the latest unclaimed saved message", () => {
  const drafts: Record<string, ConversationDraft> = {
    live: {
      id: "live",
      text: "Same answer",
      done: true,
      runId: "run-1",
      seq: 1,
      updatedAt: 1,
    },
  };
  const report = verifyDrafts(drafts, [
    { id: "older", role: "assistant", content: "Same answer" },
    { id: "newer", role: "assistant", content: "Same answer" },
  ]);
  assert.deepEqual(report.matchedByText, [{ id: "live", messageId: "newer" }]);
});
