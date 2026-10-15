import type { Dictionary } from "../../types";

/**
 * 跨模块复用的通用文案（命名空间：common）。
 * 该文件由英文口径反向维护，简体中文见 locales/zh-Hans/common.ts。
 */
const common = {
  "common.agentName": "LingTai",
  "common.language": "Language",
  "common.changeLanguage": "Change language",
  "common.currentLanguage": "Current language: {language}",
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.tryAgain": "Try again",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.relativeJustNow": "Just now",
  "common.relativeMinutesAgo": "{count}m ago",
  "common.relativeHoursAgo": "{count}h ago",
} satisfies Dictionary;

export default common;
