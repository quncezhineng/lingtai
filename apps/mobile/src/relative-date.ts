/**
 * Relative time for activity timestamps. Values slightly in the future are
 * clock skew and still read "Just now"; further future values fall back to a
 * date instead of claiming they just happened.
 *
 * 文案通过 i18n 内核（`tr`）输出，因此会跟随当前语言切换。
 */
import { activeLocaleTag, tr } from "./i18n/translate";

export function relativeDate(value: string, now = Date.now()): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  const diff = now - parsed;
  if (diff < -60_000) return dayLabel(parsed);
  const elapsed = Math.max(0, diff);
  if (elapsed < 60_000) return tr("common.relativeJustNow");
  if (elapsed < 3600_000)
    return tr("common.relativeMinutesAgo", { count: Math.floor(elapsed / 60_000) });
  if (elapsed < 86400_000)
    return tr("common.relativeHoursAgo", { count: Math.floor(elapsed / 3600_000) });
  return dayLabel(parsed);
}

function dayLabel(value: number): string {
  return new Date(value).toLocaleDateString(activeLocaleTag(), { month: "short", day: "numeric" });
}
