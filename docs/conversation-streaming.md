# Conversation streaming

## Scope and reverse-engineering note

This document covers the reusable conversation-streaming path: AG-UI events produced by the
CopilotKit runtime, mirrored into an app-owned replayable SSE ledger, consumed by the mobile/web
client, and reconciled with persisted thread messages.

The upstream reference is the read-only project at
`/Users/luffy/Code/Bayes/EconSwarm/LingWu`. The technical name is **REA MCP**. The embedded
`mcp__rea__*` tools were not registered in this Codex runtime, so direct calls returned
`unsupported call`. REA 6.3.0's own stdio MCP server was therefore started directly; it advertised
139 tools, including `analyze_javascript_application`, `inspect_analysis_view`, and
`trace_application_feature`.

Analyses of the whole project and of `web/src` still exceeded the 300 second deadline. The static
analysis was run instead on a five-file, read-only copy of the upstream conversation code
(`ChatScreen.tsx`, `api.ts`, `store.tsx`, `types.ts`, and `api.test.ts`) at
`/private/tmp/rea-lingwu-conversation`. REA completed in 4.6 seconds:

- Evidence `ev_74b40034b90bee5a94e3a37b622c167f65330193102c317f10dbd15f481d7d61` covered 5
  files, 170,654 text bytes, 24,037 AST nodes, and 328 findings, with 0 parse failures and 0
  integrity contradictions.
- The application graph contained 183 nodes and 338 edges; the semantic graph contained 11,333
  nodes. The semantic projection retained 2,946 unknowns rather than inventing resolved edges.
- The complete MCP response exceeded the 10 MiB stdio response budget. The server retained the
  evidence, `inspect_analysis_view` projected summary evidence
  `ev_59a58301216e0b1a38e149b8fa96a269e54108fd0b0c3ecdef7ea93a9d050011`, and
  `export_evidence_bundle` wrote a 21,082,644-byte bundle with 2 records.
- `trace_application_feature` from `api.ts` matched 2 seeds and traversed 183 nodes, 338 edges,
  and 89 terminal paths, retaining 139 observed and 471 inferred facts. Its evidence id is
  `ev_b1120ba492cbf77e5c433b7b8163a7a20a8b0f95ff81673a290baf6f84010cd0`.

REA independently located the upstream `WebSocket` request in `api.ts` at line 492, the
`fetch` calls at lines 137 and 318, and the non-retryable close codes 4401/4404 at lines 463 and
465. These are static observations: REA parses inert source and does not prove runtime execution.
The details below combine this evidence with direct read-only source inspection. No file in the
upstream project was modified.

The continued read-only pass pinned the server-side and recovery path to these source coordinates:

- `lingwu/server/events.py:39-126`: each thread has a 2000-event `Timeline` persisted as JSON;
  writes are coalesced for 0.3 seconds and use a temporary-file replace at lines 76-81.
- `lingwu/server/events.py:161-184`: `EventBus` fans out through per-client asyncio queues capped
  at 1000 messages and removes a subscriber whose queue is full.
- `lingwu/server/api.py:1961-2003`: `/ws` accepts first-frame authentication, sends a `hello`
  snapshot, runs a dedicated queue pump, closes authentication failures with 4401, and unsubscribes
  in `finally`. The ten-second authentication deadline is at lines 2070-2084.
- `lingwu/server/api.py:609-619`: persisted history is available through
  `GET /api/threads/{id}/events` with `limit`, `before`, and `has_more` pagination.
- `lingwu/server/webui.py:373-404`: the first text delta creates `stream_start`, every delta emits
  `delta` under that stream id, and completion emits `stream_end` before the persisted assistant
  event replaces the temporary bubble.
- `web/src/store.tsx:433-452` reduces those three stream frames; lines 607-620 batch a WebSocket
  burst into one render; lines 669-674 reload the active timeline after reconnect.
- `web/src/api.ts:463-522` maps 4401 to authentication, 4404 to a terminal gone state, and uses
  500 ms exponential retry capped at 15 seconds for other closes. Its `onopen` also resets the
  attempt at line 496, which has the same open-then-close retry pathology the local implementation
  now avoids by resetting only after bytes arrive.
- `web/src/screens/ChatScreen.tsx:119-138` uses the 120 px follow threshold and 400 px **Latest**
  threshold; lines 156-157 use `ResizeObserver` to account for content that grows after render.

## Upstream design observed in LingWu

The upstream implementation uses a WebSocket event bus and a persisted timeline:

- `lingwu/server/events.py`: each thread has an ordered `Timeline` JSON log, retained to 2000
  events and written after a 0.3 second coalescing delay. `EventBus` fans out to `asyncio.Queue`
  subscribers with a 1000-message buffer; a full queue drops the slow subscriber.
