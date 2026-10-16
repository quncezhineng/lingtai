import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimitStore, resolveClientKey } from "../apps/server/src/rate-limit.ts";

test("限流器在窗口内按 maxRequests 放行并拒绝超出部分", () => {
  const store = createRateLimitStore({ windowMs: 1000, maxRequests: 2, maxEntries: 10 });
  assert.equal(store.take("a", 0), true);
  assert.equal(store.take("a", 0), true);
  assert.equal(store.take("a", 0), false);
});

test("窗口过期后计数重置", () => {
  const store = createRateLimitStore({ windowMs: 1000, maxRequests: 2, maxEntries: 10 });
  store.take("a", 0);
  store.take("a", 0);
  assert.equal(store.take("a", 0), false);
  // now 达到窗口边界，旧条目被清理，重新计数。
  assert.equal(store.take("a", 1000), true);
});

test("达到 maxEntries 后拒绝新键，过期清理后恢复", () => {
  const store = createRateLimitStore({ windowMs: 1000, maxRequests: 5, maxEntries: 2 });
  assert.equal(store.take("k1", 0), true);
  assert.equal(store.take("k2", 0), true);
  assert.equal(store.take("k3", 0), false);
  // 越过窗口后，k1/k2 过期被清理，k3 可重新进入。
  assert.equal(store.take("k3", 1000), true);
});

test("resolveClientKey 仅在信任代理时读取转发头", () => {
  assert.equal(
    resolveClientKey({ trustProxy: true, forwardedFor: "1.2.3.4, 5.6.7.8" }),
    "proxy:1.2.3.4",
  );
  assert.equal(resolveClientKey({ trustProxy: true, realIp: "9.9.9.9" }), "proxy:9.9.9.9");
  assert.equal(
    resolveClientKey({ trustProxy: false, connectionAddress: "10.0.0.1" }),
    "conn:10.0.0.1",
  );
  assert.equal(resolveClientKey({ trustProxy: false }), "conn:unknown");
});
