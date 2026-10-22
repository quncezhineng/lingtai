import { CopilotKitProvider } from "@copilotkit/react-native/headless";
import { StatusBar } from "expo-status-bar";
import { Bell, Check, Menu, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { Section, Workspace } from "../../packages/domain/src";
import { AccountScreen } from "./src/account";
import {
  AgentActivityScreen,
  AgentStatus,
  AppsScreen,
  GoalsScreen,
  IdeasScreen,
} from "./src/agent-ui";
import { AgentWorkspaceProvider, useAgentWorkspace } from "./src/agent-workspace";
import {
  API_URL,
  type AuthMode,
  authConfig,
  createSession,
  LingWuApi,
  requestOtp,
  verifyOtp,
} from "./src/api";
import { ChatScreen, WorkspaceTools } from "./src/chat";
import { ComputerEntry } from "./src/computer";
import { ComputerDraftProvider } from "./src/computer-drafts";
import { Details } from "./src/details";
import { I18nProvider, localizeAgentName, useTranslation } from "./src/i18n";
import { LanguageSwitcher } from "./src/i18n/LanguageSwitcher";
import type { TranslationKey } from "./src/i18n/locales/en";
import { clearStorage, readStorage, writeStorage } from "./src/i18n/storage";
import { BrowserScreen, CalendarScreen, FilesScreen, MailScreen } from "./src/screens";
import { ACCOUNT_NAV, ChatsColumn, Rail, SECTION_NAV } from "./src/shell";
import { ThreadsProvider, ThreadsSheet, useLingWuThread } from "./src/threads";
import { Button, Card, colors, ErrorNotice, Field, IconButton, Mascot, s } from "./src/ui";
import { type Detail, useWorkspace, WorkspaceContext } from "./src/workspace";

/** 登录会话在本地持久化的键，刷新网页后据此恢复登录状态。 */
const SESSION_KEY = "lingwu.session";

// 底部标签栏的顺序与宽屏图标栏一致：五个主页面在前，「我的」在最后。
const nav = [...SECTION_NAV, ACCOUNT_NAV];
const titles: Partial<Record<Section, { titleKey: TranslationKey; subtitleKey: TranslationKey }>> =
  {
    activity: { titleKey: "app.titleActivity", subtitleKey: "app.subtitleActivity" },
    ideas: { titleKey: "app.titleIdeas", subtitleKey: "app.subtitleIdeas" },
    goals: { titleKey: "app.titleGoals", subtitleKey: "app.subtitleGoals" },
    apps: { titleKey: "app.titleApps", subtitleKey: "app.subtitleApps" },
    account: { titleKey: "app.titleAccount", subtitleKey: "app.subtitleAccount" },
    connections: { titleKey: "app.titleConnections", subtitleKey: "app.subtitleConnections" },
    mail: { titleKey: "app.titleMail", subtitleKey: "app.subtitleMail" },
    calendar: { titleKey: "app.titleCalendar", subtitleKey: "app.subtitleCalendar" },
    browser: { titleKey: "app.titleBrowser", subtitleKey: "app.subtitleBrowser" },
    files: { titleKey: "app.titleFiles", subtitleKey: "app.subtitleFiles" },
  };

/** 应用入口：先挂载语言上下文，保证包含登录页在内的所有界面都可被翻译。 */
export default function App() {
  return (
    <I18nProvider>
      <Root />
    </I18nProvider>
  );
}

/**
 * 登录入口。
 *
 * 服务端有两种登录方式：
 * - 账号模式（配置了 Supabase）：每个用户用邮箱注册/登录，各自的工作区数据互相隔离；
 * - 访问密钥模式（未配置 Supabase）：整个部署共用一个访问密钥，即单用户部署。
 * 具体用哪种由 /api/auth/config 决定，本地示例部署仍会直接打开工作区。
 */
function Root() {
  const { t } = useTranslation();
  const [token, setToken] = useState(() => readStorage(SESSION_KEY) ?? "");
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  /** 登录成功后持久化会话令牌，刷新网页后也能自动恢复登录状态。 */
  const applySession = useCallback((nextToken: string) => {
    writeStorage(SESSION_KEY, nextToken);
    setToken(nextToken);
  }, []);
  const connect = useCallback(
    async (key?: string) => {
      setBusy(true);
      setError("");
      try {
        const session = await createSession(key);
        applySession(session.token);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [applySession],
  );
  const signOut = useCallback(() => {
    clearStorage(SESSION_KEY);
    setToken("");
  }, []);
  /** 账号模式下请求发送验证码；成功后提示用户查收邮件。 */
  const sendCode = useCallback(async () => {
    setSendingCode(true);
    setError("");
    try {
      await requestOtp(email);
      setCodeSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingCode(false);
    }
  }, [email]);
  /** 账号模式下校验验证码登录，成功后 token 只属于当前用户。 */
  const submitAccount = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const session = await verifyOtp({ email, code });
      applySession(session.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [email, code, applySession]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await authConfig();
        if (cancelled) return;
        setAuthMode(config.authMode);
        if (config.authMode === "access-key") await connect();
        else setBusy(false);
      } catch {
        if (cancelled) return;
        // 读不到配置时按访问密钥模式处理，保证本地开发仍能打开工作区。
        setAuthMode("access-key");
        await connect();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connect]);
  const accountMode = authMode === "supabase";
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {token ? (
        <CopilotKitProvider
          runtimeUrl={`${API_URL}/api/copilotkit`}
          headers={{ Authorization: `Bearer ${token}` }}
        >
          <WorkspaceApp token={token} onSignOut={signOut} />
        </CopilotKitProvider>
      ) : (
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: colors.canvas,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View style={{ width: "100%", maxWidth: 420, gap: 22, alignItems: "center" }}>
            <Mascot size={72} />
            <Text
              style={{ fontSize: 32, color: colors.text, letterSpacing: -1, fontWeight: "500" }}
            >
              {t("app.welcomeTitle")}
            </Text>
            <Text style={[s.muted, { textAlign: "center" }]}>{t("app.welcomeSubtitle")}</Text>
            {authMode === null ? (
              <ActivityIndicator color={colors.blueDark} />
            ) : (
              <Card style={{ width: "100%" }}>
                <ErrorNotice error={error} />
                {accountMode ? (
                  <>
                    <Field
                      label={t("app.emailLabel")}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      placeholder={t("app.emailPlaceholder")}
                    />
                    <Button busy={sendingCode} onPress={() => void sendCode()}>
                      {t("app.sendCode")}
                    </Button>
                    {codeSent && (
                      <Text style={[s.small, { textAlign: "center" }]}>
                        {t("app.sendCodeSent")}
                      </Text>
                    )}
                    <Field
                      label={t("app.codeLabel")}
                      value={code}
                      onChangeText={setCode}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="number-pad"
                      placeholder={t("app.codePlaceholder")}
                    />
                    <Button
                      primary
                      busy={busy}
                      disabled={!code}
                      onPress={() => void submitAccount()}
                    >
                      {t("app.signIn")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Field
                      label={t("app.accessKeyLabel")}
                      value={accessKey}
                      onChangeText={setAccessKey}
                      secureTextEntry
                      placeholder={t("app.accessKeyPlaceholder")}
                    />
                    <Button
                      primary
                      busy={busy}
                      onPress={() => void connect(accessKey || undefined)}
                    >
                      {t("app.openWorkspace")}
                    </Button>
                    <Text style={[s.small, { marginTop: 15 }]}>
                      {t("app.localWorkspaceHint", { url: API_URL })}
                    </Text>
                  </>
                )}
              </Card>
            )}
          </View>
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}
function WorkspaceApp({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const { t } = useTranslation();
  const api = useMemo(() => new LingWuApi(token), [token]);
  const [workspace, setWorkspace] = useState<Workspace>();
  const [section, setSection] = useState<Section>("chat");
  const [detail, setDetail] = useState<Detail>();
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState<{ id: number; text: string }>();
  const refresh = useCallback(async () => {
    const snapshot = await api.request<Workspace>("/api/workspace");
    setWorkspace(snapshot);
    setError("");
  }, [api]);
  /** 统一处理刷新失败：令牌过期/无效（401）时退回登录页，其余错误提示重试。 */
  const runRefresh = useCallback(() => {
    void refresh().catch((e) => {
      if ((e as { status?: number }).status === 401) onSignOut();
      else setError(String(e));
    });
  }, [refresh, onSignOut]);
  useEffect(() => {
    runRefresh();
  }, [runRefresh]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") runRefresh();
    });
    return () => listener.remove();
  }, [runRefresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const navigate = useCallback(
    (next: Section) =>
      setSection(next === "today" ? "chat" : next === "connections" ? "apps" : next),
    [],
  );
  const open = useCallback((next: Detail) => setDetail(next), []);
  const close = useCallback(() => setDetail(undefined), []);
  /** 退出登录：先让服务端作废令牌，再清空本地会话回到登录页。 */
  const signOut = useCallback(() => {
    void api.request("/api/auth/signout", {}).catch(() => undefined);
    onSignOut();
  }, [api, onSignOut]);
  const ask = useCallback((text: string) => {
    setPrompt({ id: Date.now(), text });
    setSection("chat");
  }, []);
  if (!workspace)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 18,
        }}
      >
        <Mascot size={56} />
        {error ? (
          <>
            <ErrorNotice error={error} />
            <Button onPress={runRefresh}>{t("common.tryAgain")}</Button>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.blueDark} />
            <Text style={s.muted}>{t("app.openingWorkspace")}</Text>
          </>
        )}
      </SafeAreaView>
    );
  return (
    <WorkspaceContext.Provider
      value={{ workspace, api, section, navigate, refresh, open, close, notify: setToast, ask }}
    >
      <AgentWorkspaceProvider>
        <ComputerDraftProvider key={token}>
          <ThreadsProvider>
            <WorkspaceShell
              detail={detail}
              toast={toast}
              clearToast={() => setToast("")}
              error={error}
              prompt={prompt}
              onSignOut={signOut}
            />
          </ThreadsProvider>
        </ComputerDraftProvider>
      </AgentWorkspaceProvider>
    </WorkspaceContext.Provider>
  );
}
function WorkspaceShell({
  detail,
  toast,
  clearToast,
  error,
  prompt,
  onSignOut,
}: {
  detail?: Detail;
  toast: string;
  clearToast: () => void;
  error: string;
  prompt?: { id: number; text: string };
  onSignOut: () => void;
}) {
  const { workspace, section, navigate, open } = useWorkspace();
  const { t } = useTranslation();
  const { data } = useAgentWorkspace();
  const {
    selection,
    visited,
    mainId,
    loading: threadsLoading,
    error: threadsError,
    retry: retryThreads,
    enabled: richThreads,
  } = useLingWuThread();
  const [threadsOpen, setThreadsOpen] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const pending =
    (data?.notifications.filter((n) => !n.read).length || 0) +
    workspace.actions.filter((a) => a.status === "awaiting_review").length;
  const activeTask =
    data?.tasks.find(
      (task) => task.status === "waiting_approval" || task.status === "waiting_input",
    ) || data?.tasks.find((task) => task.status === "running");
  // 服务端默认名称是英文原名（LingWu），展示前统一本地化，简体中文下显示「灵悟」。
  const agentName = localizeAgentName(data?.identity.name);
  const status = activeTask
    ? activeTask.status === "waiting_approval"
      ? t("app.statusReadyToReview", { title: activeTask.title })
      : activeTask.status === "waiting_input"
        ? t("app.statusNeedsInput", { title: activeTask.title })
        : activeTask.plan.find((step) => step.status === "running")?.title || activeTask.title
    : data?.tasks.some((task) => task.status === "queued")
      ? t("app.statusPickingUp")
      : t("app.statusIdle");
  const title = titles[section] || titles.apps;
  const Screen =
    section === "mail"
      ? MailScreen
      : section === "calendar"
        ? CalendarScreen
        : section === "browser"
          ? BrowserScreen
          : section === "files"
            ? FilesScreen
            : section === "activity"
              ? AgentActivityScreen
              : section === "ideas"
                ? IdeasScreen
                : section === "goals"
                  ? GoalsScreen
                  : AppsScreen;
  const utility = ["mail", "calendar", "browser", "files"].includes(section);
  return (
    <>
      <WorkspaceTools />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "bottom"]}>
        {/* 宽屏（>= 900）是「图标栏 + 对话列表栏 + 主内容区」，窄屏是单列加底部标签栏；
            两套外壳下面是同一个主内容区，页面组件不做第二份实现。 */}
        <View style={{ flex: 1, flexDirection: desktop ? "row" : "column" }}>
          {desktop && <Rail name={agentName} pending={pending} />}
          {desktop && section === "chat" && <ChatsColumn />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flex: 1,
                width: "100%",
                maxWidth: desktop ? 900 : 760,
                alignSelf: "center",
              }}
            >
              {!desktop && (
                <View
                  style={{
                    height: 122,
                    paddingTop: 2,
                    marginHorizontal: 20,
                  }}
                >
                  <View style={{ position: "absolute", left: 0, top: 16 }}>
                    <IconButton
                      icon={Menu}
                      label={t("app.openConversations")}
                      onPress={() => setThreadsOpen(true)}
                    />
                  </View>
                  <View pointerEvents="box-none" style={{ alignItems: "center", gap: 1 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("agent.personalityMemory")}
                      onPress={() => open({ type: "personality" })}
                      style={({ pressed }) => ({
                        alignItems: "center",
                        maxWidth: "70%",
                        opacity: pressed ? 0.65 : 1,
                      })}
                    >
                      <Mascot size={49} variant={data?.identity.avatar} />
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: colors.text,
                          letterSpacing: -0.4,
                        }}
                      >
                        {agentName}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 11, color: colors.muted, marginBottom: 6 }}
                      >
                        {status}
                      </Text>
                    </Pressable>
                    {section === "chat" && <ComputerEntry />}
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <LanguageSwitcher />
                    <View>
                      <IconButton
                        icon={Bell}
                        label={t("app.notificationsLabel", { count: pending })}
                        onPress={() => open({ type: "notifications" })}
                      />
                      {pending > 0 && (
                        <View
                          pointerEvents="none"
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 4,
                            position: "absolute",
                            top: 7,
                            right: 9,
                            backgroundColor: colors.blueDark,
                          }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              )}
              <View style={{ flex: 1, minHeight: 0 }}>
                {section !== "chat" && (
                  <ScrollView
                    key={section}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                      paddingHorizontal: desktop ? 28 : 22,
                      paddingBottom: 28,
                    }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {utility && (
                      <Button
                        small
                        style={{ alignSelf: "flex-start", marginBottom: 18 }}
                        onPress={() => navigate("apps")}
                      >
                        {t("app.backToApps")}
                      </Button>
                    )}
                    <Text style={[s.title, { fontSize: 25, marginBottom: 22 }]}>
                      {title && t(title.titleKey)}
                    </Text>
                    <ErrorNotice error={error} />
                    {section === "account" ? <AccountScreen onSignOut={onSignOut} /> : <Screen />}
                  </ScrollView>
                )}
                <View
                  style={{
                    display: section === "chat" ? "flex" : "none",
                    flex: 1,
                    paddingHorizontal: desktop ? 28 : 17,
                  }}
                >
                  <AgentStatus />
                  {richThreads ? (
                    <>
                      <ErrorNotice error={threadsError} />
                      {threadsError ? (
                        <Button onPress={retryThreads}>{t("app.retryMainChat")}</Button>
                      ) : threadsLoading ? (
                        <ActivityIndicator color={colors.blueDark} />
                      ) : null}
                      {/* visited 由 ThreadsProvider 维护（去重追加），但并发/重试下仍会
                          出现瞬时重复 id，这里按 id 先去重再渲染，避免 React 重复 key 告警。 */}
                      {[...new Map(visited.map((t) => [t.id, t])).values()].map((thread) => (
                        <View
                          key={thread.id}
                          style={{ display: selection.id === thread.id ? "flex" : "none", flex: 1 }}
                        >
                          <ChatScreen
                            thread={thread}
                            active={section === "chat" && selection.id === thread.id}
                            prompt={selection.id === thread.id ? prompt : undefined}
                          />
                        </View>
                      ))}
                    </>
                  ) : (
                    <ChatScreen prompt={prompt} active={section === "chat"} />
                  )}
                </View>
              </View>
              {!desktop && (
                <View
                  style={{
                    paddingHorizontal: 22,
                    paddingTop: 10,
                    paddingBottom: 7,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      width: "100%",
                      // 六个页签（含「我的」）比原来多一个，容器放宽以保证点击区域。
                      maxWidth: 430,
                      padding: 5,
                      backgroundColor: "#FFF",
                      borderRadius: 40,
                      shadowColor: "#312E81",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.07,
                      shadowRadius: 18,
                      elevation: 3,
                      borderWidth: 1,
                      borderColor: "#F8F8F8",
                    }}
                  >
                    {nav.map((item) => {
                      const active = section === item.id || (item.id === "apps" && utility);
                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="tab"
                          accessibilityLabel={t(item.labelKey)}
                          accessibilityState={{ selected: active }}
                          onPress={() => navigate(item.id)}
                          style={{
                            flex: 1,
                            height: 47,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: active ? "#EEF2FF" : "transparent",
                            borderRadius: 28,
                          }}
                        >
                          <item.icon size={23} strokeWidth={1.8} color={colors.text} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
        {!!toast && (
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", bottom: 94, left: 20, right: 20, alignItems: "center" }}
          >
            <View
              style={[
                s.row,
                {
                  gap: 10,
                  padding: 14,
                  backgroundColor: colors.text,
                  borderRadius: 20,
                  maxWidth: 560,
                },
              ]}
            >
              <Check size={16} color="#A5B4FC" />
              <Text style={{ color: "#FFF", fontSize: 13, flexShrink: 1 }}>{toast}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("app.dismissNotification")}
                onPress={clearToast}
              >
                <X size={16} color="#FFF" />
              </Pressable>
            </View>
          </View>
        )}
        {threadsOpen && <ThreadsSheet onClose={() => setThreadsOpen(false)} />}
        {detail && (
          <Details
            key={
              detail.type === "task"
                ? detail.taskId
                : detail.type === "file"
                  ? detail.file.id
                  : detail.type === "browser"
                    ? detail.browser.id
                    : detail.type === "mail"
                      ? detail.mail.id
                      : detail.type === "review"
                        ? detail.action.id
                        : detail.type === "email"
                          ? JSON.stringify(detail.draft)
                          : detail.type === "event"
                            ? detail.event?.id || "event-new"
                            : detail.type === "artifact"
                              ? detail.artifact.id
                              : detail.type
            }
            detail={detail}
          />
        )}
      </SafeAreaView>
    </>
  );
}
