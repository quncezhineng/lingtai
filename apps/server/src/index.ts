import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { readConfig } from "./config.ts";
import { createStore } from "./db.ts";

const config = readConfig();
const db = await createStore({
  dataDir: `${config.dataDir}/postgres`,
  databaseUrl: config.databaseUrl,
});
await db.recoverInterruptedActions();
const { app, agent, conversationStream } = await createApp(db, config);
if (config.taskWorkerEnabled) agent.start();
const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () =>
  console.log(`LingTai ${config.mode} API ready at ${config.publicUrl}`),
);
const shutdown = () => {
  server.close(() => {
    void agent
      .stop()
      .then(() => conversationStream.close())
      .then(() => db.close())
      .then(() => process.exit(0));
  });
  // SSE replies stay open by design, so `close()` alone would wait forever.
  (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
