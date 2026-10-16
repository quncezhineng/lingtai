import assert from "node:assert/strict";
import test from "node:test";
import { signJwt, verifyJwt } from "../apps/server/src/jwt.ts";

const secret = "test-secret-key-that-is-long-enough";
const now = Math.floor(Date.now() / 1000);

test("signJwt/verifyJwt round-trips claims", () => {
  const claims = { sub: "user-1", email: "a@example.com", jti: "jti-1", iat: now, exp: now + 3600 };
  const token = signJwt(claims, secret);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const verified = verifyJwt(token, secret);
  assert.equal(verified?.sub, "user-1");
  assert.equal(verified?.jti, "jti-1");
  assert.equal(verified?.email, "a@example.com");
});

test("verifyJwt rejects a tampered payload", () => {
  const claims = { sub: "user-1", jti: "jti-1", iat: now, exp: now + 3600 };
  const token = signJwt(claims, secret);
  const [header, _body, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...claims, sub: "user-2" })).toString("base64url");
  assert.equal(verifyJwt(`${header}.${forged}.${signature}`, secret), null);
});

test("verifyJwt rejects an expired token", () => {
  const claims = { sub: "user-1", jti: "jti-1", iat: now - 7200, exp: now - 3600 };
  assert.equal(verifyJwt(signJwt(claims, secret), secret), null);
});

test("verifyJwt rejects a token signed with a different secret", () => {
  const claims = { sub: "user-1", jti: "jti-1", iat: now, exp: now + 3600 };
  assert.equal(verifyJwt(signJwt(claims, secret), "another-secret"), null);
});

test("verifyJwt rejects malformed tokens", () => {
  assert.equal(verifyJwt("", secret), null);
  assert.equal(verifyJwt("not-a-jwt", secret), null);
  assert.equal(verifyJwt("a.b", secret), null);
  assert.equal(verifyJwt("a.b.c.d", secret), null);
});

test("verifyJwt rejects claims without required subject", () => {
  const token = signJwt({ jti: "x", iat: now, exp: now + 3600 } as never, secret);
  assert.equal(verifyJwt(token, secret), null);
});
