import "./config.ts";
import type { Config } from "./config.ts";

export interface ModelProvider {
  /** Prefix used in `MODEL=provider/model-id`. */
  id: string;
  label: string;
  /** Server-only env var that must be set before the provider is offered to the app. */
  key: string;
  /**
   * Curated, stable model IDs. Providers rename and retire models, so a name that
   * starts failing is fixed by editing this one list rather than the app.
   */
  models: string[];
}

export const modelProviders: ModelProvider[] = [
  { id: "openai", label: "OpenAI", key: "OPENAI_API_KEY", models: ["gpt-5", "gpt-5-mini"] },
  { id: "anthropic", label: "Anthropic", key: "ANTHROPIC_API_KEY", models: ["claude-sonnet-4.5"] },
  { id: "google", label: "Google", key: "GOOGLE_API_KEY", models: ["gemini-2.5-pro"] },
  {
    id: "deepseek",
    label: "DeepSeek",
    key: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  { id: "moonshot", label: "Moonshot", key: "MOONSHOT_API_KEY", models: ["kimi-latest"] },
];

export interface ModelChoice {
  provider: string;
  label: string;
  /** Full `provider/model-id` strings the app can select. */
  models: string[];
}

/** A provider is offered only once its key is set on the server; keys never reach the app. */
export function modelChoices(config: Config): ModelChoice[] {
  const choices = modelProviders
    .filter((provider) => process.env[provider.key]?.trim())
    .map((provider) => ({
      provider: provider.id,
      label: provider.label,
      models: provider.models.map((model) => `${provider.id}/${model}`),
    }));
  // A hand-written MODEL (gateway IDs, a brand-new name) stays selectable instead of
  // silently disappearing the first time someone opens the picker.
  const current = config.model?.trim();
  const group = current
    ? choices.find((choice) => choice.provider === current.split("/")[0])
    : undefined;
  if (current && group && !group.models.includes(current)) group.models.unshift(current);
  return choices;
}

export function isOfferedModel(config: Config, spec: string) {
  return modelChoices(config).some((choice) => choice.models.includes(spec));
}

/**
 * Chat, tasks and the health check all read `config.model` at call time, so applying a
 * choice retargets every path at once without restarting the server.
 */
export function applyModel(config: Config, spec: string) {
  config.model = spec;
}
