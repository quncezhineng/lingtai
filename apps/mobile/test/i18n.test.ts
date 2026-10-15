/**
 * i18n 单元测试。
 *
 * 覆盖：中英语言包 key 对齐、占位符一致性、专有名词「灵台」译名、
 * 插值、语言回退、当前语言切换、偏好持久化与语言决策逻辑。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { en } from "../src/i18n/locales/en/index.ts";
import statusEn from "../src/i18n/locales/en/status.ts";
import { zhHans } from "../src/i18n/locales/zh-Hans/index.ts";
import statusZh from "../src/i18n/locales/zh-Hans/status.ts";
import { clearStorage, readStorage, writeStorage } from "../src/i18n/storage.ts";
import {
  detectDeviceLocale,
  formatTemplate,
  getActiveLocale,
  localizeAgentName,
  resolveLocale,
  setActiveLocale,
  statusLabel,
  tr,
  translate,
} from "../src/i18n/translate.ts";
import { isLocale, LOCALE_LABELS, LOCALE_STORAGE_KEY, LOCALES } from "../src/i18n/types.ts";

const CJK = /[\u4e00-\u9fff]/;
/** 从模板里抽出所有 `{name}` 占位符，用于校验中英两侧结构一致。 */
const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
/**
 * 语言包在源码里是字面量对象（key 为字面量联合类型），
 * 这里的宽化视图用于以动态 key（如 `status.${value}`）查表做断言。
 */
const zhText: Record<string, string> = zhHans;
const statusText: Record<string, string> = statusZh;

test("简体中文与英文的 key 集合完全一致", () => {
  const english = Object.keys(en).sort();
  const chinese = Object.keys(zhHans).sort();
  const missing = english.filter((key) => !chinese.includes(key));
  const extra = chinese.filter((key) => !english.includes(key));
  assert.deepEqual(missing, [], "简体中文缺失 key");
  assert.deepEqual(extra, [], "简体中文存在多余 key");
  assert.deepEqual(chinese, english);
});

test("任一语言都不存在空文案", () => {
  for (const [lang, dictionary] of [
    ["en", en],
    ["zh-Hans", zhHans],
  ] as const) {
    for (const [key, value] of Object.entries(dictionary)) {
      assert.ok(value.trim().length > 0, `${lang} 的 ${key} 为空`);
    }
  }
});

test("英文语言包不包含中文（防止误把中文写进英文包）", () => {
  for (const [key, value] of Object.entries(en)) {
    assert.ok(!CJK.test(value), `英文语言包的 ${key} 混入了中文`);
  }
});

test("专有名词 LingTai 在简体中文中统一译为「灵台」", () => {
  assert.equal(en["common.agentName"], "LingTai");
  assert.equal(zhHans["common.agentName"], "灵台");
  // 英文里只要出现 LingTai，简体中文对应位置就必须出现「灵台」。
  const sources = Object.entries(en).filter(([, value]) => value.includes("LingTai"));
  assert.ok(sources.length >= 5, "应至少覆盖欢迎语、本地工作区提示、水豚无障碍文案等处");
  for (const [key] of sources) {
    assert.ok((zhText[key] ?? "").includes("灵台"), `${key} 未把 LingTai 译作「灵台」`);
  }
  // 简体中文包中不允许残留英文原名。
  for (const [key, value] of Object.entries(zhHans)) {
    assert.ok(!value.includes("LingTai"), `简体中文的 ${key} 仍残留 LingTai`);
  }
});

test("同一条文案在中英两侧使用相同的占位符", () => {
  for (const [key, value] of Object.entries(en)) {
    assert.deepEqual(placeholders(zhText[key] ?? ""), placeholders(value), `${key} 的占位符不一致`);
  }
});

test("formatTemplate 支持命名占位符并保留未知占位符", () => {
  assert.equal(formatTemplate("Hello {name}", { name: "Ada" }), "Hello Ada");
  assert.equal(formatTemplate("{a} + {b}", { a: 1, b: 2 }), "1 + 2");
  assert.equal(formatTemplate("Keep {name}", {}), "Keep {name}");
  assert.equal(formatTemplate("无参数"), "无参数");
  assert.equal(formatTemplate("No params"), "No params");
});

