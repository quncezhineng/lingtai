import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { createApp } from "../apps/server/src/app.ts";
import type { Config } from "../apps/server/src/config.ts";
import { createStore, type Store } from "../apps/server/src/db.ts";

const providerKeys = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "DEEPSEEK_API_KEY",
  "MOONSHOT_API_KEY",
] as const;

let db: Store, server: Awaited<ReturnType<typeof createApp>>, directory: string, token: string;
let config: Config;
const headers = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
const request = (path: string, body?: unknown) =>
  server.app.request(path, {
    headers: headers(),
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
  });
const baseConfig = (): Config => ({
  mode: "sample",
  port: 8788,
  host: "127.0.0.1",
  publicUrl: "http://localhost:8788",
  dataDir: directory,
  agentBackend: "model",
  intelligenceApiKey: "test-project-key-never-sent",
  googleRedirectUri: "http://localhost:8788/api/google/callback",
  allowedOrigins: ["http://localhost:8081"],
});
const session = async (app: Awaited<ReturnType<typeof createApp>>) => {
  const response = await app.app.request("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 200);
  return (await response.json()).token as string;
};

const previousEnv = new Map<string, string | undefined>();

before(async () => {
  for (const key of providerKeys) previousEnv.set(key, process.env[key]);
  // Exactly one provider has a key: the picker must offer only that one.
  for (const key of providerKeys) delete process.env[key];
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
  directory = await mkdtemp(join(tmpdir(), "lingwu-model-switch-"));
  db = await createStore({ dataDir: join(directory, "db") });
  config = baseConfig();
  server = await createApp(db, config);
  token = await session(server);
});
beforeEach(async () => {
  // A fresh config and no saved choice keep a decision made in one test out of the next.
  await server.agent.stop();
  await db.remove("system", "settings", "model");
  config = baseConfig();
  server = await createApp(db, config);
});
after(async () => {
  await server?.agent?.stop();
  await db?.close();
  for (const [key, value] of previousEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("the model list requires a session", async () => {
  assert.equal((await server.app.request("/api/models")).status, 401);
});

test("only providers with a server key are offered, and the key never leaves the server", async () => {
  const response = await request("/api/models");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.model, null);
  assert.deepEqual(body.options, [
    {
      provider: "deepseek",
      label: "DeepSeek",
      models: ["deepseek/deepseek-chat", "deepseek/deepseek-reasoner"],
    },
  ]);
  assert.doesNotMatch(JSON.stringify(body), /test-deepseek-key/);
});

test("switching a model applies immediately and reaches the workspace snapshot", async () => {
  const response = await request("/api/model", { model: "deepseek/deepseek-reasoner" });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).model, "deepseek/deepseek-reasoner");
  assert.equal(config.model, "deepseek/deepseek-reasoner");

  const snapshot = await (await request("/api/workspace")).json();
  assert.equal(snapshot.runtime.model, "deepseek/deepseek-reasoner");
  assert.deepEqual(snapshot.runtime.modelOptions, [
    {
      provider: "deepseek",
      label: "DeepSeek",
      models: ["deepseek/deepseek-chat", "deepseek/deepseek-reasoner"],
    },
  ]);
});

test("a hand-written MODEL stays selectable next to the curated list", async () => {
  const custom = { ...baseConfig(), model: "deepseek/deepseek-flash" };
  const app = await createApp(db, custom);
  try {
    const options = await (
      await app.app.request("/api/models", { headers: await tokenFor(app) })
    ).json();
    assert.deepEqual(options.options[0].models, [
      "deepseek/deepseek-flash",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-reasoner",
    ]);
  } finally {
    await app.agent.stop();
  }
});

test("a model from a provider without a key is refused", async () => {
  const response = await request("/api/model", { model: "openai/gpt-5" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /openai\/gpt-5 is not available/);
  assert.equal(config.model, undefined);
});

test("an unknown model string is refused", async () => {
  assert.equal((await request("/api/model", { model: "not a model" })).status, 400);
});

test("a sample or AG-UI deployment cannot switch models", async () => {
  const sample = { ...baseConfig(), agentBackend: "sample" as const };
  const app = await createApp(db, sample);
  try {
    const authorization = await tokenFor(app);
    const options = await (await app.app.request("/api/models", { headers: authorization })).json();
    assert.deepEqual(options.options, []);
    const response = await app.app.request("/api/model", {
      method: "POST",
      headers: authorization,
      body: JSON.stringify({ model: "deepseek/deepseek-chat" }),
    });
    assert.equal(response.status, 400);
  } finally {
    await app.agent.stop();
  }
});

test("a choice made in the app is restored on the next start", async () => {
  const isolated = await mkdtemp(join(tmpdir(), "lingwu-model-restore-"));
  const store = await createStore({ dataDir: join(isolated, "db") });
  try {
    const first = { ...baseConfig(), dataDir: isolated };
    const app = await createApp(store, first);
    const response = await app.app.request("/api/model", {
      method: "POST",
      headers: await tokenFor(app),
      body: JSON.stringify({ model: "deepseek/deepseek-reasoner" }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    await app.agent.stop();

    const restarted = { ...baseConfig(), dataDir: isolated };
    const second = await createApp(store, restarted);
    assert.equal(restarted.model, "deepseek/deepseek-reasoner");
    await second.agent.stop();
  } finally {
    await store.close();
    await rm(isolated, { recursive: true, force: true });
  }
});

test("a saved choice for a provider whose key was removed falls back to MODEL", async () => {
  await db.put("system", "settings", { id: "model", model: "deepseek/deepseek-reasoner" });
  const previous = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const fallback = { ...baseConfig(), model: "moonshot/kimi-latest" };
    const app = await createApp(db, fallback);
    try {
      assert.equal(fallback.model, "moonshot/kimi-latest");
    } finally {
      await app.agent.stop();
    }
  } finally {
    process.env.DEEPSEEK_API_KEY = previous;
  }
});

/** Signs in on a secondary app instance sharing the database. */
async function tokenFor(app: Awaited<ReturnType<typeof createApp>>) {
  const value = await session(app);
  return { Authorization: `Bearer ${value}`, "Content-Type": "application/json" };
}
