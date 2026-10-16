import assert from "node:assert/strict";
import { test } from "node:test";
import { EventType, type RunAgentInput } from "@ag-ui/core";
import { type BuiltInAgent, defineTool } from "@copilotkit/runtime/v2";
import { z } from "zod";
import { tanstackAgent } from "../apps/server/src/engine/tanstack-agent.ts";
import { chatCompletionsFixture, modelFixture } from "./helpers/model.ts";

const run = (agent: BuiltInAgent) => {
  const input: RunAgentInput = {
    threadId: "gateway-fixture",
    runId: "gateway-fixture-run",
    messages: [{ id: "m1", role: "user", content: "Use the tool once, then finish." }],
    state: {},
    tools: [],
    context: [],
    forwardedProps: {},
  };
  return new Promise<{ error?: string; finished: boolean; text: string }>((resolve) => {
    let error: string | undefined;
    let finished = false;
    let text = "";
    agent.run(input).subscribe({
      next: (event) => {
        if (
          (event.type === EventType.TEXT_MESSAGE_CHUNK ||
            event.type === EventType.TEXT_MESSAGE_CONTENT) &&
          "delta" in event &&
          typeof event.delta === "string"
        )
          text += event.delta;
        if (event.type === EventType.RUN_ERROR && "message" in event) error = String(event.message);
        if (event.type === EventType.RUN_FINISHED) finished = true;
      },
      error: (cause) => {
        if (error === undefined) error = String(cause);
        resolve({ error, finished: false, text });
      },
      complete: () => resolve({ error, finished, text }),
    });
  });
};

test("OPENAI_CHAT_COMPLETIONS routes a gateway through /chat/completions and keeps the tool loop intact", async (t) => {
  const previous = process.env.OPENAI_CHAT_COMPLETIONS;
  process.env.OPENAI_CHAT_COMPLETIONS = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_CHAT_COMPLETIONS;
    else process.env.OPENAI_CHAT_COMPLETIONS = previous;
  });
  let toolRuns = 0;
  const { requests } = await chatCompletionsFixture(t, (index) =>
    index === 0 ? { name: "note_step", arguments: { note: "step one done" } } : undefined,
  );
  const agent = tanstackAgent({
    model: "openai/fixture",
    maxSteps: 3,
    tools: [
      defineTool({
        name: "note_step",
        description: "Record a step note",
        parameters: z.object({ note: z.string() }),
        execute: async ({ note }) => {
          toolRuns++;
          return { recorded: note };
        },
      }),
    ],
    prompt: "Use the tool once, then finish.",
  });
  const outcome = await run(agent);
  assert.equal(outcome.error, undefined);
  assert.equal(outcome.finished, true);
  assert.ok(outcome.text.includes("Current state: empty."), "the final model reply arrived");
  assert.equal(toolRuns, 1, "the server tool executed exactly once");
  assert.ok(requests.length >= 2, "the tool result was sent back for a second model call");
  for (const request of requests) {
    assert.equal(request.path, "/v1/chat/completions", "gateway traffic uses Chat Completions");
  }
});

for (const provider of [
  { name: "deepseek", env: { baseUrl: "DEEPSEEK_BASE_URL", apiKey: "DEEPSEEK_API_KEY" } },
  { name: "moonshot", env: { baseUrl: "MOONSHOT_BASE_URL", apiKey: "MOONSHOT_API_KEY" } },
] as const) {
  test(`${provider.name}/model traffic uses Chat Completions on its own base URL and key`, async (t) => {
    let toolRuns = 0;
    const { requests } = await chatCompletionsFixture(
      t,
      (index) =>
        index === 0 ? { name: "note_step", arguments: { note: "step one done" } } : undefined,
      provider.env,
    );
    const agent = tanstackAgent({
      model: `${provider.name}/fixture`,
      maxSteps: 3,
      tools: [
        defineTool({
          name: "note_step",
          description: "Record a step note",
          parameters: z.object({ note: z.string() }),
          execute: async ({ note }) => {
            toolRuns++;
            return { recorded: note };
          },
        }),
      ],
      prompt: "Use the tool once, then finish.",
    });
    const outcome = await run(agent);
    assert.equal(outcome.error, undefined);
    assert.equal(outcome.finished, true);
    assert.ok(outcome.text.includes("Current state: empty."), "the final model reply arrived");
    assert.equal(toolRuns, 1, "the server tool executed exactly once");
    assert.ok(requests.length >= 2, "the tool result was sent back for a second model call");
    for (const request of requests)
      assert.equal(
        request.path,
        "/v1/chat/completions",
        "compatible providers use Chat Completions",
      );
  });

  test(`${provider.name}/model without ${provider.env.apiKey} reports a clear error`, async () => {
    const previousKey = process.env[provider.env.apiKey];
    delete process.env[provider.env.apiKey];
    try {
      const agent = tanstackAgent({
        model: `${provider.name}/fixture`,
        maxSteps: 1,
        tools: [],
        prompt: "Say hello.",
      });
      const outcome = await run(agent);
      assert.match(String(outcome.error), new RegExp(`${provider.env.apiKey} is not set`));
    } finally {
      if (previousKey !== undefined) process.env[provider.env.apiKey] = previousKey;
    }
  });
}

test("without the flag the OpenAI adapter keeps using the Responses API", async (t) => {
  const previous = process.env.OPENAI_CHAT_COMPLETIONS;
  delete process.env.OPENAI_CHAT_COMPLETIONS;
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_CHAT_COMPLETIONS;
    else process.env.OPENAI_CHAT_COMPLETIONS = previous;
  });
  const { requests } = await modelFixture(t, (index) =>
    index === 0 ? { name: "note_step", arguments: { note: "step one done" } } : undefined,
  );
  const agent = tanstackAgent({
    model: "openai/fixture",
    maxSteps: 3,
    tools: [
      defineTool({
        name: "note_step",
        description: "Record a step note",
        parameters: z.object({ note: z.string() }),
        execute: async () => ({ recorded: true }),
      }),
    ],
    prompt: "Use the tool once, then finish.",
  });
  const outcome = await run(agent);
  assert.equal(outcome.error, undefined);
  assert.equal(outcome.finished, true);
  for (const request of requests) {
    assert.equal(request.path, "/v1/responses", "the default wire format stays Responses");
  }
});
