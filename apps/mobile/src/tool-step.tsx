import {
  Activity,
  Bell,
  Bot,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Globe2,
  ListChecks,
  type LucideIcon,
  Mail,
  Monitor,
  Search,
  Send,
  Target,
  X,
} from "lucide-react-native";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { type TranslationFn, useTranslation } from "./i18n";
import { colors } from "./ui";

export type ToolStepStatus = "inProgress" | "executing" | "complete";

type ToolArguments = Readonly<Record<string, unknown>>;

const RESULT_LIMIT = 12_000;

const toolIcons: Record<string, LucideIcon> = {
  search_web: Search,
  search_mail: Mail,
  read_mail_thread: Mail,
  browse_web: Globe2,
  use_desktop: Monitor,
  present_choices: ListChecks,
  delegate_task: Send,
  agent_status: Activity,
  create_goal: Target,
  watch_page: Bell,
  remember_fact: Brain,
  read_calendar: CalendarDays,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseToolArguments(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseResult(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return value;
  }
}

function clip(value: string, limit = 80): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
}

function textArgument(args: ToolArguments, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function firstQuery(args: ToolArguments): string {
  const queries = args.search_queries;
  if (Array.isArray(queries)) {
    const first = queries.find(
      (value): value is string => typeof value === "string" && !!value.trim(),
    );
    if (first) return first;
  }
  return textArgument(args, "query") || textArgument(args, "objective");
}

function siteFromUrl(value: string): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return clip(value, 48);
  }
}

function resultTitle(value: unknown): string {
  const parsed = parseResult(value);
  return isRecord(parsed) && typeof parsed.title === "string" ? parsed.title : "";
}

function mailSubject(value: unknown): string {
  const parsed = parseResult(value);
  if (!isRecord(parsed) || !Array.isArray(parsed.messages)) return "";
  const message = parsed.messages.at(-1);
  return isRecord(message) && typeof message.subject === "string" ? message.subject : "";
}

function resultError(value: unknown): string {
  const parsed = parseResult(value);
  return isRecord(parsed) && typeof parsed.error === "string" ? parsed.error : "";
}

function toolTitle(tool: string, args: ToolArguments, result: unknown, t: TranslationFn): string {
  const query = firstQuery(args);
  switch (tool) {
    case "search_web":
      return query
        ? t("tools.toolStepWebSearchFor", { query: clip(query) })
        : t("tools.toolStepWebSearch");
    case "search_mail":
      return query
        ? t("tools.toolStepMailSearchFor", { query: clip(query) })
        : t("tools.toolStepMailSearch");
    case "read_mail_thread": {
      const subject = mailSubject(result);
      return subject
        ? t("tools.toolStepReadEmailSubject", { subject: clip(subject) })
        : t("tools.toolStepReadEmail");
    }
    case "browse_web": {
      const title = resultTitle(result);
      if (title) return t("tools.toolStepBrowsePage", { title: clip(title) });
      const site = siteFromUrl(textArgument(args, "url"));
      return site ? t("tools.toolStepBrowseSite", { site }) : t("tools.toolStepBrowseWeb");
    }
    case "use_desktop": {
      const action = textArgument(args, "action");
      const text = textArgument(args, "text");
      if (action === "screenshot") return t("tools.toolStepDesktopScreenshot");
      if (action === "left_click" || action === "double_click" || action === "right_click") {
        return t("tools.toolStepDesktopClick");
      }
      if (action === "type" && text) {
        return t("tools.toolStepDesktopType", { text: clip(text, 48) });
      }
      if (action === "key" && text) return t("tools.toolStepDesktopKey", { key: clip(text, 32) });
      if (action === "scroll") return t("tools.toolStepDesktopScroll");
      if (action === "wait") return t("tools.toolStepDesktopWait");
      return t("tools.toolStepDesktop");
    }
    case "present_choices":
      return t("tools.toolStepChoices");
    case "delegate_task": {
      const title = textArgument(args, "title") || textArgument(args, "prompt");
      return title
        ? t("tools.toolStepDelegateTitle", { title: clip(title) })
        : t("tools.toolStepDelegate");
    }
    case "agent_status":
      return t("tools.toolStepAgentStatus");
    case "create_goal": {
      const title = textArgument(args, "title");
      return title ? t("tools.toolStepGoalTitle", { title: clip(title) }) : t("tools.toolStepGoal");
    }
    case "watch_page": {
      const title = textArgument(args, "title");
      return title
        ? t("tools.toolStepWatchTitle", { title: clip(title) })
        : t("tools.toolStepWatch");
    }
    case "remember_fact": {
      const text = textArgument(args, "text");
      return text ? t("tools.toolStepMemoryText", { text: clip(text) }) : t("tools.toolStepMemory");
    }
    case "read_calendar":
      return t("tools.toolStepCalendar");
    default:
      return t("tools.toolStepUnknown", {
        tool: tool.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase()),
      });
  }
}

