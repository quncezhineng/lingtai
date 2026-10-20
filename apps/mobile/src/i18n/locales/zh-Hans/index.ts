import type { TranslationKey } from "../en";
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
 * 简体中文语言包。
 * `satisfies Record<TranslationKey, string>` 保证不会遗漏任何英文 key；
 * 专有名词 LingWu 统一译为「灵悟」。
 */
export const zhHans = {
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
} satisfies Record<TranslationKey, string>;

export default zhHans;
