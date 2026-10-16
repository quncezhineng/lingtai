import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Auth } from "../apps/server/src/auth.ts";
import type { Config } from "../apps/server/src/config.ts";
import { createStore, type Store } from "../apps/server/src/db.ts";
import { AppError } from "../apps/server/src/errors.ts";

// 直接注入固定签名密钥，避免 createAuth 的文件系统副作用，专注会话语义。
let db: Store;
let auth: Auth;
const config = { mode: "sample", sessionTtlMs: 60_000 } as Config;

before(async () => {
  db = await createStore();
  auth = new Auth(db, config, "fixed-test-signing-key");
});
after(async () => {
  await db.close();
});

test("issue 签发可解析的会话令牌", async () => {
  const session = await auth.issue("user-1", "a@example.com", "Chrome");
  assert.equal(session.mode, "sample");
  assert.ok(session.expiresAt > Date.now());
  const profile = await auth.profile(`Bearer ${session.token}`);
  assert.equal(profile.owner, "user-1");
  assert.equal(profile.email, "a@example.com");
  assert.equal(profile.sessionId, session.sessionId);
});

test("profile 拒绝非法 / 伪造 / 已撤销的令牌", async () => {
  await assert.rejects(auth.profile(undefined), AppError);
  await assert.rejects(auth.profile("Bearer not-a-jwt"), AppError);
  const session = await auth.issue("user-2");
  const token = session.token;
  await auth.revokeSession("user-2", session.sessionId);
  await assert.rejects(auth.profile(`Bearer ${token}`), /Session expired/);
});

test("sessions 列出同一用户所有活跃会话（多端），不含已撤销与已过期", async () => {
  const owner = "multi-device-user";
  const phone = await auth.issue(owner, "a@example.com", "iPhone");
  const laptop = await auth.issue(owner, "a@example.com", "MacBook");
  const revoked = await auth.issue(owner, "a@example.com", "iPad");
  await auth.revokeSession(owner, revoked.sessionId);

  const active = await auth.sessions(owner);
  const ids = active.map((s) => s.id).sort();
  assert.deepEqual(ids, [phone.sessionId, laptop.sessionId].sort());
  // 每条会话都保留了设备标识与过期时间。
  for (const s of active) {
    assert.ok(s.device);
    assert.ok(s.expiresAt > Date.now());
  }
});

test("revokeSession 只能下线属于当前用户的会话", async () => {
  const a = await auth.issue("owner-a");
  const b = await auth.issue("owner-b");
  // 跨用户下线应失败且不影响目标会话。
  assert.equal(await auth.revokeSession("owner-a", b.sessionId), false);
  assert.ok((await auth.profile(`Bearer ${b.token}`)).owner === "owner-b");
  // 属于自己的会话可以下线。
  assert.equal(await auth.revokeSession("owner-a", a.sessionId), true);
  await assert.rejects(auth.profile(`Bearer ${a.token}`), /Session expired/);
});

test("退出登录（revoke）会立即作废当前令牌", async () => {
  const session = await auth.issue("signout-user");
  const token = session.token;
  await auth.revoke(`Bearer ${token}`);
  await assert.rejects(auth.profile(`Bearer ${token}`), /Session expired/);
});

test("会话过期后 profile 拒绝（TTL 生效）", async () => {
  const shortAuth = new Auth(
    db,
    { mode: "sample", sessionTtlMs: 1 } as Config,
    "fixed-test-signing-key",
  );
  const session = await shortAuth.issue("expired-user");
  // TTL 为 1ms，签发后立即过期（JWT 的 exp 秒级粒度会在下一次校验时拒绝）。
  await assert.rejects(shortAuth.profile(`Bearer ${session.token}`), /Session expired/);
});
