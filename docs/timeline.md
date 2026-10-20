# 项目时间线与进度

> 本文件记录 LingWu（灵悟）项目的里程碑、进度跟踪与变更记录。
> 变更按时间倒序排列，最新变更在最上方。

## 变更记录

### 2026-10-20 · 修复控制台 5 条日志（嵌套按钮 + 重复 key + ERR_ABORTED）

**背景**

trae-preview 控制台出现 5 条日志：2 条嵌套 button 报错、1 条重复 key（`evidence-mail-fieldtrip`）、2 条 `net::ERR_ABORTED`。

**根因与处理**

| 日志 | 根因 | 处理 |
|------|------|------|
| 2× `In HTML, <button> cannot be a descendant of <button>` | React 19 的嵌套校验扩展到 `role="button"`：ThreadRow 外层整行是按钮，内层「重命名」Pressable 也设了 `accessibilityRole="button"`，Web 端渲染为 `div role="button"` 嵌套，触发告警 | [shell.tsx](../apps/mobile/src/shell.tsx)：去掉内层 Pressable 的 `accessibilityRole`（保留 onPress），渲染为普通 div + onClick，交互不变 |
| 1× 重复 key `evidence-mail-fieldtrip` | 10-19 的去重只做了列表**内部**去重；当本地待建旁聊首次上线服务端列表的短暂窗口，同一 id 会同时出现在 `sideThreads` 与 `pendingThreads`（同一 ScrollView 的兄弟节点），以及 ThreadsSheet 的 `listedThreads` 与 `visitedPending`，跨列表重复 key | [shell.tsx](../apps/mobile/src/shell.tsx)：`pendingThreads` 增加 `seenSideIds.has(item.id)` 排除；[threads.tsx](../apps/mobile/src/threads.tsx)：先算 `listedThreads`，`visitedPending` 再按 `seenThreadIds` 跨列表排除 |
| 2× `net::ERR_ABORTED /api/agent`、`/api/workspace` | 正常中断：`/api/agent` 每 3 秒轮询被新请求取代或页面切换时，浏览器取消在途请求；已 `catch(() => {})` 静默处理 | 无需改动（浏览器正常行为） |

**验证**

- `tsc --noEmit`（apps/mobile）通过。
- 移动端测试 65/65 通过。
- 修复均为纯前端防御性调整：嵌套 button 去掉内层角色、跨列表按 id 互斥去重，不改变线程数据与任何交互行为。

**备注**

`app.renameChatLabel` 翻译键因去掉内层按钮的无障碍标签而暂时无引用，与 `app.sideChat` 一样可作后续清理的技术债。

**反思（2026-10-20 晚）**

本轮修复此前只停留在工作区、未提交（`git status` 显示 App.tsx / shell.tsx / threads.tsx / timeline.md 为 Modified），因此用户再次看到同样的 `evidence-mail-fieldtrip` 重复 key 报错——已部署/旧 bundle 版本不包含修复。当晚将三处渲染去重（shell / ThreadsSheet / App.tsx visited 按 id 去重）连同本期变更记录整理为单个 commit `b5c0931` 推送至 main。教训：**前端修复完成后必须及时提交并推送，否则线上（Render 自动部署来源）仍会复现旧问题**；同时确认所有线程列表渲染点均已覆盖去重（shell.tsx sideThreads/pendingThreads、threads.tsx listedThreads/visitedPending、App.tsx visited Map 去重）。

### 2026-10-20 · 保存设置去除按钮动效，改为弹窗提示已保存

**背景**

「保存偏好设置」与「记住」两个按钮在保存中（`busy` 状态）会显示加载转圈动画、并整体降低透明度，产生“文字动态效果”。用户希望点击保存时消除该动态效果，改为在最上层弹窗提示“已保存”。

**实现**

