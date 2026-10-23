# 项目时间线与进度

> 本文件记录 LingWu（灵悟）项目的里程碑、进度跟踪与变更记录。
> 变更按时间倒序排列，最新变更在最上方。

## 变更记录

### 2026-10-23 · 旁聊操作入口由内联重命名改为紧贴按钮的下拉操作列表

**背景**

用户要求「svg 改为点击弹出小窗，可选择重命名、归档和删除」，随后进一步明确「删掉标题，换成小弹窗，弹窗要紧挨按钮——准确说是按钮下属的二级操作列表」：此前对话列表中旁聊行右侧的铅笔图标点击后直接进入内联重命名，交互单一；现改为点击铅笔弹出**紧贴按钮的下拉操作列表**（无标题栏），提供「重命名 / 归档 / 删除」三项操作。

**方案**

- 旁聊行的铅笔图标保留为独立的行内按钮（不嵌套在整行选中按钮内，避免 react-native-web 冒泡吞点击），点击时把 `pageX/pageY` 记作锚点，在其正下方弹出无标题栏的下拉菜单 `ThreadActionsMenu`；菜单超出右/下边缘时向回夹紧，避免溢出屏幕。
- 菜单内三个操作项：
  - **重命名**：关闭菜单并复用既有的内联改名输入框（`editingId`/`draft` 逻辑不变）。
  - **归档**：调用 `useThreads` 的 `archiveThread(id)`；成功后若被归档的正是当前选中对话，自动切回主对话。
  - **删除**：CopilotKit `deleteThread` 为不可恢复的永久删除，菜单内先进入确认步骤（红色警示 + 取消按钮），确认后才真正删除；删除后若正是当前选中对话，同样切回主对话。
- 点击菜单外部任意处（透明背板）关闭菜单；菜单面板自身拦截点击冒泡，避免误关。

**实现**

- [shell.tsx](../apps/mobile/src/shell.tsx)：
  - 新增 `MenuAction`（操作行）与 `ThreadActionsMenu`（无标题下拉菜单，`Modal` + 透明背板 + 绝对定位卡片，含删除二次确认态）。
  - `ChatsColumn` 新增 `menuAnchor` 状态（记录坐标 `x/y` 与目标线程 `id`）与 `renameFromMenu` / `archiveFromMenu` / `deleteFromMenu` 处理逻辑；旁聊行 `onStartEdit` 改为透传铅笔按钮点击坐标并打开菜单。
  - `ThreadRow` 的 `onStartEdit` 签名由 `() => void` 扩展为 `(x, y) => void`，铅笔按钮 `onPress` 读取 `e.nativeEvent.pageX/pageY` 传出。
  - 新增 `Archive`、`Trash2` 图标导入；`Modal`、`useWindowDimensions` 从 react-native 导入；移除不再使用的 `Sheet` 导入。
- [en/threads.ts](../apps/mobile/src/i18n/locales/en/threads.ts) / [zh-Hans/threads.ts](../apps/mobile/src/i18n/locales/zh-Hans/threads.ts)：新增 `threads.actions`、`threads.delete`、`threads.permanentlyDelete`、`threads.deleteConfirmTitle`、`threads.deleteConfirmNote` 中英双语键。

**验证**

- biome 检查无告警（自动格式化）；`pnpm typecheck` 通过；全量测试 555/555 通过。
- 影响面：仅宽屏外壳（窗口宽度 ≥ 900）对话列表栏的旁聊行交互；主对话、本地待建旁聊（无铅笔）不受影响；`ThreadsSheet`（小屏「更多」面板）既有交互保持不变。

**注意**

- 删除为永久操作，已在菜单内增加二次确认；归档后可从「更多 → 对话」面板中恢复。

### 2026-10-22 · 登录会话有效期由 24 小时延长至 7 天

**背景**

用户要求「延长用户登录有效期到一周」：此前登录会话默认 24 小时过期，登录后一天内未操作即需重新登录，改为 7 天。

**方案**

会话有效期由 `SESSION_TTL_MS` 环境变量控制（代码默认值兜底），统一将默认值与本地/部署配置全部改为 7 天（`604800000` ms），确保不因某处配置遗漏而回退到短有效期。

