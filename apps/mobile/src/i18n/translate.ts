/**
 * 与框架无关的翻译内核。
 *
 * 这一层不依赖 React / React Native，因此可以被纯函数（如 relative-date）
 * 以及 Node 单元测试直接引用。
 */
import { en } from "./locales/en";
import { zhHans } from "./locales/zh-Hans";
import {
  FALLBACK_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
  type TranslateParams,
} from "./types";

/** 语言 -> 字典。 */
export const dictionaries: Record<Locale, Readonly<Record<string, string>>> = {
  en,
  "zh-Hans": zhHans,
};

/** 语言 -> BCP-47 标记，用于 Intl 日期时间格式化。 */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  "zh-Hans": "zh-CN",
};

/**
 * 当前生效语言。保存在模块作用域，让非 React 的纯函数（日期格式化等）
 * 也能拿到同一份语言状态；React 侧由 I18nProvider 负责同步。
 */
let activeLocale: Locale = FALLBACK_LOCALE;

/** 读取当前生效语言。 */
export function getActiveLocale(): Locale {
  return activeLocale;
}

/** 更新当前生效语言（由 I18nProvider 调用）。 */
export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

/** 当前生效语言的 BCP-47 标记。 */
export function activeLocaleTag(): string {
  return LOCALE_TAGS[activeLocale] ?? LOCALE_TAGS[FALLBACK_LOCALE];
}

/** 把 `{name}` 占位符替换为参数值；缺失的参数保持原样，便于排查。 */
export function formatTemplate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * 查表翻译。查找顺序：目标语言 -> 英文兜底 -> 原始 key。
 * 永不抛错，保证界面在任何情况下都有内容可渲染。
 */
export function translate(locale: Locale, key: string, params?: TranslateParams): string {
  const template = dictionaries[locale]?.[key] ?? dictionaries[FALLBACK_LOCALE][key] ?? key;
  return formatTemplate(template, params);
}

/** 读取设备/浏览器语言，仅用于首次访问时决定默认语言。 */
export function detectDeviceLocale(): Locale {
  try {
    const navigatorLike = (
      globalThis as {
        navigator?: { languages?: readonly string[]; language?: string };
      }
    ).navigator;
    const raw = navigatorLike?.languages?.[0] ?? navigatorLike?.language ?? "";
    if (typeof raw === "string" && raw.toLowerCase().startsWith("zh")) return "zh-Hans";
  } catch {
    // 拿不到环境语言时使用兜底语言。
  }
  return FALLBACK_LOCALE;
}

/**
 * 使用「当前生效语言」翻译，供不持有 React 上下文的纯函数使用
 * （例如相对时间、日期格式化、结果摘要）。语言切换后组件会重渲染，
 * 这些纯函数会被重新调用，因此同样能实时生效。
 */
export function tr(key: string, params?: TranslateParams): string {
  return translate(activeLocale, key, params);
}

/**
 * 领域枚举值（任务/行动/制品状态、类型、语气、配色等）-> 展示文案。
 *
 * 已登记的枚举走语言包（跟随语言切换）；未登记的值退回
 * 「下划线转空格 + 首字母大写」的通用处理，保证永远有内容可渲染。
 */
export function statusLabel(value: string): string {
  const key = `status.${value}`;
  if (key in dictionaries[FALLBACK_LOCALE]) return tr(key);
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * 统一智能体名称的展示：服务端默认返回英文原名（LingTai），
 * 在简体中文下必须显示为「灵台」。用户自定义过的名称（与英文原名不同）
 * 原样返回，避免覆盖用户数据。
 */
export function localizeAgentName(name?: string | null): string {
  const localized = tr("common.agentName");
  if (!name) return localized;
  return name === translate(FALLBACK_LOCALE, "common.agentName") ? localized : name;
}

/**
 * 首次进入应用时的语言决策：本地偏好 > 设备语言 > 英文兜底。
 * 纯函数，方便单元测试覆盖。
 */
export function resolveLocale(stored: string | null): Locale {
  return isLocale(stored) ? stored : detectDeviceLocale();
}

/** 偏好存储 key 的再导出，方便测试与 Provider 共用同一份常量。 */
export { LOCALE_STORAGE_KEY };