- `lingwu/server/api.py`: `WS /ws` authenticates in the first frame, sends a `hello` state
  snapshot, and closes with 4401 for authentication failure. Historical events are available from
  `GET /api/threads/{id}/events` with pagination.
- `lingwu/server/webui.py`: the first text delta creates a stream id and emits `stream_start`,
  every subsequent chunk emits `delta`, and completion emits `stream_end`. The persisted assistant
  event reuses the stream id when available.
- `web/src/store.tsx`: reducers append deltas to a live stream, replace it with the persisted
  assistant event, batch WebSocket messages into one dispatch, and reload the active timeline after
  a WebSocket reconnect.
- `web/src/api.ts`: the socket token travels in the first frame instead of the URL. Reconnect delay
  starts near 500 ms, doubles to a 15 second cap, and stops for close codes 4401 (authentication)
  and 4404 (the runtime is gone).
- `web/src/screens/ChatScreen.tsx`: renders the partial assistant bubble; pins to the bottom within
  120 px, shows the **Latest** button only beyond 400 px, and uses `ResizeObserver` to correct
  heights added after the first render. Its polite live region announces the start and the whole
  completed reply, never every token.

That design is simple and effective, but a WebSocket reconnect can only recover by reloading the
timeline. A delta lost before persistence has no sequence number with which to request the exact
suffix. The implementation here keeps the same UX model while making the transport replayable. The
mobile client also mirrors the upstream scroll thresholds and rehydrates thread history after a
recovered connection so non-text cards missed during the gap are restored.

## Current architecture

```text
model / agent
     |
     | AG-UI events (RUN_STARTED, TEXT_MESSAGE_*, RUN_FINISHED, RUN_ERROR)
     v
ConversationAgent.run
     |
     | middleware tap (agent.use)
     v
ConversationStream ledger -- persisted tail --> Store
     |                                   |
     | live fan-out                      | replay by sequence
     v                                   v
GET /api/conversation/stream/:threadId (SSE)
     |
     | fetch/ReadableStream in a browser, XHR progress in React Native
     v
SSE parser -> sequence gate -> draft reducer -> chat reconciliation
```

The ledger is a mirror, not a second model call. The CopilotKit runtime remains responsible for
model execution and Rich Threads persistence. The mirror observes the exact AG-UI events that the
runtime is about to transport, so event order and error semantics are preserved.

CopilotKit clones an agent for every request. `ConversationAgent.clone()` therefore reuses the base
clone and copies its constructor dependencies, which preserves middleware such as the stream tap.
Without that, the direct transport would still work while the SSE ledger stayed empty.

## Server protocol

### Endpoint

```http
GET /api/conversation/stream/:threadId
Accept: text/event-stream
Last-Event-ID: 42
```

`?after=42` is accepted when `Last-Event-ID` is absent. The header takes precedence. The owner is
resolved by the existing authenticated Hono middleware; the ledger key is `owner + threadId`.

### SSE frames

The route sends an initial retry hint:

```text
retry: 3000

```

It then emits a `ready` control frame before any replay:

```text
event: ready
data: {"protocol":1,"reset":false,"replayFrom":42,"active":true,"lastEventId":43,"oldestEventId":1,"eventCount":43,"run":{"runId":"...","status":"running",...}}
```

Each AG-UI event is wrapped in an `agui` frame whose SSE `id` is the ledger sequence:

```text
id: 44
event: agui
data: {"threadId":"...","seq":44,"ts":"2026-10-17T...","runId":"...","event":{"type":"TEXT_MESSAGE_CONTENT","messageId":"...","delta":"Hello"}}
```

An attachment failure is reported as a terminal control frame:

```text
event: stream_error
data: {"message":"The live reply channel is unavailable."}
```

The server sends an SSE comment heartbeat every 15 seconds. Comment frames do not create client
messages but keep proxies and the client watchdog from treating an idle connection as dead.

### Replay and reset rules

- `after` is a ledger sequence number, not a byte offset. It restores the exact event suffix after
  a dropped connection, including all text deltas.
- A fresh connection with no cursor follows the currently active run from its first retained
  event. If the run is longer than the retention window and its RUN_STARTED has been evicted,
  replay starts at the oldest retained event instead of the current tail, so a reload still
  reconstructs the visible part of the live answer. If the thread is idle, live delivery starts
  at the current tail; the persisted message history remains the source of truth for older turns.
- A cursor inside the retained window receives only `seq > after` in order.
- A cursor ahead of the ledger, older than the retained window, non-integer, or otherwise invalid
  triggers `ready.reset = true` and replays the retained tail (or the active run from its start).
  The client clears its previous drafts and cursor before applying that replay.
