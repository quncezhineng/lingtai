/**
 * i18n 基础类型定义。
 *
 * 说明：
 * - 每种语言对应一个「扁平字典」，key 采用 `<命名空间>.<语义>` 的命名约定，
 *   例如 `app.navChat`、`chat.placeholder`。
 * - 英文（en）是唯一的事实来源（source of truth），简体中文（zh-Hans）必须与其
 *   保持完全一致的 key 集合（由编译期类型 + 单元测试双重保证）。
 */

/** 当前应用已接入的语言。 */
export type Locale = "en" | "zh-Hans";

/** 所有受支持的语言列表，顺序即切换按钮中的展示顺序。 */
export const LOCALES: readonly Locale[] = ["en", "zh-Hans"] as const;

/** 默认语言：设备语言为中文时用简体中文，否则回落英文。 */
export const FALLBACK_LOCALE: Locale = "en";

/** 语言偏好写入本地存储时使用的 key。 */
export const LOCALE_STORAGE_KEY = "lingwu.locale";

/** 一种语言的扁平字典。 */
export type Dictionary = Readonly<Record<string, string>>;

/** 文案插值参数，模板中使用 `{name}` 形式的占位符。 */
export type TranslateParams = Readonly<Record<string, string | number>>;

/** 语言在界面上的展示元信息。 */
export const LOCALE_LABELS: Record<Locale, { native: string; short: string; english: string }> = {
  en: { native: "English", short: "EN", english: "English" },
  "zh-Hans": { native: "简体中文", short: "中", english: "Simplified Chinese" },
};

/** 判断任意字符串是否是受支持的语言。 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
