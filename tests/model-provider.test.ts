import assert from "node:assert/strict";
import { test } from "node:test";
import { unknownProvider } from "../apps/server/src/engine/tanstack-agent.ts";

const spec = "mistral/mistral-large";

test("an unknown provider suggests the openai/ prefix only when a gateway is set", () => {
  const gateway = unknownProvider("mistral", spec, "https://gateway.test/v1");
  assert.match(gateway.message, /^Unknown provider "mistral" in "mistral\/mistral-large"\./);
  assert.match(gateway.message, /use "openai\/mistral\/mistral-large"\.$/);

  for (const baseUrl of ["", "  "])
    assert.doesNotMatch(unknownProvider("mistral", spec, baseUrl).message, /openai\//);
});

test("the unknown provider hint reads OPENAI_BASE_URL by default", () => {
  const previous = process.env.OPENAI_BASE_URL;
  try {
    delete process.env.OPENAI_BASE_URL;
    assert.doesNotMatch(unknownProvider("mistral", spec).message, /openai\//);
    process.env.OPENAI_BASE_URL = "https://gateway.test/v1";
    assert.match(unknownProvider("mistral", spec).message, /use "openai\//);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previous;
  }
});
