import type { Dictionary } from "../../types";

/**
 * 跨模块复用的通用文案（命名空间：common）。
 * key 必须与 locales/en/common.ts 完全一致。
 */
const common = {
  "common.agentName": "灵悟",
  "common.language": "语言",
  "common.changeLanguage": "切换语言",
  "common.currentLanguage": "当前语言：{language}",
  "common.close": "关闭",
  "common.cancel": "取消",
  "common.tryAgain": "重试",
  "common.back": "返回",
  "common.loading": "加载中…",
  "common.relativeJustNow": "刚刚",
  "common.relativeMinutesAgo": "{count} 分钟前",
  "common.relativeHoursAgo": "{count} 小时前",
} satisfies Dictionary;

export default common;