function printable(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function argumentValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function ToolStep({
  tool,
  args: rawArgs,
  result,
  status,
  defaultOpen = false,
  children,
}: {
  tool: string;
  args?: ToolArguments;
  result?: unknown;
  status: ToolStepStatus;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const [toggledOpen, setToggledOpen] = useState<boolean | null>(null);
  const args = rawArgs ?? {};
  const title = toolTitle(tool, args, result, t);
  const error = resultError(result);
  const running = status !== "complete";
  const failed = !running && !!error;
  const canExpand = !!children || Object.keys(args).length > 0 || result !== undefined;
  const expanded = toggledOpen ?? (defaultOpen || failed);
  const Icon = toolIcons[tool] ?? Bot;
  const statusText = failed
    ? t("tools.toolStepFailed")
    : running
      ? t("tools.toolStepRunning")
      : t("tools.toolStepComplete");
  const output = error || (result === undefined ? "" : printable(parseResult(result)));
  const truncated = output.length > RESULT_LIMIT;
  const shownOutput = truncated ? output.slice(0, RESULT_LIMIT) : output;
  const entries = Object.entries(args).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} · ${statusText}`}
        accessibilityHint={
          canExpand
            ? t(expanded ? "tools.toolStepHideDetails" : "tools.toolStepShowDetails")
            : undefined
        }
        accessibilityState={canExpand ? { expanded } : undefined}
        disabled={!canExpand}
        onPress={() => setToggledOpen(!expanded)}
        style={({ pressed }) => [
          styles.header,
          pressed && canExpand && styles.headerPressed,
          !canExpand && styles.headerStatic,
        ]}
      >
        <Icon size={15} strokeWidth={1.9} color={colors.muted} />
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {failed ? (
          <X size={14} color={colors.danger} />
        ) : running ? (
          <ActivityIndicator size="small" color={colors.blueDark} style={styles.spinner} />
        ) : (
          <Check size={14} color="#2E9B68" />
        )}
        {canExpand &&
          (expanded ? (
            <ChevronDown size={14} color={colors.muted} />
          ) : (
            <ChevronRight size={14} color={colors.muted} />
          ))}
      </Pressable>
      {expanded && canExpand && (
        <View style={styles.details}>
          {children ?? (
            <View style={styles.rawDetails}>
              {entries.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t("tools.toolStepArguments")}</Text>
                  {entries.map(([key, value]) => (
                    <View key={key} style={styles.argumentRow}>
                      <Text selectable style={styles.argumentKey}>
                        {key}
                      </Text>
                      <Text selectable style={styles.argumentValue}>
                        {argumentValue(value)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {!!output && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t("tools.toolStepResult")}</Text>
                  <ScrollView
                    nestedScrollEnabled
                    style={styles.outputScroll}
                    contentContainerStyle={styles.outputContent}
                  >
                    <Text selectable style={styles.output}>
                      {shownOutput}
                    </Text>
                  </ScrollView>
                  {truncated && (
                    <Text style={styles.truncated}>{t("tools.toolStepOutputTruncated")}</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "flex-start",
  },
  header: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E8E8EC",
    backgroundColor: "#F5F5F7",
  },
  headerPressed: {
    backgroundColor: "#ECECF0",
  },
  headerStatic: {
    opacity: 0.92,
  },
  title: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  spinner: {
    width: 14,
    height: 14,
    transform: [{ scale: 0.72 }],
  },
  details: {
    marginTop: 7,
  },
  rawDetails: {
    gap: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E8E8EC",
    backgroundColor: "#F8F8FA",
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  argumentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  argumentKey: {
    width: 92,
    flexShrink: 0,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  argumentValue: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  outputScroll: {
    maxHeight: 260,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  outputContent: {
    padding: 10,
  },
  output: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  truncated: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