- [ui.tsx](../apps/mobile/src/ui.tsx)：`Button` 新增 `quietBusy` 可选项——`busy` 时保持原有防重复点击能力，但不再渲染 `ActivityIndicator`、不再降低透明度，文字保持静止。
- [agent-ui.tsx](../apps/mobile/src/agent-ui.tsx)：`AgentPersonalitySheet` 的「保存偏好设置」「记住」两个按钮改用 `busy + quietBusy`；保存成功后不再使用底部 toast 的 `notify`，改为经 `Modal` 弹出的居中「已保存」圆角卡片（对勾图标 + 文案），约 1.6 秒自动关闭；提示文案复用已有 i18n 键 `agent.saved`（已保存 / Saved）。

**验证**

- `npx tsc --noEmit`（apps/mobile）通过，无类型错误。
- `vitest run`：11 个测试文件全部通过（含 i18n 完整性检查，本次未新增翻译键）。
- Web bundle 编译 200 正常。

### 2026-10-19 · 修复会话列表重复 key 报错

**背景**

浏览器控制台反复出现 React 真实报错：

```
Encountered two children with the same key, `evidence-mail-fieldtrip`.
Keys should be unique so that components maintain their identity across updates.
```

**根因**

- `evidence-mail-fieldtrip` 是 CopilotKit 运行时/平台随机生成的服务端线程 id（三词连字符 slug 风格），并非项目代码生成的字符串——代码库中不存在任何 `evidence-` 前缀拼接。
- CopilotKit `useThreads` 首屏列表（`listSucceeded`）直接采用服务端返回的线程数组、不做去重（去重仅发生在翻页合并 `upsertThread` 时）。当运行时在首屏返回同 id 两条记录时，`ChatsColumn`（[shell.tsx](../apps/mobile/src/shell.tsx)）与 `ThreadsSheet`（[threads.tsx](../apps/mobile/src/threads.tsx)）的 `key={thread.id}` 渲染即冲突。
- 主线程 id（`/api/main-thread` 返回 `randomUUID()`）与本地新建线程（`newThreadId()` UUID v4）均非 slug 格式，进一步确认重复 id 来自运行时/平台侧数据。

**实现**

- [shell.tsx](../apps/mobile/src/shell.tsx)：`sideThreads` 与 `pendingThreads` 渲染前按 id 去重（保留首个）。
- [threads.tsx](../apps/mobile/src/threads.tsx)：`ThreadsSheet` 新增 `visitedPending` 与 `listedThreads` 两个去重后的列表，替换原两个 `.map()` 的渲染源；空态判断改用 `listedThreads.length`。

**验证**

- `npx tsc --noEmit`（apps/mobile）通过，无类型错误。
- 修复为纯前端防御性去重，不改变线程数据本身与任何交互行为；重复记录仅影响列表展示。

### 2026-10-19 · 添加网站 logo 与 favicon

**背景**

用户提供 `apps/mobile/assets/logo.png`（48×48）与 `logo.svg`（紫色圆角方底 `#4F46E5` + 白色折线图形），要求用作网站（Web 端）的 logo 与浏览器标签页图标。

**实现**

- [app.json](../apps/mobile/app.json)：`web.favicon` 指向 `./assets/logo.png`（供 `/favicon.ico` 服务与导出使用），并新增 `web.lang: "zh"`、`web.themeColor: "#4F46E5"`。
- [public/index.html](../apps/mobile/public/index.html)（新增）：Expo SDK 54 的自定义 HTML 模板（读取项目 `public/index.html`，优先级高于内置模板），在 `<head>` 加入 favicon 链接——SVG 优先、PNG 兜底、apple-touch-icon；保留 `%WEB_TITLE%` / `%LANG_ISO_CODE%` 占位符、`expo-reset` 样式与 `#root` 挂载点。项目根目录的 `index.html`（早期尝试）SDK 54 并不读取，已删除。
- [public/favicon.svg](../apps/mobile/public/favicon.svg)（新增）：复制自 `assets/logo.svg`，作矢量 favicon 静态资源。
- [public/favicon.png](../apps/mobile/public/favicon.png)（新增）：复制自 `assets/logo.png`，作 PNG 兜底 favicon 静态资源。
- 修正头像资源扩展名：[ui.tsx](../apps/mobile/src/ui.tsx) 的 `AVATAR_SOURCES` 六张照片头像在 `assets/` 下实际均为 `avatar1.png`~`avatar6.png`（此前误引 `.jpg`，导致 Web 打包 `Unable to resolve "../assets/avatar1.jpg"`），已统一为 `.png`；同步更正 [agent-ui.tsx](../apps/mobile/src/agent-ui.tsx) 注释与 [assets/README.md](../apps/mobile/assets/README.md)。