**实现**

- [auth.ts](../apps/server/src/auth.ts)：`ttl()` 默认值 `24 * 60 * 60 * 1000` → `7 * 24 * 60 * 60 * 1000`，注释同步。
- [config.ts](../apps/server/src/config.ts)：`sessionTtlMs` 字段注释更新为「默认 7 天」。
- [.env](../.env) / [.env.example](../.env.example)：启用并写入 `SESSION_TTL_MS=604800000`。
- [render.yaml](../render.yaml)：`lingwu-api` 服务 `SESSION_TTL_MS` 值 `"86400000"` → `"604800000"`（下一次部署生效）。
- [demo/entry.ts](../apps/server/src/demo/entry.ts)：demo 模式预置会话 `expiresAt` 同步改为 7 天。
- [FEATURES.md](../docs/FEATURES.md)：说明文字「default 24 hours」→「default 7 days」。

**验证**

- biome 检查无告警；`pnpm typecheck` 通过；全量测试 555/555 通过。
- 影响面：仅登录 JWT/session 的过期时长；已签发的会话在签发时按当时 TTL 计算，新配置对新登录会话生效。

**注意**

- Render 部署后需重新部署 `lingwu-api` 以应用新 `SESSION_TTL_MS`；本地直接重启 API 即可（.env 已生效）。
- demo 模式与 live 模式登录有效期保持一致的 7 天。

### 2026-10-22 · 研究产物数据支持代码块语法高亮

**背景**

用户要求在 iframe 渲染的研究产物详情页中为数据增加「HTML 语法渲染」（经确认是指**数据代码块高亮**）：产物数据里的 JSON、多行代码/长文本（如计划、对比数据）此前是转义后的纯文本，可读性差，希望按语法上色。

**方案**

维持「渲染后的网页」展示不变，在 [artifact-html.ts](../apps/mobile/src/artifact-html.ts) 内置一个零依赖的轻量 tokenizer 做语法高亮：所有内部文本仍先 `escapeHtml` 转义（安全不变），仅对有结构的文本按 token 分类包裹 span 上色。不引入任何外部高亮库/脚本，保证 iframe/WebView 跨端一致。

**实现**

- [artifact-html.ts](../apps/mobile/src/artifact-html.ts)：
  - 新增 `highlightJson`：把 `JSON.stringify(value, null, 2)` 输出拆成 key / string / number / boolean·null / 标点 5 类 token 上色（key 靠「后跟冒号」判定）。
  - 新增 `highlightCode`：多行/超长字符串（代码、Markdown 面板数据）拆成字符串 / 数字 / URL 3 类 token 上色。
  - `text(value, inline=false)`：块级默认下，含换行或超 120 字符的字符串渲染为深色 `pre.code` 代码块；对象/数组渲染为 `pre.code[data-lang=json]` 高亮 JSON；`inline=true`（表格单元格）仍走转义行内纯文本，避免嵌套撑坏布局（`renderCell` 改传 `true`）。
  - HTML 文档 `<style>` 新增 `pre.code` 深色代码块与 `tok-key/tok-str/tok-num/tok-bool/tok-punc/tok-url` 配色。

**验证**

- 根目录 `pnpm typecheck` 通过；biome 检查无告警。
- 全量测试 555/555 通过。
- 需在部署后实测：详情页中对象/数组字段显示为高亮 JSON 代码块；含换行的长字符串显示为深色代码块；表格单元格仍显示紧凑行内文本。

**注意**

- 无外部资源、无脚本，延续 iframe `sandbox=""` / WebView `about:srcdoc` 的安全渲染方式。
- 仅影响详情页展示，对话内联的产物标题行与右侧边栏不受影响。

### 2026-10-22 · 研究产物详情弹窗改为全屏

**背景**

用户反馈：点击对话里的研究产物标题行弹出的详情页（HTML 渲染网页）仍是一个居中的小弹窗（最大宽 790/1050、高 94%、圆角、带背板 padding），要求改为与整个网页相同大小，即全屏铺满。

**方案**