- Retention is 2000 events or 8 MiB of UTF-8 JSON per owner/thread, whichever is reached first.
  Dirty ledgers are coalesced and written to the existing `Store` under `conversation-streams`
  after 400 ms. A restart can therefore replay the recent tail. On load, events are filtered,
  sorted and deduplicated; only the newest contiguous suffix is exposed, and the publish cursor is
  derived from its last event. This prevents a stale or damaged persisted record from creating an
  internal sequence hole that would make every client resync forever.
- Fan-out is process-local. Multi-instance deployments need shared pub/sub (for example Redis or
  Postgres `LISTEN/NOTIFY`) in front of `ConversationStream.publish`.

### Backpressure and shutdown

The route stops sending and closes a connection when the consumer stops draining the stream rather
than allowing an unbounded server buffer. The client reconnects with its last applied id and catches
up from the ledger. `ConversationStream.close()` flushes dirty tails, clears subscribers, and is
invoked during server shutdown.

### Reverse proxy checklist

SSE requires an unbuffered response and a read timeout longer than the 15 second heartbeat. Keep
`Last-Event-ID` and `Authorization` on the request, and keep HTTP/1.1 or HTTP/2 enabled. The route
already sends `X-Accel-Buffering: no`, but the proxy configuration must still disable its own
buffers. A Caddy v2 example:

```caddyfile
chat.example.com {
  reverse_proxy 127.0.0.1:8787 {
    flush_interval -1
  }
}
```

The equivalent Nginx location:

```nginx
location /api/conversation/stream/ {
  proxy_pass http://127.0.0.1:8787;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 1h;
}
```

These snippets are deployment guidance, not evidence that a particular staging proxy has been
tested. Verify with `curl -N`, confirm frames arrive before the response ends, then kill one client
connection and reconnect with the last `id:` to check suffix replay.

## Client protocol

### Transport

- Browsers use `fetch()` plus `response.body.getReader()`. Headers include the bearer token and
  `Last-Event-ID` after the first successful event.
- React Native uses `XMLHttpRequest` progressive `responseText`, because its `fetch` does not
  reliably expose an incremental response body on every runtime. Because `responseText` would
  otherwise retain the whole session, the transport rotates at 1,048,576 characters and immediately
  resumes from `Last-Event-ID`.
- Both transports share one incremental parser. It handles arbitrary split chunks, LF/CRLF/lone CR,
  multi-line `data:`, comments, retry fields, and a final frame without a trailing blank line.
  Parser buffers are capped at 2 MB.

### Sequence gate and rendering

`applyEnvelope()` ignores duplicate or out-of-order sequence numbers. If it sees a hole, it sets
`resync` instead of applying a partial answer, then the hook immediately reconnects from the last
applied id; the server replays the missing suffix. Reconnection does not wait for the 45 second
watchdog when a hole is observed.

Text events accumulate into a draft keyed by `messageId`, so a later chunk never creates a second
assistant bubble. `RUN_FINISHED` marks the run's drafts complete and clears the active run;
`RUN_ERROR` does the same and exposes a retryable error.

### Reconnection and cleanup

- Exponential backoff starts at roughly 500 ms, caps at 15 seconds, includes jitter, and allows 12
  attempts. Authentication and missing-thread errors are non-retryable.
- The attempt counter resets only after the transport delivers bytes. A server or proxy that opens
  and immediately closes cannot keep every retry at the base delay.
- A 45 second heartbeat watchdog catches half-open connections that never emit a FIN.
- Every transport has a generation id. Callbacks from a connection that has already been replaced
  cannot mutate the new connection's state.
- Thread changes, disabling the hook, unmounts, manual retry, and reconnects abort the request and
  clear all timers. On a clean close the parser flushes a complete frame that lacked its trailing
  blank line before the next connection resets parser state.
- A manual retry button appears for a live-channel error; `stream_error` is surfaced without
  discarding already received text.

### Message integrity

`verifyDrafts()` compares completed drafts with persisted assistant messages:

- Matching by message id is authoritative.
- The runtime may persist an assistant message under a new id. Only the latest unclaimed persisted
  message with exactly the same trimmed text is accepted as a text fallback.
- A missing persisted counterpart is reported as pending while persistence catches up.
- A text mismatch is an integrity failure. The UI keeps/prefers the persisted text and shows a
  warning instead of displaying an unverified streamed answer.
- When no mismatch exists, the longer copy wins, so a lagging runtime transport cannot rewind text
  that the replayable SSE channel already delivered.