**验证**

- Web 打包通过（`Web Bundled … 2779 modules`）。
- `curl http://localhost:8081`：HTML 输出 `<html lang="zh">`、三条 favicon 链接（svg/png/apple-touch-icon）、`<meta name="theme-color" content="#4F46E5">`、`<title>` 等于 `web.name`。
- `curl -I /favicon.svg` → 200 image/svg+xml；`/favicon.png` → 200 image/png；`/favicon.ico` → 200 image/x-icon（由 Expo 从 `web.favicon` 自动生成）。

### 2026-10-19 · 头像模板由三色水豚换成六张照片头像

**背景**

智能体偏好设置里的头像选择原本是「天空蓝 / 沙色 / 淡紫」三款水豚涂装（同一张 `capybara.png` 配不同底色）。用户希望换成 `assets/avatar1.png`~`avatar6.png` 六张照片头像，供用户选择设置。

**实现**

- 领域类型 [agent.ts](../packages/domain/src/agent.ts)：`identity.avatar` 由 `"sky" | "sand" | "lilac"` 改为 `"avatar1"`~`"avatar6"`。
- 服务端校验 [routes.ts](../apps/server/src/engine/routes.ts)：`POST /identity` 的 `avatar` 枚举同步更新为新六值。
- 头像渲染 [ui.tsx](../apps/mobile/src/ui.tsx)：`Mascot` 新增 `AVATAR_SOURCES` 照片映射，`variant` 命中 `avatar1`~`avatar6` 时渲染圆形照片；未传值或旧版 `sky/sand/lilac` 历史值仍回退默认水豚涂装，保证旧数据不破图。
- 选择器 [agent-ui.tsx](../apps/mobile/src/agent-ui.tsx)：`AgentPersonalitySheet` 改为 `AVATAR_OPTIONS` 六张头像，默认 `avatar1`；`normalizeAvatar` 兼容旧值。
- i18n：[status.ts](../apps/mobile/src/i18n/locales/zh-Hans/status.ts) 与英文版删除 `status.sky/sand/lilac`，新增 `status.avatar1`~`status.avatar6`（头像 1~6 / Avatar 1~6）。
- 测试与文档：更新 [i18n.test.ts](../apps/mobile/test/i18n.test.ts) 枚举清单、[agent-api.test.ts](../tests/agent-api.test.ts) 用例值、[EXPERIENCE.md](../docs/EXPERIENCE.md) 与 [assets/README.md](../apps/mobile/assets/README.md)。

**验证**

- `pnpm typecheck` 通过（含移动端 `tsc --noEmit`）。
- `pnpm test` 全部 551 项通过（含服务端 `/identity` 枚举校验与 i18n key 完整性校验）。

### 2026-10-18 · 修复对话页 `Unexpected text node` 控制台报错

**背景**

Web 预览（`localhost:8081`，react-native-web）控制台反复出现：

```
Unexpected text node: . A text node cannot be a child of a <View>.
```

冒号后为空，说明某个 `<View>` 收到了空字符串子节点。`react-native-web` 在开发模式会遍历 children，发现 `typeof child === "string"` 即输出该警告。

**根因**

[chat.tsx](../apps/mobile/src/chat.tsx) 中：