test("translate 按「目标语言 -> 英文 -> 原始 key」回退且永不抛错", () => {
  assert.equal(translate("zh-Hans", "common.agentName"), "灵台");
  assert.equal(translate("en", "common.agentName"), "LingTai");
  assert.equal(translate("zh-Hans", "app.welcomeTitle"), "欢迎使用灵台。");
  assert.equal(translate("en", "not.a.real.key"), "not.a.real.key");
});

test("tr 跟随当前生效语言切换", () => {
  const original = getActiveLocale();
  try {
    setActiveLocale("zh-Hans");
    assert.equal(tr("common.agentName"), "灵台");
    assert.equal(tr("app.statusIdle"), zhHans["app.statusIdle"]);
    setActiveLocale("en");
    assert.equal(tr("common.agentName"), "LingTai");
    assert.equal(tr("app.statusIdle"), en["app.statusIdle"]);
  } finally {
    setActiveLocale(original);
  }
});

test("statusLabel 命中语言包并跟随语言切换，未登记值退回通用处理", () => {
  const original = getActiveLocale();
  try {
    setActiveLocale("zh-Hans");
    assert.equal(statusLabel("awaiting_review"), "等待复核");
    assert.equal(statusLabel("succeeded"), "已完成");
    assert.equal(statusLabel("some_unknown_value"), "Some unknown value");
    setActiveLocale("en");
    assert.equal(statusLabel("awaiting_review"), "Awaiting review");
  } finally {
    setActiveLocale(original);
  }
});

test("localizeAgentName 把服务端英文原名统一显示为当前语言译名", () => {
  const original = getActiveLocale();
  try {
    setActiveLocale("zh-Hans");
    assert.equal(localizeAgentName("LingTai"), "灵台");
    assert.equal(localizeAgentName(undefined), "灵台");
    assert.equal(localizeAgentName("小明"), "小明");
    setActiveLocale("en");
    assert.equal(localizeAgentName("LingTai"), "LingTai");
  } finally {
    setActiveLocale(original);
  }
});

test("语言偏好可写入并读回本地存储", () => {
  clearStorage(LOCALE_STORAGE_KEY);
  assert.equal(readStorage(LOCALE_STORAGE_KEY), null);
  writeStorage(LOCALE_STORAGE_KEY, "zh-Hans");
  assert.equal(readStorage(LOCALE_STORAGE_KEY), "zh-Hans");
  clearStorage(LOCALE_STORAGE_KEY);
  assert.equal(readStorage(LOCALE_STORAGE_KEY), null);
});

test("resolveLocale：本地偏好优先，非法值退回设备语言", () => {
  assert.equal(resolveLocale("zh-Hans"), "zh-Hans");
  assert.equal(resolveLocale("en"), "en");
  assert.equal(resolveLocale("fr"), detectDeviceLocale());
  assert.equal(resolveLocale(null), detectDeviceLocale());
});

test("语言守卫与展示元信息保持一致", () => {
  assert.deepEqual([...LOCALES], ["en", "zh-Hans"]);
  assert.ok(isLocale("zh-Hans"));
  assert.ok(isLocale("en"));
  assert.ok(!isLocale("zh-Hant"));
  assert.ok(!isLocale(""));
  assert.ok(!isLocale(undefined));
  for (const locale of LOCALES) {
    assert.ok(LOCALE_LABELS[locale].native.length > 0);
    assert.ok(LOCALE_LABELS[locale].short.length > 0);
  }
});

test("领域枚举标签在简体中文下不带英文残留", () => {
  assert.deepEqual(Object.keys(statusZh).sort(), Object.keys(statusEn).sort());
  // 常见状态/类型枚举都必须在中文包里登记。
  const known = [
    "queued",
    "running",
    "waiting_approval",
    "waiting_input",
    "scheduled",
    "paused",
    "succeeded",
    "failed",
    "cancelled",
    "awaiting_review",
    "executing",
    "pending",
    "active",
    "completed",
    "stopped",
    "plan",
    "document",
    "finance",
    "monitor",
    "comparison",
    "report",
    "connected",
    "disconnected",
    "warm",
    "concise",
    "thoughtful",
    "sky",
    "sand",
    "lilac",
  ];
  for (const value of known) {
    assert.ok(statusText[`status.${value}`], `缺少 status.${value}`);
  }
  for (const [key, value] of Object.entries(statusZh)) {
    // 唯一保留英文的是产品专名 OpenBot。
    if (key === "status.openbot") continue;
    assert.ok(!/[A-Za-z]/.test(value), `status 的 ${key} 仍有英文残留：${value}`);
  }
});
