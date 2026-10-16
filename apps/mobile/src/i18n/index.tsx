/**
 * 多语言运行时入口。
 *
 * - `<I18nProvider>` 负责持有当前语言、写入本地偏好，并把 `t()` 注入组件树。
 * - `useTranslation()` 是组件内获取 `t()` 的唯一方式，语言切换时会触发重渲染，
 *   因此界面上所有 `t()` 文案都会实时生效。
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { TranslationKey } from "./locales/en";
import { readStorage, writeStorage } from "./storage";
import { LOCALE_TAGS, resolveLocale, setActiveLocale, translate } from "./translate";
import { LOCALE_STORAGE_KEY, LOCALES, type Locale, type TranslateParams } from "./types";

export type { TranslationKey } from "./locales/en";
export {
  activeLocaleTag,
  getActiveLocale,
  localizeAgentName,
  runtimeLabel,
  statusLabel,
} from "./translate";
export type { Locale, TranslateParams };
export { LOCALE_STORAGE_KEY, LOCALES };
export type TranslationFn = (key: TranslationKey, params?: TranslateParams) => string;

/**
 * Web 端把当前语言同步到 `<html lang>` 与浏览器标签页标题，
 * 让无障碍读屏与搜索引擎拿到正确的语言标记；原生端没有 document，
 * 静默跳过（不抛错、不影响渲染）。
 */
function syncDocumentLocale(locale: Locale) {
  try {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return;
    doc.documentElement.lang = LOCALE_TAGS[locale] ?? locale;
    doc.title = translate(locale, "app.webTitle");
  } catch {
    // 受限环境（SSR / 无 document）下忽略。
  }
}

export type I18n = {
  /** 当前语言。 */
  locale: Locale;
  /** 所有受支持的语言。 */
  locales: readonly Locale[];
  /** 切换语言：立即生效并写入本地存储。 */
  setLocale: (locale: Locale) => void;
  /** 翻译函数。 */
  t: TranslationFn;
};

/** 首次进入应用时解析语言：本地偏好 > 设备语言 > 英文兜底。 */
const bootLocale: Locale = resolveLocale(readStorage(LOCALE_STORAGE_KEY));
setActiveLocale(bootLocale);

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(bootLocale);

  // 让非 React 的纯函数（日期/相对时间格式化）跟当前语言保持一致。
  useEffect(() => {
    setActiveLocale(locale);
    syncDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setActiveLocale(next);
    setLocaleState(next);
    writeStorage(LOCALE_STORAGE_KEY, next);
  }, []);

  const t = useCallback<TranslationFn>((key, params) => translate(locale, key, params), [locale]);

  const value = useMemo<I18n>(
    () => ({ locale, locales: LOCALES, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** 读取当前语言上下文；必须在 `<I18nProvider>` 内部使用。 */
export function useTranslation(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useTranslation() must be used inside <I18nProvider>.");
  return value;
}
