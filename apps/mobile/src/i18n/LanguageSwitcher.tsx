/**
 * 语言切换按钮。
 *
 * 交互：按钮始终展示「当前语言」的简称（EN / 中），点击后弹出语言列表，
 * 选择任意语言后立即生效并写入本地存储，无需刷新页面。
 */
import { Check, Languages } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { colors } from "../ui";
import { useTranslation } from "./index";
import { LOCALE_LABELS, type Locale } from "./types";

export function LanguageSwitcher({
  compact = false,
  vertical = false,
}: {
  compact?: boolean;
  vertical?: boolean;
}) {
  const { locale, locales, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    top?: number;
    right?: number;
    left?: number;
    bottom?: number;
  } | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const trigger = useRef<View>(null);
  const current = LOCALE_LABELS[locale];

  const choose = useCallback(
    (next: Locale) => {
      setLocale(next);
      setOpen(false);
    },
    [setLocale],
  );

  // 弹窗要贴着按钮展开：横排时在按钮右下方；竖排（左侧图标栏）时按钮在左下角，改为向右上方展开。
  const show = useCallback(() => {
    trigger.current?.measureInWindow((x, y, width, height) => {
      if (vertical) {
        setAnchor({
          left: x + width + 6,
          bottom: Math.max(12, windowHeight - y),
        });
      } else {
        setAnchor({
          top: y + height + 6,
          right: Math.max(12, windowWidth - (x + width)),
        });
      }
      setOpen(true);
    });
  }, [vertical, windowWidth, windowHeight]);

  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={t("common.currentLanguage", { language: current.english })}
        accessibilityHint={t("common.changeLanguage")}
        onPress={show}
        style={({ pressed }) =>
          vertical
            ? {
                width: 60,
                alignItems: "center",
                gap: 3,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: pressed ? colors.line : "transparent",
              }
            : {
                height: 38,
                paddingHorizontal: compact ? 9 : 11,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderRadius: 19,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: pressed ? colors.line : "#FFFFFF",
              }
        }
      >
        {vertical ? (
          <>
            <Languages size={21} strokeWidth={1.7} color={colors.muted} />
            <Text
              numberOfLines={1}
              style={{ fontSize: 10.5, lineHeight: 13, fontWeight: "500", color: colors.muted }}
            >
              {t("common.language")}
            </Text>
          </>
        ) : (
          <>
            <Languages size={15} strokeWidth={1.8} color={colors.text} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text }}>
              {current.short}
            </Text>
          </>
        )}
      </Pressable>
      {open && anchor && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setOpen(false)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={() => setOpen(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(17,25,28,0.18)",
            }}
          >
            <View
              accessibilityViewIsModal
              style={{
                position: "absolute",
                top: anchor.top,
                right: anchor.right,
                left: anchor.left,
                bottom: anchor.bottom,
                minWidth: 168,
                backgroundColor: colors.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.line,
                paddingVertical: 8,
                shadowColor: "#312E81",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: colors.muted,
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 6,
                }}
              >
                {t("common.language")}
              </Text>
              {locales.map((item) => {
                const meta = LOCALE_LABELS[item];
                const selected = item === locale;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={meta.english}
                    onPress={() => choose(item)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 11,
                      backgroundColor: pressed ? colors.canvas : "transparent",
                    })}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: selected ? "600" : "500",
                          color: colors.text,
                        }}
                      >
                        {meta.native}
                      </Text>
                    </View>
                    {selected && <Check size={15} color={colors.blueDark} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}