`Sheet` 是全部详情弹窗的公共组件（FileDetail/MailDetail/BrowserDetail 等共用），不能直接改基础样式。新增 `fullscreen` 属性，仅让研究产物详情使用：弹窗铺满整个视口（宽高 100%、去圆角、去边框、去背板 padding），紧凑屏（宽 < 600）分支同样统一为全屏（不再走底部抽屉样式、隐藏顶部拖动条）。

**实现**

- [ui.tsx](../apps/mobile/src/ui.tsx)：`Sheet` 新增可选属性 `fullscreen?: boolean`。为 true 时：背板 `padding: 0`；面板 `width/height/maxWidth/maxHeight: "100%"`、`borderRadius: 0`、`borderWidth: 0`；紧凑屏分支（`compact && !fullscreen`）与拖动条均被跳过；`ScrollView` 设 `flex: 1` + `contentContainerStyle.flexGrow: 1`，让内部内容撑满剩余空间。
- [HtmlPreview.web.tsx](../apps/mobile/src/HtmlPreview.web.tsx) / [HtmlPreview.native.tsx](../apps/mobile/src/HtmlPreview.native.tsx)：外层 View `flex: 1` 撑满，iframe（`height: 100%`）与 WebView（`flex: 1`）填满容器，替换原先固定高度 620。
- [details.tsx](../apps/mobile/src/details.tsx)：`ArtifactDetail` 由 `wide` 改为 `fullscreen`。

**验证**

- 根目录 `pnpm typecheck` 通过；biome 检查无告警。
- 全量测试 555/555 通过。
- 需在部署后实测：点击研究产物标题行 → 详情网页全屏铺满、HTML 内容自适应撑满、右上角关闭按钮正常。

**注意**

- 其他详情弹窗（文件/邮件/浏览器/任务等）未走 fullscreen 分支，仍保持居中弹窗样式，不受影响。

### 2026-10-22 · 文件产物右边栏「分对话显示」

**背景**

用户反馈右侧「文件产物」边栏把**所有对话**生成的产物与文件一股脑放在一起，要求：只能展示左侧当前对话对应的产物文件，分对话显示，互不混淆。

**方案**

通过「对话 thread ↔ 任务 task ↔ 产物/文件」链路做过滤。任务创建时由服务端记录发起对话的 `threadId`；客户端边栏只展示「threadId 匹配当前对话的任务」所关联的研究产物（`AgentArtifact.taskId`）与文件（`AgentTask.artifactIds`）。

**实现**

- [agent.ts](../packages/domain/src/agent.ts)：`AgentTask` 新增可选字段 `threadId?: string`（发起该任务的对话 id；由对话内委托创建的任务才有，独立入口创建的任务为空）。
- [service.ts](../apps/server/src/engine/service.ts)：`createTask(owner, raw, idempotencyKey?, held?, threadId?)` 新增第 5 个可选参数，持久化到任务的 `threadId` 字段。
- [conversation.ts](../apps/server/src/engine/conversation.ts)：对话内 3 处创建任务的入口全部传入当前对话 `input.threadId` —— `delegate_task` 工具执行、sample 兜底的文档任务、sample 兜底的 agent 任务（`sample(prompt, key, threadId?)` 签名同步扩展）。
- [chat.tsx](../apps/mobile/src/chat.tsx)：新增 `ThreadArtifactsPanel` 包装组件 —— 按当前 `threadId` 过滤出本级对话的任务集合，研究产物按 `artifact.taskId ∈ 任务 id 集合` 过滤，文件按任务 `artifactIds` 匹配，再交给原 `ArtifactsPanel` 渲染；`ChatScreen` 调用点从传全局 `w.files`/`agentWorkspace.artifacts` 改为传全量 + threadId 由包装组件过滤。

**验证**

- 根目录 `pnpm typecheck`（含 root `tsc --noEmit` 与 mobile 单独 typecheck）通过；biome 检查无告警。
- 全量测试 555/555 通过。
- 需在部署后实测：对话 A 生成的产物只出现在对话 A 的右侧边栏，对话 B 不受影响；旧任务（无 threadId）不再出现在任何对话边栏中。

**注意**

