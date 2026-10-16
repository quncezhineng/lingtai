import { createWorkerServer } from "./server.ts";

const token = process.env.WORKER_TOKEN ?? "";
/** 正整数环境变量的解析；非法或未设置时回退默认值。 */
const intEnv = (name: string, fallback: number) => {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const worker = await createWorkerServer({
  token,
  dataDir: process.env.WORKER_DATA_DIR ?? ".lingtai/browser-profiles",
  // 每个用户一个独立 Chromium 进程；多用户部署应提高这两个上限，避免
  // 用户数超过默认值时浏览器会话/档案被拒绝。默认值保持与旧版本一致。
  maxSessions: intEnv("WORKER_MAX_SESSIONS", 3),
  maxProfiles: intEnv("WORKER_MAX_PROFILES", 20),
  idleTimeoutMs: 30 * 60_000,
});
worker.server.listen(8790, process.env.WORKER_HOST ?? "127.0.0.1", () => {
  console.log("LingTai browser worker listening on port 8790");
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 30_000);
  deadline.unref();
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", () => {
  void stop();
});
process.on("SIGINT", () => {
  void stop();
});