```tsx
const integrityWarning = integrity.mismatched.length ? t("chat.streamIntegrityWarning") : "";
...
{integrityWarning && (<Text>{integrityWarning}</Text>)}
```

无数据校验冲突时 `integrityWarning` 为 `""`，`"" && JSX` 求值为 `""`，被 React 当作文本节点渲染进消息列表 `ScrollView`（内部是 `View`），因此每次渲染都会报错。

**实现**

- 改为 `{!!integrityWarning && (...)}`：空串时求值为 `false`，React 不再渲染任何节点。
- 同步审计移动端其余 `{变量 && JSX}` 条件渲染，确认其余变量均为 `boolean`、对象、`string | null | undefined`（不会产生空串），无需改动。

**验证**

- `apps/mobile` 下 `npm run typecheck` 通过。
- 该改动只影响开发期警告，不改变任何可见 UI 或业务行为；刷新 `http://localhost:8081` 即可确认警告消失。

### 2026-10-18 · 项目定位全局重构为「个人投研智能体」

**背景**

将 LingWu（灵悟）的整体定位从「给今天留一点余地」的生活/通用助理，重构为「个人投研智能体」。范围包括介绍标题、对话模板、灵感模板、目标任务、功能定位等全部用户可见文案，统一为金融投研口径。

**实现**

- 介绍标题：[app.ts](../apps/mobile/src/i18n/locales/zh-Hans/app.ts) 与英文包同步修改 `app.webTitle` / `app.welcomeTitle` / `app.welcomeSubtitle`，及各页签标题与副标题（灵感、目标、数据源、浏览器、文件）定位为投研场景。
- 对话模板：[chat.ts](../apps/mobile/src/i18n/locales/zh-Hans/chat.ts) 修改空态标题/副标题与三条建议按钮文案；[chat.tsx](../apps/mobile/src/chat.tsx) 中前两条建议按钮的硬编码 `enqueue` 提示同步改为投研提示（「分析一只股票的近期走势」「梳理一份财报的核心信息」）。
- 灵感模板：[agent.ts](../apps/mobile/src/i18n/locales/zh-Hans/agent.ts) 修改灵感空态、委派占位符（研报/持仓/研究计划）。
- 目标任务：[agent.ts](../apps/mobile/src/i18n/locales/zh-Hans/agent.ts) 修改目标空态、追踪占位符、分类（宏观研究 / 个股研究 / 组合与交易）。
- 功能定位：[screens.ts](../apps/mobile/src/i18n/locales/zh-Hans/screens.ts) 修改首页 Hero、助手提示、文件/活动副标题。
- README 顶部标语改为中英双语投研定位。

**验证**

- `pnpm typecheck` 通过。
- i18n 单测 15/15 通过（含中英 key 对齐、占位符一致、专有名词「灵悟」译名校验）。

**备注（未纳入本次范围）**

浏览器 Demo 场景（`apps/server/src/demo/` 下的 Hacker News / CopilotKit / 水族馆郊游示例及对应 `tests/demo-model.test.ts`、`docs/DEMO.md`）属独立的交互演示流，未在本次「定位文案重构」范围内，如需一并改为投研示例可另行处理。

### 2026-10-18 · 删除保存按钮动效，改为保存后弹窗提示

**背景**

「个性与记忆」弹窗里的「保存偏好设置」「记住」两个保存按钮，原先点击时有按压缩放、保存中淡入、保存完成脉冲等动画。用户希望删除这些点击动效，改为保存成功后弹出「已保存」提示。

**实现**

- [ui.tsx](../apps/mobile/src/ui.tsx)：`Button` 组件移除全部 `Animated` / `Easing` 动效（按压缩放、保存中淡入、完成脉冲、透明度过渡），恢复为简单 `Pressable`；保留禁用/保存中的静态透明度与保存中的加载指示器，按压时仅做静态透明度反馈，不再有动画。
- [agent-ui.tsx](../apps/mobile/src/agent-ui.tsx)：`AgentPersonalitySheet` 的 `save` 成功后调用 `notify(t("agent.saved"))` 弹出提示。
- 新增 i18n key `agent.saved`（中文「已保存」/ 英文「Saved」）。