- 仅影响边栏展示；对话内联的产物标题行、任务详情卡片等展示逻辑不变。
- 独立入口（监视任务、想法采纳、REST 创建）创建的任务不带 threadId，不会混入任意对话的边栏。

### 2026-10-22 · 研究产物改为「标题行 + 点击弹出 HTML 详情页 + 文件产物边栏展示」

**背景**

用户在对话页中把结构化研究产物（`AgentArtifact`：计划/对比/财务/报告）展开成大量数据 div 的大卡片（原 `ArtifactCard`/`FinanceArtifact`，如财务 Svg 卡），希望改为：对话里只显示标题提示；点击标题弹出 HTML 渲染的网页查看详情；同时这些研究产物条目也要出现在右侧「文件产物」边栏中。经确认目标产物为**灵悟生成的研究产物**（`AgentArtifact`，`kind: plan/comparison/finance/report`）。

**实现**

- [artifact-html.ts](../apps/mobile/src/artifact-html.ts)（新增）：纯函数 `renderArtifactHtml(artifact)` —— 把研究产物渲染为**自包含静态 HTML 文档字符串**。无外部资源、无脚本、全部文本转义；通用数据按顶层字段渲染 `<table>`/`<dl>`/`<ul>`（数组截断 100 条）；财务产物专属「收入/支出/结余」统计卡 + 分类占比条形图 + 交易明细表。服务端不产出研究产物的 HTML 文件（`files.ts` 只处理 PDF），故由客户端生成。
- [HtmlPreview.web.tsx](../apps/mobile/src/HtmlPreview.web.tsx) / [HtmlPreview.native.tsx](../apps/mobile/src/HtmlPreview.native.tsx)（新增）：平台分支组件，Web 用 `<iframe srcDoc sandbox="" referrerPolicy="no-referrer">`、原生端用 react-native `WebView source={{ html }}`，安全渲染产物 HTML。
- [workspace.tsx](../apps/mobile/src/workspace.tsx)：`Detail` 联合类型新增 `{ type: "artifact"; artifact: AgentArtifact }`。
- [App.tsx](../apps/mobile/App.tsx)：detail 分发 key 新增 `detail.type === "artifact" ? detail.artifact.id` 分支。
- [details.tsx](../apps/mobile/src/details.tsx)：新增 `ArtifactDetail` 组件（`Sheet` + `HtmlPreview`，标题为产物标题、副标题为类型 + 日期）。
- [agent-ui.tsx](../apps/mobile/src/agent-ui.tsx)：`ArtifactCard` 重写为 `LinkRow` 紧凑标题行（标题 + 「类型 · 查看详情」，点击 `open({ type: "artifact" })`）；删除旧的展开式大卡片与整个 `FinanceArtifact` Svg 财务卡、`record`/`display` 辅助函数。对话 flow 与任务详情中的调用点自动生效。
- [chat.tsx](../apps/mobile/src/chat.tsx)：`ArtifactsPanel` 扩展数据源（新增 `artifacts`/`onOpenArtifact` props），面板按「研究产物 / 文件」两个分区渲染：研究产物行显示标题 + 「类型 · 创建时间」，点击打开 HTML 详情；文件行沿用原样。空态条件变为「files 与 artifacts 都为空」。
- i18n：新增 `chat.researchArtifacts`（研究产物 / Research outputs）、`chat.filesGroup`（文件 / Files）、`chat.artifactRow`（打开产物：{name} / Open artifact: {name}），以及 `agent.artifactOpenDetail`（查看详情）、`agent.artifactPreview`（研究产物预览 / Artifact preview）、`agent.artifactEmpty`、`agent.artifactTruncated`（截断提示，含 `{count}` 占位符），中英双语同步。

**验证**

- `pnpm --dir apps/mobile typecheck`（`tsc --noEmit`）通过。
- 全量测试 555/555 通过（含 i18n 中英 key 对等与占位符校验）。
- HTML 渲染需登录态下硬刷新后实测：对话中产物显示为标题行、点标题弹出详情网页、右侧边栏按分区列出研究产物与文件。

**注意**

