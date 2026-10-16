import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  browserWorkerUrl,
  type Config,
  readConfig,
  shadowedEnvKeys,
  supabaseAuthConfigured,
} from "../apps/server/src/config.ts";

const saved: Record<string, string | undefined> = {};
before(() => {
  for (const k of [
    "SESSION_TTL_MS",
    "CPK_INTELLIGENCE_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "WORKSPACE_MODE",
    "AGENT_BACKEND",
  ]) {
    saved[k] = process.env[k];
  }
});
after(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test("browserWorkerUrl 补全协议并保留已有协议", () => {
  assert.equal(browserWorkerUrl(undefined), undefined);
  assert.equal(browserWorkerUrl(""), undefined);
  assert.equal(browserWorkerUrl("localhost:8080"), "http://localhost:8080");
  assert.equal(browserWorkerUrl("https://worker.example.com"), "https://worker.example.com");
});

test("shadowedEnvKeys 识别环境变量覆盖 .env 的键", () => {
  assert.deepEqual(shadowedEnvKeys({ A: "1", B: "2" }, { A: "9" }), ["A"]);
  assert.deepEqual(shadowedEnvKeys({ A: "1" }, { A: "1" }), []);
});

test("supabaseAuthConfigured 需三要素齐全", () => {
  const base = {} as Config;
  assert.equal(supabaseAuthConfigured(base), false);
  assert.equal(
    supabaseAuthConfigured({
      supabaseUrl: "u",
      supabaseAnonKey: "a",
      supabaseServiceRoleKey: "s",
    } as Config),
    true,
  );
});

test("readConfig 解析会话 TTL", () => {
  process.env.CPK_INTELLIGENCE_API_KEY = "test-key";
  process.env.SESSION_TTL_MS = "1800000";
  const config = readConfig();
  assert.equal(config.sessionTtlMs, 1800000);
});

test("readConfig 拒绝非法的 SESSION_TTL_MS", () => {
  process.env.CPK_INTELLIGENCE_API_KEY = "test-key";
  process.env.SESSION_TTL_MS = "abc";
  assert.throws(() => readConfig(), /SESSION_TTL_MS must be a positive integer/);
});