**验证**

- `yarn typecheck` 通过。
- 保存按钮点击不再有缩放/脉冲动画，保存成功后底部弹出「已保存」提示。

### 2026-10-18 · 删除头像右上角红色数字角标

**背景**

宽屏左侧图标栏顶部头像右上角原本显示未读数量的红色数字角标（`pending > 0` 时出现），用户希望删除该角标。

**实现**

在 [shell.tsx](../apps/mobile/src/shell.tsx) 的 `Rail` 组件中，删除头像 `Mascot` 外层包裹的 `position: relative` 容器及其中 `pending > 0` 的红色角标块，头像现在直接渲染。`pending` 参数仍保留，供底部「通知」入口的 `badge` 使用。

**验证**

- `yarn typecheck` 通过（无诊断错误）。
- 头像不再显示红色数字角标。

### 2026-10-18 · 删除「更多」按钮与「刷新工作区」入口

**背景**

宽屏左侧图标栏底部的「更多」菜单在上一步已仅剩「刷新工作区」一项，用户希望直接删除该按钮及菜单入口，让底部只保留「通知 → 语言 → 我的」。

**实现**

在 [shell.tsx](../apps/mobile/src/shell.tsx) 的 `Rail` 组件中：

- 删除「更多」`RailItem` 及其触发的 `Modal` 菜单弹层；
- 删除「刷新工作区」菜单项，以及不再使用的 `menuRow` 辅助函数；
- 清理相关状态与引用：`menuOpen`、`anchor`、`trigger`、`showMenu`、`refresh`（来自 `useWorkspace`），以及 `MoreHorizontal`、`RefreshCw`、`Modal`、`useRef`、`useWindowDimensions` 等导入。

**验证**

- `yarn typecheck` 通过（无诊断错误）。
- 左侧栏底部现为「通知 → 语言 → 我的」，「更多」及「刷新工作区」已移除。

### 2026-10-18 · 通知与语言移出「更多」菜单

**背景**

宽屏左侧图标栏里，「通知」与「语言」原先收纳在底部「更多」菜单中，需要多点一级才能触达。

**实现**

在 [shell.tsx](../apps/mobile/src/shell.tsx) 的 `Rail` 底部，把「通知」与「语言」移出菜单，直接放在「我的」上方：

- 通知：复用 `RailItem`（铃铛图标 + 文字 + 未读角标），点击打开通知弹窗；
- 语言：给 [LanguageSwitcher.tsx](../apps/mobile/src/i18n/LanguageSwitcher.tsx) 新增 `vertical` 形态，渲染成竖排图标栏项（语言图标 + 「语言」文字），点击在按钮右上方弹出语言列表；
- 「更多」菜单现在只保留「刷新工作区」。

**验证**

- `yarn typecheck` 通过。
- Web 端浏览器实测：左侧栏底部顺序为「通知 → 语言 → 我的 → 更多」；通知带角标；「更多」菜单仅剩「刷新工作区」。

### 2026-10-18 · 保存按钮点击交互动效重构

**背景**

「个性与记忆」弹窗中的「保存偏好设置」按钮（以及其他所有复用 `Button` 组件的按钮）原先的点击反馈是静态的：按下时 `transform: scale(0.98)`、禁用/保存中时 `opacity: 0.5`，状态切换是瞬间跳变，缺少过渡。

**实现**

在 [ui.tsx](../apps/mobile/src/ui.tsx) 的 `Button` 组件中，改用 React Native 内置 `Animated` + `Easing`（原生驱动）实现三段动效：