- `agent.financeTracker`/`financeTrackerDetail`/`financeReadFromTransactions`/`financeTransactionsSummary` 等旧财务卡专属键现无 UI 引用（无害，未删除）。
- 财务统计卡复用的 `agent.financeIncome/Spending/Remaining`、`agent.whereMoneyWent`、`agent.viewTransactions` 等键仍被 `artifact-html.ts` 引用。

### 2026-10-22 · 对话页顶部按钮改为「展开文件产物右边栏」

**背景**

用户对对话页（`ChatScreen`）顶部的「新建侧边对话」加号按钮提出修改：改为点击展开右边栏，右边栏列表展示该对话生成的文件产物（工作区文件）。

**实现**

- [conversation-header.tsx](../apps/mobile/src/conversation-header.tsx) `ConversationHeader`：
  - 接口由 `onNewChat`/`newChatLabel` 改为 `onOpenFiles`/`filesOpen`/`filesLabel`；
  - 顶部图标由 `Plus`（新建侧边对话）改为 `FileText`（文件产物），选中态（`filesOpen`）高亮为 `colors.sky` 背景 + `colors.blueDark` 图标。
- [chat.tsx](../apps/mobile/src/chat.tsx) `ChatScreen`：
  - 移除 `useLingWuThread()` 解构中的 `start`，新增 `filesOpen` 状态（布尔，默认收起）；
  - header 传入 `onOpenFiles={() => setFilesOpen((open) => !open)}` 与语义化标签；
  - 新增覆盖式 `ArtifactsPanel` 组件：`position: absolute` 盖在聊天区右侧（宽 320 / `maxWidth` 85%），白底 + 左边框 + 阴影 + `elevation`；顶部标题「文件产物」与 ✕ 关闭按钮；正文按 `createdAt` 倒序列出 `w.files`（每个文件行显示名称、来源与大小、创建时间），点击行 `onOpen(file)` 打开文件详情；无文件时显示空态。
  - 交互与「点击背板关闭」保持一致：点击面板外的半透明遮罩（`Pressable`）收起面板；面板本体 `zIndex` 高于遮罩，内部点击不会误触遮罩关闭。
- i18n：新增 `chat.openArtifacts`（文件产物 / Files）、`chat.closeArtifacts`、`chat.artifactsEmptyTitle`、`chat.artifactsEmptyDetail`，中英双语同步；列表行无障碍标签复用 `chat.openAttachment`。

**验证**

- `pnpm --dir apps/mobile typecheck`（`tsc --noEmit`）通过。
- 全量测试 555/555 通过（含 i18n 中英 key 对等测试）。
- 面板展开/点击遮罩收起需登录态下硬刷新后实测。

**注意**

- 对话页顶部原「新建侧边对话」入口被替换；`threads.newSideChat`（新建侧边对话）现仅在 `ThreadsSheet` 侧栏中使用，如后续需要可在此处另行补充入口。

### 2026-10-22 · 详情弹窗支持「点击背板关闭」

**背景**

用户反馈：通知弹窗打开后（`NotificationsSheet` 经 `Sheet` 弹出），希望点击弹窗外任意处的深色背板（遮罩）也能关闭弹窗。

**核查**

此前代码中 `close` 仅由 ✕ 按钮（`onClose`）与 Escape 键（`ModalContent.js` 的 `closeOnEscape`）触发，不存在点击背板关闭的机制；`Sheet`/`Modal`/`modalShade` 均无背板点击 handler。

**实现**

[ui.tsx](../apps/mobile/src/ui.tsx) 的 `Sheet` 组件（所有详情弹窗的公共组件：通知 / 个性 / 委派 / 电脑 / 任务等）：

- 外层 `modalShade`（深色遮罩）由 `View` 改为 `Pressable`，`onPress={onClose}`——点击弹窗外任意处即关闭；
- 内层弹窗面板 `Pressable` 保留 `accessibilityViewIsModal`，并 `onPress={(e) => e.stopPropagation()}`——面板内任意点击（含空白区）不会冒泡到背板导致误关，面板内的按钮 / 滚动 / 底部抽屉拖动条等交互不受影响；
- 新增 `dismissOnBackdrop` 可选项（默认 `true`），个别需要防止误关的弹窗可传 `false` 关闭背板点击行为。

