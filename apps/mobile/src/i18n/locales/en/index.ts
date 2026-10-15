import type { Dictionary } from "../../types";
import agent from "./agent";
import app from "./app";
import chat from "./chat";
import common from "./common";
import computer from "./computer";
import details from "./details";
import screens from "./screens";
import status from "./status";
import threads from "./threads";
import tools from "./tools";
import ui from "./ui";

/**
 * 英文语言包 —— 全应用文案的唯一事实来源。
 * 新增文案时必须先在此处（或对应命名空间文件）登记 key，再补充其他语言。
 */
export const en = {
  ...common,
  ...app,
  ...ui,
  ...chat,
  ...agent,
  ...screens,
  ...status,
  ...details,
  ...computer,
  ...threads,
  ...tools,
} satisfies Dictionary;

/** 所有合法的文案 key，用于为 `t()` 提供编译期校验。 */
export type TranslationKey = keyof typeof en;

export default en;