| 状态 | 触发时机 | 视觉变化 | 时长 / 曲线 |
|------|----------|----------|-------------|
| 按压 | `onPressIn` | 缩放到 0.97 | 90ms，`Easing.out(Easing.cubic)` |
| 松开 | `onPressOut` | 弹簧回弹到 1 | `Animated.spring`（friction 6 / tension 180） |
| 保存中 | `busy` 变 true | 加载指示器淡入、整体透明度降到 0.75 | 180ms，`Easing.inOut(Easing.cubic)` |
| 保存完成 | `busy` 由 true 回 false | 一次轻微回弹脉冲（1 → 1.04 → 1） | 130ms 放大 + spring 回落 |

要点：

- 用 `Animated.createAnimatedComponent(Pressable)` 把透明度与缩放直接作用在按钮根节点，`useNativeDriver: true` 保证不阻塞 JS 线程，也不影响 `onPress` 里的保存接口请求。
- 禁用态透明度 0.4、保存中 0.75，均做平滑过渡而非瞬间跳变。

**验证**

- `yarn typecheck` 通过。
- Web 端（PC）浏览器实测：应用正常加载、「个性与记忆」弹窗正常打开、按钮可点击，点击后回到正常态、无崩溃。
- 备注：Web 端 `useNativeDriver` 会回退到 JS 动画（RN Web 无原生动画模块），功能正常仅性能略低；移动端原生环境下由原生驱动，保持 60fps 流畅。

### 2026-10-18 · 修复「获取对话历史报 Failed to fetch」

**问题现象**

前端 Web 端加载对话历史时，浏览器控制台报错：

```
Failed to fetch
```

对应的 SSE 流请求 `GET /api/conversation/stream/:threadId` 在浏览器网络面板中被标记为 `net::ERR_FAILED`。

**根因**

前端发起 SSE 流请求时携带了 `Cache-Control: no-cache` 请求头（见 [conversation-stream.ts](../apps/mobile/src/conversation-stream.ts) 的 `headers()` 函数）。该自定义请求头会触发浏览器的跨域预检（preflight）。但服务端 CORS 配置的 `allowHeaders` 未放行 `Cache-Control`，导致预检通过后实际请求仍被 CORS 拦截，最终表现为 `Failed to fetch`。

**修复**

在 [app.ts](../apps/server/src/app.ts) 的 CORS 配置中，将 `Cache-Control` 加入 `allowHeaders`：

```ts
allowHeaders: ["Content-Type", "Authorization", "Accept", "Last-Event-ID", "Cache-Control"],
```

**验证**

- 预检响应头 `access-control-allow-headers` 现包含 `Cache-Control`。
- 浏览器网络面板中 `/api/conversation/stream/:threadId` 由 `net::ERR_FAILED` 变为 `200`。
- 页面不再展示 `Failed to fetch`，对话历史正常回放。

### 2026-10-18 · 排查结论：其余报错为瞬时 / 可降级

修复 CORS 后，控制台曾短暂出现以下报错，经排查均非代码缺陷：

| 日志 | 真相 |
|------|------|
| `net::ERR_ABORTED /api/workspace`、`/api/agent` | 服务端热重载（`tsx watch`）重启时，在途请求被浏览器取消（瞬时） |
| `REST connect request failed: Failed to fetch` | CopilotKit 将底层 `ERR_CONNECTION_REFUSED` 包装为 "Failed to fetch" |
| `agent_connect_failed` / `agent_run_failed_event` / `Agent execution failed` | 连接未建立即触发运行失败事件的连锁反应 |

根因：修改 `app.ts` 触发 `tsx watch` 热重载，服务端重启的 1~2 秒内连接被拒绝。服务恢复后所有请求均返回 `200`，报错不再复现。

另外，`wss://realtime.intelligence.copilotkit.ai` 的 WebSocket 连接警告为 CopilotKit 云端（Intelligence）实时推送通道的间歇性网络失败，CopilotKit 内置优雅降级（最多重试 5 次后回退到 REST 轮询），不影响线程列表与记忆功能。
