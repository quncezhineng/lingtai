import "./config.ts";
import { HttpAgent } from "@ag-ui/client";
import {
  type AgentsFactory,
  type CopilotKitIntelligence,
  CopilotRuntime,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import type { Auth } from "./auth.ts";
import type { Config } from "./config.ts";
import { ConversationAgent } from "./engine/conversation.ts";
import type { AgentService } from "./engine/service.ts";
import type { ConversationStream } from "./engine/stream.ts";
import { createJevAdapter, type JevAdapter } from "./jev/adapter.ts";

export function agentConfigured(config: Config) {
  return (
    config.agentBackend === "sample" ||
    (config.agentBackend === "agui"
      ? Boolean(config.agentUrl)
      : Boolean(
          config.model &&
            (process.env.OPENAI_API_KEY ||
              process.env.ANTHROPIC_API_KEY ||
              process.env.GOOGLE_API_KEY ||
              process.env.DEEPSEEK_API_KEY ||
              process.env.MOONSHOT_API_KEY),
        ))
  );
}
export function makeRuntime(
  config: Config,
  service: AgentService,
  auth: Auth,
  intelligence: CopilotKitIntelligence,
  stream: ConversationStream,
) {
  // Built on first use, then shared so live mode reuses one TypeSafe client across requests.
  let jevAdapter: JevAdapter | undefined;
  const sharedJevAdapter = () => (jevAdapter ??= createJevAdapter(config));
  const agents: AgentsFactory = async ({ request }) => {
    const owner = await auth.owner(request.headers.get("authorization") ?? undefined);
    const agent =
      config.agentBackend === "sample"
        ? new ConversationAgent(config, service, owner, sharedJevAdapter())
        : config.agentBackend === "agui"
          ? new HttpAgent({
              url: config.agentUrl ?? "http://127.0.0.1:1/unconfigured",
              headers: config.agentToken ? { Authorization: `Bearer ${config.agentToken}` } : {},
            })
          : new ConversationAgent(config, service, owner, sharedJevAdapter());
    // Mirror the exact events the runtime is about to transport into the app-owned
    // ledger. This is a tap, not a second model call: ordering and errors are preserved.
    agent.use((input, next) => stream.observe(owner, input.threadId, input.runId, next.run(input)));
    return { default: agent };
  };
  const runtime = new CopilotRuntime({
    agents,
    intelligence,
    // The shared CopilotKit sink carries this tag onto existing PostHog events.
    telemetryProperties: { accessibility_title: "LingTai" },
    identifyUser: async (request) => ({
      id: await auth.owner(request.headers.get("authorization") ?? undefined),
      name: "LingTai user",
    }),
    generateThreadNames: false,
  });
  return createCopilotHonoHandler({ runtime, basePath: "/api/copilotkit" });
}
