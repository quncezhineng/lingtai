import { FileText } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { colors } from "./ui";

export type ConversationHeaderState = "ready" | "working" | "reconnecting" | "error";

const tone: Record<ConversationHeaderState, string> = {
  ready: "#22C55E",
  working: colors.primary,
  reconnecting: "#F59E0B",
  error: colors.danger,
};

export function ConversationHeader({
  title,
  status,
  state,
  onOpenFiles,
  filesOpen,
  filesLabel,
}: {
  title: string;
  status: string;
  state: ConversationHeaderState;
  /** 点击打开/收起「文件产物」右边栏。 */
  onOpenFiles?: () => void;
  filesOpen?: boolean;
  filesLabel?: string;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state !== "working" && state !== "reconnecting") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, state]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 2,
        paddingTop: 7,
        paddingBottom: 9,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      <Animated.View
        accessible={false}
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: tone[state],
          opacity: pulse,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14.5, fontWeight: "600", color: colors.text, letterSpacing: -0.2 }}
        >
          {title}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          style={{ marginTop: 1, fontSize: 11.5, color: colors.muted }}
        >
          {status}
        </Text>
      </View>
      {onOpenFiles && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filesLabel}
          accessibilityState={{ selected: !!filesOpen }}
          onPress={onOpenFiles}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            backgroundColor:
              filesOpen || pressed ? colors.sky : "transparent",
          })}
        >
          <FileText size={17} color={filesOpen ? colors.blueDark : colors.muted} />
        </Pressable>
      )}
    </View>
  );
}
