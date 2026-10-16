# 全局名称替换修改清单（openmuse → lingtai）

替换规则：`openmuse`→`lingtai`、`openMuse`→`lingTai`、`OpenMuse`→`LingTai`、`OPENMUSE`→`LINGTAI`。

本次重命名共修改 **101** 个文件、338 处。

## 按变体统计

| 变体 | 替换后 | 处数 |
|---|---|---|
| `openmuse` | `lingtai` | 192 |
| `openMuse` | `lingTai` | 0 |
| `OpenMuse` | `LingTai` | 133 |
| `OPENMUSE` | `LINGTAI` | 13 |

## 修改文件明细（按路径排序）

| 文件 | openmuse | openMuse | OpenMuse | OPENMUSE |
|---|---|---|---|---|
| `.env.example` | 6 | 0 | 1 | 1 |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | 0 | 0 | 1 | 0 |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | 0 | 0 | 1 | 0 |
| `.github/workflows/ci.yml` | 1 | 0 | 0 | 0 |
| `.gitignore` | 1 | 0 | 0 | 0 |
| `CHANGELOG.md` | 0 | 0 | 1 | 0 |
| `CONTRIBUTING.md` | 1 | 0 | 2 | 0 |
| `LICENSE` | 0 | 0 | 1 | 0 |
| `README.md` | 22 | 0 | 12 | 3 |
| `ROADMAP.md` | 0 | 0 | 1 | 0 |
| `SECURITY.md` | 1 | 0 | 3 | 0 |
| `apps/computer/Dockerfile` | 3 | 0 | 0 | 0 |
| `apps/computer/e2b-desktop-smoke.test.ts` | 1 | 0 | 0 | 0 |
| `apps/computer/files.py` | 1 | 0 | 0 | 0 |
| `apps/computer/smoke.test.ts` | 3 | 0 | 0 | 0 |
| `apps/mobile/App.tsx` | 0 | 0 | 3 | 0 |
| `apps/mobile/README.md` | 0 | 0 | 4 | 0 |
| `apps/mobile/app.json` | 4 | 0 | 2 | 0 |
| `apps/mobile/assets/README.md` | 0 | 0 | 2 | 0 |
| `apps/mobile/package.json` | 1 | 0 | 0 | 0 |
| `apps/mobile/src/agent-ui.tsx` | 0 | 0 | 4 | 0 |
| `apps/mobile/src/chat.tsx` | 1 | 0 | 2 | 0 |
| `apps/mobile/src/details.tsx` | 0 | 0 | 2 | 0 |
| `apps/mobile/src/screens.tsx` | 0 | 0 | 1 | 0 |
| `apps/mobile/src/threads.tsx` | 0 | 0 | 1 | 0 |
| `apps/mobile/src/ui.tsx` | 0 | 0 | 2 | 0 |
| `apps/mobile/test/jev-actions.test.ts` | 0 | 0 | 2 | 0 |
| `apps/mobile/tsconfig.json` | 1 | 0 | 0 | 0 |
| `apps/server/src/agent.ts` | 0 | 0 | 2 | 0 |
| `apps/server/src/app.ts` | 0 | 0 | 4 | 0 |
| `apps/server/src/auth.ts` | 0 | 0 | 1 | 0 |
| `apps/server/src/browser-console.ts` | 0 | 0 | 2 | 0 |
| `apps/server/src/computer-backend.ts` | 3 | 0 | 0 | 0 |
| `apps/server/src/computer-e2b-desktop.ts` | 5 | 0 | 0 | 0 |
| `apps/server/src/computer.ts` | 4 | 0 | 0 | 0 |
| `apps/server/src/config.ts` | 2 | 0 | 2 | 2 |
| `apps/server/src/demo/entry.ts` | 2 | 0 | 1 | 0 |
| `apps/server/src/demo/model.ts` | 23 | 0 | 0 | 0 |
| `apps/server/src/engine/conversation.ts` | 0 | 0 | 1 | 0 |
| `apps/server/src/engine/model.ts` | 0 | 0 | 1 | 0 |
| `apps/server/src/engine/service.ts` | 0 | 0 | 2 | 0 |
| `apps/server/src/index.ts` | 0 | 0 | 1 | 0 |
| `apps/server/src/worker-entry.ts` | 0 | 0 | 1 | 0 |
| `apps/server/src/workspace.ts` | 0 | 0 | 1 | 0 |
| `apps/worker/README.md` | 1 | 0 | 2 | 0 |
| `apps/worker/package-lock.json` | 2 | 0 | 0 | 0 |
| `apps/worker/package.json` | 1 | 0 | 0 | 0 |
| `apps/worker/src/browser.ts` | 1 | 0 | 0 | 0 |
| `apps/worker/src/demo-entry.ts` | 0 | 0 | 1 | 0 |
| `apps/worker/src/index.ts` | 1 | 0 | 1 | 0 |
| `apps/worker/tests/close-resilience.test.ts` | 1 | 0 | 0 | 0 |
| `apps/worker/tests/fixture-worker.ts` | 1 | 0 | 0 | 0 |
| `apps/worker/tests/fixtures.ts` | 2 | 0 | 1 | 0 |
| `apps/worker/tests/lifecycle.test.ts` | 5 | 0 | 0 | 0 |
| `apps/worker/tests/run-docker.mjs` | 3 | 0 | 0 | 0 |
| `biome.json` | 1 | 0 | 0 | 0 |
| `docs/COMPUTER.md` | 7 | 0 | 4 | 0 |
| `docs/DEMO.md` | 3 | 0 | 10 | 0 |
| `docs/EXPERIENCE.md` | 0 | 0 | 3 | 0 |
| `docs/FEATURES.md` | 0 | 0 | 1 | 0 |
| `docs/OPENBOT-INTEGRATION.md` | 0 | 0 | 8 | 0 |
| `docs/README.md` | 0 | 0 | 2 | 0 |
| `docs/RICH-THREADS.md` | 0 | 0 | 2 | 0 |
| `docs/TELEMETRY.md` | 1 | 0 | 14 | 0 |
| `docs/VERIFICATION.md` | 3 | 0 | 1 | 0 |
| `docs/demos/jev-generative-ui.md` | 0 | 0 | 4 | 0 |
| `infra/compose.yaml` | 1 | 0 | 0 | 0 |
| `package.json` | 1 | 0 | 0 | 0 |
| `packages/backends/src/openbot.ts` | 0 | 0 | 1 | 0 |
| `packages/domain/src/jev.ts` | 0 | 0 | 1 | 0 |
| `packages/integrations/src/google.ts` | 2 | 0 | 0 | 0 |
| `packages/integrations/src/pdf.ts` | 0 | 0 | 1 | 1 |
| `packages/integrations/src/vault.ts` | 2 | 0 | 0 | 0 |
| `render.yaml` | 12 | 0 | 1 | 1 |
| `tests/agent-api.test.ts` | 1 | 0 | 2 | 0 |
| `tests/api.test.ts` | 1 | 0 | 0 | 0 |
| `tests/auth-startup.test.ts` | 2 | 0 | 0 | 0 |
| `tests/browser-fixture-runner.test.ts` | 3 | 0 | 0 | 0 |
| `tests/browser-imports-race.test.ts` | 1 | 0 | 0 | 0 |
| `tests/browser.test.ts` | 6 | 0 | 0 | 0 |
| `tests/computer-api.test.ts` | 1 | 0 | 0 | 0 |
| `tests/computer-e2b-desktop.test.ts` | 6 | 0 | 0 | 0 |
| `tests/computer-runner.test.ts` | 1 | 0 | 0 | 5 |
| `tests/config.test.ts` | 3 | 0 | 1 | 0 |
| `tests/conversation-jev.test.ts` | 0 | 0 | 1 | 0 |
| `tests/demo-model.test.ts` | 8 | 0 | 0 | 0 |
| `tests/engine.test.ts` | 1 | 0 | 0 | 0 |
| `tests/helpers/browser.ts` | 1 | 0 | 0 | 0 |
| `tests/helpers/computer.ts` | 1 | 0 | 0 | 0 |
| `tests/jev.test.ts` | 0 | 0 | 2 | 0 |
| `tests/model-outcome.test.ts` | 1 | 0 | 0 | 0 |
| `tests/model-worker.test.ts` | 6 | 0 | 0 | 0 |
| `tests/monitor-recovery.test.ts` | 1 | 0 | 0 | 0 |
| `tests/persistence.test.ts` | 2 | 0 | 0 | 0 |
| `tests/prepare-lease-loss.test.ts` | 1 | 0 | 0 | 0 |
| `tests/rate-limit.test.ts` | 1 | 0 | 0 | 0 |
| `tests/resource-ids.test.ts` | 2 | 0 | 0 | 0 |
| `tests/rich-threads.test.ts` | 1 | 0 | 0 | 0 |
| `tests/search.test.ts` | 1 | 0 | 0 | 0 |
| `tests/telemetry.test.ts` | 1 | 0 | 2 | 0 |
| `tests/workflows.test.ts` | 2 | 0 | 0 | 0 |

## 保留未替换的项

- `docs/DEMO.md` 中指向外部历史发布包的链接 `https://github.com/jerelvelarde/openmuse/releases/download/v0.1.0-alpha/openmuse-demo.mp4`（指向真实存在的旧项目归档，替换会破坏链接）。
- `assets/openmuse-demo.mp4` 为二进制视频文件（文件名不纳入内容替换，二进制内部字符串不适用文本替换）。

## 预先存在的本地修改（与本次重命名无关，未统计入上表）

- `apps/mobile/src/browser-tool-card.tsx`
- `apps/mobile/src/jev-tool-card.tsx`
- `apps/mobile/src/mail-tool-card.tsx`

## 验证结果

- `pnpm lint`（biome check）通过
- `pnpm typecheck`（root + mobile）通过
- `pnpm --dir apps/worker typecheck` 通过
- `pnpm build:server`（tsc -p tsconfig.build.json）通过
- `pnpm test` 483 个测试全部通过（483 pass / 0 fail）
- 文件权限/编码/目录结构均未改变；未重命名任何文件名