**验证**

- `tsc --noEmit`（apps/mobile）通过。
- Metro 运行中，`curl http://localhost:8081/apps/mobile/index.bundle?platform=web` 实测 bundle 已包含 `dismissOnBackdrop` 标识符（2 处）。
- 面板内点击不关闭、点击背板关闭的交互需登录态下硬刷新后实测。

**注意**

`Sheet` 是所有详情弹窗的公共组件，因此该行为对全部详情弹窗生效（点击遮罩即关闭为 RN Web 生态常见惯例）。若个别场景需要「点背板不可关闭」，传 `dismissOnBackdrop={false}` 即可。

### 2026-10-22 · 修复对话列表行点击无响应（嵌套按钮吞掉点击）

**背景**

用户反馈侧边栏「研究助手」会话行按钮点击没有反应，无法切换到该对话页。

**根因**

[shell.tsx](../apps/mobile/src/shell.tsx) 的 `ThreadRow` 把「点击标题改名」的内层 `Pressable` 嵌套在外层「选择对话」按钮内部。react-native-web 的 `PressResponder.onClick`（[PressResponder.js](../apps/mobile/node_modules/react-native-web/src/modules/usePressEvents/PressResponder.js)）始终调用 `event.stopPropagation()` 并只调用最近祖先 responder 的 onPress——点击标题区域时内层改名 handler 先触发并阻断冒泡，外层 `select()` 永远不执行，表现为「点击没反应」。Web 端已不可用，原生端也不符合「点击行应选中对话」的主流预期。

**修复**

- `ThreadRow` 重构：整行仅保留一个负责 `select()` 的按钮；改名入口改为行右侧独立铅笔图标（兄弟节点，不再嵌套），编辑态显示对勾保存/回车提交/失焦取消，与 `ThreadsSheet` 侧栏的「重命名 → 保存名称」交互一致。
- 内层不再有任何可点元素，点击标题任意区域都会命中外层按钮并切换对话。

**验证**

- `tsc --noEmit`（apps/mobile）通过。
- 全量测试 555/555 通过。
- `curl http://localhost:8081/apps/mobile/index.bundle?platform=web` 实测 bundle 已包含新代码（`Pencil`/`hitSlop`/`threads.saveName`）；登录页之外的真实点击需用户登录态下硬刷新确认。

**注意**

- 原生端交互变化：之前单击标题直接进入改名，现在单击标题选中对话、点铅笔改名。若希望在原生端保留「单击标题改名」，可后续按平台分支处理，但需注意双端一致性与本项目一贯的 UI 一致性偏好（此前用户曾要求平台内布局一致）。

### 2026-10-22 · 复核重复 key 报错：修复已生效，日志属历史/缓存

**背景**

用户再次从 trae-preview 控制台贴出 `Encountered two children with the same key, evidence-mail-fieldtrip`。

**核查（只排查，无代码改动）**

- 确认 10-20 修复 commit `b5c0931` 已入库，三个线程列表渲染点均带「列表内去重 + 跨列表互斥」：`shell.tsx`（`sideThreads`/`pendingThreads` + `seenSideIds`）、`threads.tsx`（`listedThreads`/`visitedPending` + `seenThreadIds`）、`App.tsx`（`visited` 经 Map 按 id 去重）。
- `curl http://localhost:8081/apps/mobile/index.bundle?platform=web` 实测 bundle 已包含修复标识符（`seenSideIds`×4 / `seenThreadIds`×4 / `visitedPending`×5），即 dev server 提供的是修复后代码。
- 其余 `key={*.id}` 渲染点（messages、toolCall、evidence、monitor、goal、notification 等）均非线程 id，不受 `evidence-mail-fieldtrip` 这类平台 slug 线程 id 影响。

**结论**

该报错是修复前页面产生的历史日志（React 警告随控制台保留、不自动清除），或 trae-preview 缓存了旧页面。清空控制台并硬刷新（清缓存重载）后不再出现；若刷新后仍复现，再按复现步骤追查。

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
