/**
 * 把研究产物（AgentArtifact）渲染成一张自包含的静态 HTML 页面字符串。
 *
 * 该字符串直接交给 HtmlPreview（Web 端 iframe `srcDoc` / 原生端 WebView）
 * 展示，因此不依赖任何外部资源、不包含任何脚本：所有文本均转义，
 * 只生成语义结构与内联样式，保证跨端渲染一致且安全。
 *
 * 财务产物（kind === "finance"）有专属的「收入/支出/结余」统计卡与
 * 分类占比条形图；其余产物（计划/对比/报告）按数据结构通用渲染。
 */
import type { AgentArtifact } from "../../../packages/domain/src/agent";
import { activeLocaleTag, statusLabel, tr } from "./i18n/translate";

/** 转义为 HTML 安全文本。 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * JSON 文本语法高亮：把 JSON.stringify 的输出拆成 key/string/number/boolean/null/
 * 标点五类 token，分别用 span 上色。输入必须是合法 JSON，内部文本仍全部转义。
 */
const JSON_TOKEN_RE =
  /("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)|([{}[\],:])/g;
function highlightJson(source: string): string {
  let out = "";
  let lastIndex = 0;
  for (const match of source.matchAll(JSON_TOKEN_RE)) {
    const index = match.index ?? 0;
    out += escapeHtml(source.slice(lastIndex, index));
    const [, str, num, bool, punc] = match;
    const token = str ?? num ?? bool ?? punc;
    let cls = "tok-punc";
    if (str) cls = source[index + match[0].length] === ":" ? "tok-key" : "tok-str";
    else if (num) cls = "tok-num";
    else if (bool) cls = "tok-bool";
    out += `<span class="${cls}">${escapeHtml(token)}</span>`;
    lastIndex = index + match[0].length;
  }
  return out + escapeHtml(source.slice(lastIndex));
}

/** 通用代码文本基础高亮：字符串、数字、URL 三类 token 上色，其余文本转义。 */
const CODE_TOKEN_RE = /("[^"]*"|'[^']*')|(-?\d+(?:\.\d+)?)|(https?:\/\/[^\s]+)/g;
function highlightCode(source: string): string {
  let out = "";
  let lastIndex = 0;
  for (const match of source.matchAll(CODE_TOKEN_RE)) {
    const index = match.index ?? 0;
    out += escapeHtml(source.slice(lastIndex, index));
    const [, str, num, url] = match;
    const token = str ?? num ?? url;
    const cls = str ? "tok-str" : num ? "tok-num" : "tok-url";
    out += `<span class="${cls}">${escapeHtml(token)}</span>`;
    lastIndex = index + match[0].length;
  }
  return out + escapeHtml(source.slice(lastIndex));
}

/**
 * 标量值/对象 -> 展示 HTML。
 *
 * 默认（块级）：
 * - 多行或超长的字符串（代码/Markdown 面板数据）用深色代码块 + 基础语法高亮；
 * - 对象/数组用 JSON 代码块 + 语法高亮。
 * `inline = true` 时（表格单元格等场景）一律走转义后的行内纯文本，避免嵌套撑坏布局。
 */
function text(value: unknown, inline = false): string {
  if (typeof value === "string") {
    if (!inline && (value.includes("\n") || value.length > 120)) {
      return `<pre class="code">${highlightCode(value)}</pre>`;
    }
    return escapeHtml(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    return escapeHtml(value.toLocaleString(activeLocaleTag(), { maximumFractionDigits: 2 }));
  }
  if (typeof value === "boolean") return value ? "✓" : "✗";
  if (value === null || value === undefined) return "—";
  const json = JSON.stringify(value, null, 2);
  return inline
    ? escapeHtml(json)
    : `<pre class="code" data-lang="json">${highlightJson(json)}</pre>`;
}

/** 领域字段名（下划线分隔）-> 人类可读标题。 */
function label(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return escapeHtml(spaced.charAt(0).toUpperCase() + spaced.slice(1));
}

/** 递归渲染一个任意值：数组 -> 表格/列表，对象 -> 键值表，标量 -> 文本。 */
function renderValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return `<span class="empty">${tr("agent.artifactEmpty")}</span>`;
    const samples = value.slice(0, 100);
    if (samples.every(isRecord)) {
      const keys = Array.from(new Set(samples.flatMap((row) => Object.keys(row))));
      return `<table>
        <thead><tr>${keys.map((key) => `<th>${label(key)}</th>`).join("")}</tr></thead>
        <tbody>${samples
          .map(
            (row) => `<tr>${keys.map((key) => `<td>${renderCell(row[key])}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody>
      </table>${value.length > 100 ? `<p class="note">${tr("agent.artifactTruncated", { count: value.length - 100 })}</p>` : ""}`;
    }
    return `<ul>${samples.map((item) => `<li>${renderValue(item)}</li>`).join("")}</ul>`;
  }
  if (isRecord(value)) {
    return `<dl>${Object.entries(value)
      .map(([key, item]) => `<dt>${label(key)}</dt><dd>${renderValue(item)}</dd>`)
      .join("")}</dl>`;
  }
  return text(value);
}

/** 表格单元格内联渲染：记录展开为紧凑键值串，避免表格里再嵌整张表。 */
function renderCell(value: unknown): string {
  if (Array.isArray(value)) return value.map(renderCell).join(", ");
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${label(key)}：${renderCell(item)}`)
      .join(" · ");
  }
  return text(value, true);
}

/** 金额（带货币样式的数字文本）。 */
function amount(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return text(value);
  return number.toLocaleString(activeLocaleTag(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 财务产物专属：收入/支出/结余统计卡 + 分类占比条形图 + 交易明细表。 */
function renderFinance(artifact: AgentArtifact): string {
  const data = artifact.data;
  const stat = (labelKey: string, value: unknown, accent = "") => `
      <div class="stat ${accent}">
        <div class="stat-label">${escapeHtml(tr(labelKey))}</div>
        <div class="stat-value">${amount(value)}</div>
      </div>`;
  const cards = [
    stat("agent.financeIncome", data.income),
    stat("agent.financeSpending", data.spending),
    stat("agent.financeRemaining", data.saved, "positive"),
  ].join("");
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const spending = Math.max(1, Number(data.spending) || 1);
  const bars = categories
    .map((category) => {
      const row = isRecord(category) ? category : {};
      const rowValue = Number(row.amount) || 0;
      return `
        <div class="bar-row">
          <span class="bar-name">${text(row.name ?? "—")}</span>
          <div class="bar"><div class="bar-fill" style="width:${Math.min(100, (rowValue / spending) * 100)}%"></div></div>
          <span class="bar-value">${amount(rowValue)}</span>
        </div>`;
    })
    .join("");
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  return `
    <section class="stats">${cards}</section>
    ${bars ? `<section class="block"><h2>${escapeHtml(tr("agent.whereMoneyWent"))}</h2>${bars}</section>` : ""}
    <section class="block"><h2>${escapeHtml(tr("agent.viewTransactions"))}</h2>${renderValue(transactions)}</section>`;
}

/** 通用产物渲染：按顶层字段逐一渲染数据块。 */
function renderGeneric(artifact: AgentArtifact): string {
  return Object.entries(artifact.data)
    .map(
      ([key, value]) =>
        `<section class="block"><h2>${label(key)}</h2>${renderValue(value)}</section>`,
    )
    .join("");
}

/** 生成研究产物的完整 HTML 文档。 */
export function renderArtifactHtml(artifact: AgentArtifact): string {
  const kind = statusLabel(artifact.kind);
  const createdAt = new Date(artifact.createdAt);
  const dateText = Number.isNaN(createdAt.getTime())
    ? "—"
    : createdAt.toLocaleString(activeLocaleTag(), {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  const body = artifact.kind === "finance" ? renderFinance(artifact) : renderGeneric(artifact);
  return `<!DOCTYPE html>
<html lang="${activeLocaleTag()}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(artifact.title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #EFF1F5; color: #1C2026;
    font: 14px/1.6 -apple-system, "PingFang SC", "Segoe UI", "Microsoft YaHei", sans-serif;
  }
  .page { max-width: 780px; margin: 24px auto; background: #FFF; border-radius: 16px; padding: 28px 32px; box-shadow: 0 8px 30px rgba(16,24,40,.08); }
  .chip { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #E0E7FF; color: #3730A3; font-size: 12px; font-weight: 600; }
  h1 { margin: 10px 0 4px; font-size: 22px; line-height: 1.35; }
  .meta { margin: 0 0 18px; color: #7A8087; font-size: 13px; }
  .summary { margin: 0 0 22px; padding: 14px 16px; background: #F7F8FA; border-left: 3px solid #6366F1; border-radius: 8px; color: #3A4048; white-space: pre-wrap; }
  .block { margin-top: 24px; }
  .block h2 { margin: 0 0 12px; padding-bottom: 6px; font-size: 16px; border-bottom: 1px solid #E5E7EB; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .stat { padding: 14px 16px; border-radius: 12px; background: #F4F5F7; }
  .stat-label { color: #7A8087; font-size: 12px; }
  .stat-value { margin-top: 4px; font-size: 20px; font-weight: 700; color: #1C2026; }
  .stat.positive .stat-value { color: #059669; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #E9EBEE; text-align: left; vertical-align: top; }
  th { background: #F7F8FA; font-weight: 600; color: #555B63; white-space: nowrap; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0; }
  dt { color: #7A8087; font-weight: 600; }
  dd { margin: 0; }
  ul { margin: 0; padding-left: 20px; }
  li + li { margin-top: 6px; }
  .bar-row { display: grid; grid-template-columns: minmax(90px, 22%) 1fr 90px; align-items: center; gap: 12px; margin: 8px 0; }
  .bar-name { font-size: 13px; color: #3A4048; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 8px; border-radius: 6px; background: #E8EAF0; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #4F46E5, #6366F1); }
  .bar-value { font-size: 13px; font-weight: 600; text-align: right; }
  .empty { color: #9CA3AF; }
  .note { color: #9CA3AF; font-size: 12px; }
  pre { margin: 0; padding: 10px 12px; background: #F3F4F6; border-radius: 8px; overflow: auto; font-size: 12px; }
  /* 产物数据里的 JSON / 代码 / 长文本：深色代码块 + 语法高亮配色 */
  pre.code { margin: 0; padding: 12px 14px; background: #1F2430; color: #D7DAE0; border-radius: 10px; overflow: auto; font: 12px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  pre.code .tok-key { color: #C792EA; }
  pre.code .tok-str { color: #C3E88D; }
  pre.code .tok-num { color: #F78C6C; }
  pre.code .tok-bool { color: #82AAFF; }
  pre.code .tok-punc { color: #7A8189; }
  pre.code .tok-url { color: #82AAFF; text-decoration: underline; }
  @media (max-width: 560px) {
    .page { margin: 0; border-radius: 0; padding: 18px; }
    .stats { grid-template-columns: 1fr; }
    .bar-row { grid-template-columns: 1fr 1fr; grid-template-rows: auto auto; }
    .bar-value { grid-column: 2; text-align: left; }
  }
</style>
</head>
<body>
  <main class="page">
    <span class="chip">${escapeHtml(kind)}</span>
    <h1>${escapeHtml(artifact.title)}</h1>
    <p class="meta">${escapeHtml(dateText)}</p>
    ${artifact.summary ? `<p class="summary">${escapeHtml(artifact.summary)}</p>` : ""}
    ${body}
  </main>
</body>
</html>`;
}