The chat also avoids duplicate bubbles by message id or verified text, follows new content only
when the user is already near the bottom, and announces stream start/completion through a polite
live region rather than announcing every token.

## Failure handling summary

| Failure | Behavior |
| --- | --- |
| Event sequence hole | Immediately reconnect from last applied id; server replays suffix |
| Network drop / half-open socket | Exponential backoff; 45 s watchdog; resume with `Last-Event-ID` |
| Cursor outside retained window | `ready.reset`; clear drafts and rebuild from retained tail |
| Auth expiry / missing thread | Stop retry loop and show the specific error |
| SSE parser partial frame | Buffer until a complete frame; bounded at 2 MB |
| Slow SSE consumer | Server closes instead of growing memory; client resumes from ledger |
| Runtime `RUN_ERROR` | Finish drafts, show error, offer retry |
| Persisted text differs from stream | Persisted text wins; integrity warning is shown |
| Process restart | Recent ledger tail is replayed from `Store` |

## Verification

Focused streaming suite (31 tests):

```sh
pnpm exec tsx --import ./tests/setup.ts --test \
  tests/conversation-stream.test.ts \
  apps/mobile/test/sse.test.ts \
  apps/mobile/test/conversation-stream.test.ts
```

Coverage includes:

- arbitrary SSE chunk boundaries, CRLF, multi-line data, comments, retry, final partial frame, and
  oversized-frame protection;
- text accumulation by message id, duplicate suppression, sequence-hole resync, run errors, reset,
  integrity matching/mismatch, and renamed persisted ids;
- exact suffix replay, active-run follow, retained-tail replay after the active run start was
  evicted, stale-cursor reset, restart persistence, persisted-ledger normalization, internal-hole
  recovery, `Last-Event-ID` routing, non-integer cursor rejection, UTF-8 byte retention, and 200
  concurrent subscribers with failed-subscriber cleanup;
- injected heartbeat and retry hints, byte-bounded slow-consumer disconnection with exact suffix
  recovery, and 200 dropped clients whose frames are re-chunked at arbitrary boundaries;
- a real loopback HTTP server with a dropped connection and a resumed suffix, in addition to the
  in-memory Hono route tests;
- a real HTTP AG-UI run through the local CopilotKit handler, verifying direct AG-UI streaming and
  the mirrored SSE ledger end to end.

Project checks:

```sh
pnpm typecheck
pnpm lint
```

In this workspace `pnpm test` cannot start because `tsx` creates a Unix IPC socket and the
sandbox denies `listen` for it. The same test files were therefore run with Node 22's
`--experimental-transform-types` and a temporary loader that resolves the app's extensionless
TypeScript imports. Result: 31 tests, 30 pass, 1 fail. The only failure is the real-loopback test,
which is blocked by `listen EPERM: operation not permitted 127.0.0.1` before any assertion runs.
All in-memory route, 200-subscriber, 200-rechunked-client, restart-persistence and end-to-end
CopilotKit tests pass. `pnpm typecheck` passes. `pnpm lint` passes with only the existing Biome
configuration schema-version notice (2.5.13 in `biome.json` versus CLI 2.5.15). Run the loopback
test outside the restricted sandbox to exercise the remaining socket path.

Not yet claimed as verified in this workspace: real-device 2G/lossy-network emulation or a real
staging reverse proxy. The local fault suite simulates dropped connections, arbitrary frame splits
and a slow consumer, but it does not emulate carrier radio behavior. Run a staging soak test with
representative mobile networks before treating those deployment scenarios as verified.

The API deployment is intentionally single-instance; the project README requires one API process
and PGlite cannot be opened by multiple processes. Stream fan-out, sequence assignment and retention
therefore stay process-local. Running multiple API replicas would require a shared pub/sub layer and
a shared per-thread sequence allocator; adding fan-out alone would not make that topology safe. This
repository does not claim multi-instance support.

## Relevant files

- `apps/server/src/engine/stream.ts`: ledger, retention, replay, persistence, fan-out.
- `apps/server/src/engine/stream-routes.ts`: authenticated SSE route, heartbeat, backpressure.
- `apps/server/src/agent.ts`: AG-UI middleware tap registration.
- `apps/server/src/engine/conversation.ts`: clone-safe stream middleware propagation.
- `apps/mobile/src/sse.ts`: incremental SSE parser.
- `apps/mobile/src/conversation-stream.ts`: transport, reconnect state, drafts, integrity checks.
- `apps/mobile/src/chat.tsx`: live bubble rendering, deduplication, scrolling, accessibility.
- `tests/conversation-stream.test.ts`, `apps/mobile/test/sse.test.ts`,
  `apps/mobile/test/conversation-stream.test.ts`: focused coverage.
