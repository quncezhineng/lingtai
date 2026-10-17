import { useThreads } from "@copilotkit/react-native/headless";
import {
  Archive,
  CalendarDays,
  FileText,
  MessageCircle,
  Monitor,
  Plus,
  RefreshCw,
  Settings2,
} from "lucide-react-native";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "./i18n";
import { Button, colors, ErrorNotice, Field, LinkRow, Sheet, s } from "./ui";
import { useWorkspace } from "./workspace";

function newThreadId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export type Selection = { id: string; existing: boolean };
const ThreadContext = createContext<{
  enabled: boolean;
  selection: Selection;
  visited: Selection[];
  mainId: string;
  loading: boolean;
  error: string;
  retry: () => void;
  select: (selection: Selection) => void;
  /** 新建一个侧边对话并选中它，返回新对话的 id（用于外部立即引用）。 */
  start: () => string;
  claimPrompt: (id: number) => boolean;
} | null>(null);
export function ThreadsProvider({ children }: { children: ReactNode }) {
  const { workspace, navigate, api } = useWorkspace();
  const handledPrompt = useRef(0);
  const enabled = workspace.runtime.richThreads === true;
  const [selection, setSelection] = useState<Selection>({ id: "local", existing: false });
  const [visited, setVisited] = useState<Selection[]>([]);
  const [mainId, setMainId] = useState("local");
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError("");
    void api
      .request<{ threadId: string; existing: boolean }>("/api/main-thread")
      .then((main) => {
        if (!active) return;
        const next = { id: main.threadId, existing: main.existing };
        setMainId(next.id);
        setSelection(next);
        setVisited([next]);
        setLoading(false);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, [api, enabled, attempt]);
  function select(next: Selection) {
    setSelection(next);
    setVisited((items) => (items.some((item) => item.id === next.id) ? items : [...items, next]));
    navigate("chat");
  }
  return (
    <ThreadContext.Provider
      value={{
        claimPrompt: (id) => {
          if (handledPrompt.current === id) return false;
          handledPrompt.current = id;
          return true;
        },
        enabled,
        mainId,
        visited,
        loading,
        error,
        retry: () => setAttempt((n) => n + 1),
        selection,
        select,
        start: () => {
          const id = newThreadId();
          select({ id, existing: false });
          return id;
        },
      }}
    >
      {children}
    </ThreadContext.Provider>
  );
}
export function useLingTaiThread() {
  const context = useContext(ThreadContext);
  if (!context) throw new Error("Threads provider is unavailable");
  return context;
}
export function ThreadsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const {
    enabled,
    selection,
    visited,
    mainId,
    loading,
    error: mainError,
    retry,
    select,
    start,
  } = useLingTaiThread();
  const { workspace, open, navigate, refresh } = useWorkspace();
  const threads = useThreads({ agentId: "default", enabled, includeArchived: true, limit: 20 });
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [archived, setArchived] = useState(false);
  async function mutate(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      setEditing(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function go(section: "calendar" | "files" | "apps") {
    onClose();
    navigate(section);
  }
  return (
    <Sheet
      title={t("common.agentName")}
      subtitle={
        workspace.mode === "sample" ? t("threads.sheetSubtitleSample") : workspace.profile.name
      }
      onClose={onClose}
    >
      <View style={{ gap: 14 }}>
        {enabled && loading ? (
          <>
            <ErrorNotice error={mainError} />
            {mainError ? (
              <Button onPress={retry}>{t("app.retryMainChat")}</Button>
            ) : (
              <ActivityIndicator color={colors.blueDark} />
            )}
          </>
        ) : enabled ? (
          <>
            <LinkRow
              icon={MessageCircle}
              title={t("threads.mainChatTitle")}
              detail={t("threads.mainChatDetail")}
              onPress={() => {
                select({ id: mainId, existing: true });
                onClose();
              }}
            />
            <Button
              primary
              icon={Plus}
              onPress={() => {
                start();
                onClose();
              }}
            >
              {t("threads.newSideChat")}
            </Button>
            <View style={[s.between, { marginTop: 12 }]}>
              <Text style={s.heading}>{t("threads.sideChats")}</Text>
              <Button small onPress={() => setArchived(!archived)}>
                {archived ? t("threads.showActive") : t("threads.archived")}
              </Button>
            </View>
            {threads.isLoading && <ActivityIndicator color={colors.blueDark} />}
            <ErrorNotice error={error || threads.error?.message} />
            {threads.error && (
              <Button small onPress={threads.refetchThreads}>
                {t("threads.retryConversations")}
              </Button>
            )}
            {!archived &&
              visited
                .filter(
                  (item) =>
                    item.id !== mainId && !threads.threads.some((saved) => saved.id === item.id),
                )
                .map((item, index) => (
                  <LinkRow
                    key={item.id}
                    icon={MessageCircle}
                    title={t("threads.sideChatNumber", { index: index + 1 })}
                    detail={t("threads.openInThisApp")}
                    onPress={() => {
                      select(item);
                      onClose();
                    }}
                  />
                ))}
            {threads.threads
              .filter((thread) => thread.id !== mainId && thread.archived === archived)
              .map((thread) => (
                <View
                  key={thread.id}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.line,
                    gap: 10,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("threads.openConversation", {
                      name: thread.name || t("threads.untitledConversation"),
                    })}
                    accessibilityState={{ selected: selection.id === thread.id }}
                    onPress={() => {
                      select({ id: thread.id, existing: true });
                      onClose();
                    }}
                    style={[s.row, { gap: 10 }]}
                  >
                    <MessageCircle size={19} color={colors.text} />
                    <Text style={[s.text, { flex: 1 }]}>
                      {thread.name || t("threads.untitledConversation")}
                    </Text>
                  </Pressable>
                  {editing === thread.id && (
                    <Field
                      label={t("threads.conversationName")}
                      value={name}
                      onChangeText={setName}
                    />
                  )}
                  <View style={[s.row, { gap: 8 }]}>
                    <Button
                      small
                      disabled={threads.isMutating || (editing === thread.id && !name.trim())}
                      onPress={() => {
                        if (editing === thread.id)
                          void mutate(() => threads.renameThread(thread.id, name.trim()));
                        else {
                          setEditing(thread.id);
                          setName(thread.name || "");
                        }
                      }}
                    >
                      {editing === thread.id ? t("threads.saveName") : t("threads.rename")}
                    </Button>
                    <Button
                      small
                      icon={Archive}
                      disabled={threads.isMutating}
                      onPress={() =>
                        void mutate(() =>
                          thread.archived
                            ? threads.unarchiveThread(thread.id)
                            : threads.archiveThread(thread.id),
                        )
                      }
                    >
                      {thread.archived ? t("threads.restore") : t("threads.archive")}
                    </Button>
                  </View>
                </View>
              ))}
            {!threads.isLoading &&
              !threads.error &&
              !threads.threads.some(
                (thread) => thread.id !== mainId && thread.archived === archived,
              ) && (
                <Text style={s.muted}>
                  {archived ? t("threads.emptyArchived") : t("threads.emptyActive")}
                </Text>
              )}
            <ErrorNotice error={threads.fetchMoreError?.message} />
            {threads.hasMoreThreads && (
              <Button small busy={threads.isFetchingMoreThreads} onPress={threads.fetchMoreThreads}>
                {t("threads.loadMore")}
              </Button>
            )}
            <Text style={s.small}>{t("threads.sideChatFootnote")}</Text>
          </>
        ) : (
          <>
            <LinkRow
              icon={MessageCircle}
              title={t("threads.mainChatTitle")}
              detail={t("threads.mainChatSavedDetail")}
              onPress={() => {
                navigate("chat");
                onClose();
              }}
            />
            <Text style={s.muted}>{t("threads.workspaceSavedNote")}</Text>
          </>
        )}
        <View style={s.divider} />
        <LinkRow
          icon={Plus}
          title={t("threads.delegateTask")}
          detail={t("threads.delegateTaskDetail")}
          onPress={() => {
            onClose();
            open({ type: "delegate" });
          }}
        />
        <LinkRow
          icon={Monitor}
          title={t("threads.agentComputer")}
          detail={t("threads.agentComputerDetail")}
          onPress={() => {
            onClose();
            open({ type: "computer" });
          }}
        />
        <LinkRow icon={CalendarDays} title={t("threads.calendar")} onPress={() => go("calendar")} />
        <LinkRow icon={FileText} title={t("threads.files")} onPress={() => go("files")} />
        <LinkRow icon={Settings2} title={t("threads.appsAndSettings")} onPress={() => go("apps")} />
        <Button small icon={RefreshCw} onPress={() => void mutate(refresh)}>
          {t("threads.refreshWorkspace")}
        </Button>
      </View>
    </Sheet>
  );
}
