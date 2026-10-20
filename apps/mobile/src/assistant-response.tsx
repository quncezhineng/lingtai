import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Linking, Platform, ScrollView, Text, type TextStyle, View } from "react-native";
import Markdown, { type MarkdownStyles, type RenderRules } from "react-native-markdown-renderer";
import type { Artifact } from "../../../packages/domain/src";
import { assistantMarkdown, isSafeAssistantUrl } from "./assistant-markdown";
import { findReferencedFile } from "./chat-content";
import { tr } from "./i18n/translate";
import { colors, ErrorNotice } from "./ui";

const textStyle = { color: colors.text, fontSize: 16, lineHeight: 24 };
const style: Partial<MarkdownStyles> = {
  text: textStyle,
  paragraph: { marginTop: 0, marginBottom: 6 },
  list: { marginBottom: 6 },
  headingContainer: { marginTop: 8, marginBottom: 4 },
  heading1: { fontSize: 21, lineHeight: 27 },
  heading2: { fontSize: 19, lineHeight: 25 },
  heading3: { fontSize: 17, lineHeight: 23 },
  link: { color: colors.blueDark, textDecorationLine: "underline" },
  codeInline: {
    backgroundColor: "#EEF2FF",
    color: "#3730A3",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 13,
  },
  codeBlock: { backgroundColor: "#F6F7F9", color: colors.text },
};

const codeText: TextStyle = {
  fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  fontSize: 13,
  lineHeight: 20,
  color: "#1F2937",
};

const renderCodeBlock: RenderRules["fence"] = (node, _children, _parent, _styles) => {
  return (
    <ScrollView
      key={node.key}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{
        maxWidth: "100%",
        marginVertical: 7,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: "#F6F7F9",
      }}
      contentContainerStyle={{ padding: 12 }}
    >
      <Text selectable style={codeText}>
        {node.content.replace(/\n$/, "")}
      </Text>
    </ScrollView>
  );
};

function StreamingCursor() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.18, duration: 480, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: 480, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessible={false}
      style={{
        width: 7,
        height: 18,
        marginBottom: 3,
        borderRadius: 2,
        backgroundColor: colors.primary,
        opacity,
      }}
    />
  );
}

export function AssistantResponse({
  content,
  streaming = false,
  files = [],
  onOpenFile,
}: {
  content: string;
  streaming?: boolean;
  files?: readonly Artifact[];
  onOpenFile?: (file: Artifact) => void;
}) {
  const [linkError, setLinkError] = useState("");
  const onLinkPress = useCallback(
    (url: string) => {
      const file = findReferencedFile(url, files);
      if (file && onOpenFile) {
        onOpenFile(file);
        return false;
      }
      if (!isSafeAssistantUrl(url)) return false;
      setLinkError("");
      void Linking.openURL(url).catch((error) =>
        setLinkError(error instanceof Error ? error.message : String(error)),
      );
      return false;
    },
    [files, onOpenFile],
  );
  const rules = useMemo<RenderRules>(
    () => ({
      textgroup: (node, children) => (
        <Text key={node.key} selectable style={textStyle}>
          {children}
        </Text>
      ),
      image: (node) => (
        <Text key={node.key} selectable style={{ color: colors.muted }}>
          {node.attributes.alt
            ? tr("tools.imageAlt", { alt: node.attributes.alt })
            : tr("tools.imagePlaceholder")}
        </Text>
      ),
      code_inline: (node, _children, _parent, styles) => {
        const file = findReferencedFile(node.content, files);
        return (
          <Text
            key={node.key}
            selectable
            onPress={file && onOpenFile ? () => onOpenFile(file) : undefined}
            style={[
              styles.codeInline as TextStyle,
              ...(file && onOpenFile
                ? [{ color: colors.blueDark, textDecorationLine: "underline" as const }]
                : []),
            ]}
          >
            {node.content}
          </Text>
        );
      },
      code_block: renderCodeBlock,
      fence: renderCodeBlock,
    }),
    [files, onOpenFile],
  );
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Markdown
            markdownit={assistantMarkdown}
            style={style}
            rules={rules}
            onLinkPress={onLinkPress}
          >
            {content}
          </Markdown>
        </View>
        {streaming && <StreamingCursor />}
      </View>
      <ErrorNotice error={linkError} />
    </>
  );
}
