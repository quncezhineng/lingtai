/**
 * 宽屏外壳：左侧图标栏 + 对话列表栏。
 *
 * 布局（窗口宽度 >= 900 时启用，见 App.tsx 的 `desktop` 判断）：
 *
 *   [ 图标栏 76 ] [ 对话列表 248，仅「对话」页 ] [ 主内容区 ]
 *
 * 图标栏顶部是智能体头像与状态，中间是五个主页面，底部是通知、语言与「我的」；
 * 对话列表栏把会话分成「主要聊天」与「旁聊」两组，底部可以直接新建旁聊。
 * 窄屏仍沿用底部标签栏，两套外壳共用同一份状态与页面组件，不存在第二套实现。
 */
import { useThreads } from "@copilotkit/react-native/headless";
import {
  Archive,
  Bell,
  Check,
  CircleUserRound,
  Lightbulb,
  type LucideIcon,
  MessageCircle,
  MoreHorizontal,
  PanelsTopLeft,
  Pencil,
  Plus,
  Search,
  Shapes,
  SquareCheck,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { Section } from "../../../packages/domain/src";
import { useAgentWorkspace } from "./agent-workspace";
import { useTranslation } from "./i18n";
import { LanguageSwitcher } from "./i18n/LanguageSwitcher";
import type { TranslationKey } from "./i18n/locales/en";
import { relativeDate } from "./relative-date";
import { useLingWuThread } from "./threads";
import { Button, colors, ErrorNotice, Mascot, s } from "./ui";
import { useWorkspace } from "./workspace";

/** 图标栏中间的主页面（底部的「我的」单独列出，见 ACCOUNT_NAV）。 */
export const SECTION_NAV: { id: Section; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { id: "chat", labelKey: "app.navChat", icon: MessageCircle },
  { id: "activity", labelKey: "app.navActivity", icon: PanelsTopLeft },
  { id: "ideas", labelKey: "app.navIdeas", icon: Lightbulb },
  { id: "goals", labelKey: "app.navGoals", icon: SquareCheck },
  { id: "apps", labelKey: "app.navApps", icon: Shapes },
];

/** 图标栏底部的「我的」。 */
export const ACCOUNT_NAV: { id: Section; labelKey: TranslationKey; icon: LucideIcon } = {
  id: "account",
  labelKey: "app.navAccount",
  icon: CircleUserRound,
};

export const RAIL_WIDTH = 76;
export const CHATS_WIDTH = 248;

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

/** 图标栏里的一项：图标在上、文字在下，选中时用品牌浅紫底与强调色图标。 */
function RailItem({
  icon: Icon,
  label,
  active,
  badge,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        position: "relative",
        width: 60,
        alignItems: "center",
        gap: 3,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: active ? colors.sky : pressed ? colors.line : "transparent",
      })}
    >
      <Icon
        size={21}
        strokeWidth={active ? 2.1 : 1.7}
        color={active ? colors.blueDark : colors.muted}
      />
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10.5,
          lineHeight: 13,
          fontWeight: "500",
          color: active ? colors.text : colors.muted,
        }}
      >
        {label}
      </Text>
      {!!badge && badge > 0 && (
        <View
          style={{
            position: "absolute",
            top: 2,
            right: 6,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            paddingHorizontal: 4,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F43F5E",
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * 左侧图标栏。头像与名字来自工作区身份，状态行与窄屏顶部一致；
 * 底部依次是通知、语言与「我的」入口（宽屏没有顶部栏，语言按钮收纳在这里）。
 */
export function Rail({ name, pending }: { name: string; pending: number }) {
  const { section, navigate, open } = useWorkspace();
  const { t } = useTranslation();
  const { data } = useAgentWorkspace();

  return (
    <View
      style={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        zIndex: 20,
        alignItems: "center",
        borderRightWidth: 1,
        borderRightColor: colors.line,
        backgroundColor: "#FBFBFC",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("agent.personalityMemory")}
        onPress={() => open({ type: "personality" })}
        style={({ pressed }) => ({
          alignItems: "center",
          gap: 4,
          paddingTop: 14,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Mascot size={44} variant={data?.identity.avatar} />
        <Text
          numberOfLines={1}
          style={{
            maxWidth: 68,
            fontSize: 11,
            fontWeight: "600",
            color: colors.text,
            letterSpacing: -0.2,
          }}
        >
          {name}
        </Text>
      </Pressable>

      <ScrollView
        style={{ width: "100%", flex: 1, marginTop: 12 }}
        contentContainerStyle={{ alignItems: "center", gap: 2, paddingHorizontal: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTION_NAV.map((item) => (
          <RailItem
            key={item.id}
            icon={item.icon}
            label={t(item.labelKey)}
            active={section === item.id}
            onPress={() => navigate(item.id)}
          />
        ))}
      </ScrollView>

      <View
        style={{
          width: "100%",
          alignItems: "center",
          gap: 2,
          paddingHorizontal: 8,
          paddingBottom: 14,
          paddingTop: 6,
        }}
      >
        {/* 通知与语言从「更多」菜单移出，直接放在「我的」上方，减少一级菜单。 */}
        <RailItem
          icon={Bell}
          label={t("app.menuNotifications")}
          active={false}
          badge={pending}
          onPress={() => open({ type: "notifications" })}
        />
        <LanguageSwitcher vertical />
        <RailItem
          icon={ACCOUNT_NAV.icon}
          label={t(ACCOUNT_NAV.labelKey)}
          active={section === ACCOUNT_NAV.id}
          onPress={() => navigate(ACCOUNT_NAV.id)}
        />
      </View>
    </View>
  );
}

/**
 * 小窗里的一个操作行：图标 + 文案，可标记危险色。
 * 整行是一个独立按钮，不嵌套在其他交互组件内，避免 react-native-web 冒泡问题。
 */
function MenuAction({
  icon: Icon,
  label,
  danger,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: 12,
        backgroundColor: pressed ? colors.line : "transparent",
      })}
    >
      <Icon size={17} strokeWidth={2} color={color} />
      <Text style={{ fontSize: 14, fontWeight: "500", color }}>{label}</Text>
    </Pressable>
  );
}

/**
 * 旁聊操作下拉菜单：点击铅笔图标后在按钮旁弹出，提供「重命名 / 归档 / 删除」。
 * 无标题栏，按 anchor 坐标紧贴按钮定位；删除为不可恢复操作，先进入确认步骤，确认后才真正删除。
 */
/** 下拉菜单锚点：记录铅笔按钮的点击坐标与目标线程 id，用于紧贴按钮定位。 */
type MenuAnchor = { x: number; y: number; id: string };

function ThreadActionsMenu({
  anchor,
  onRename,
  onArchive,
  onDelete,
  onClose,
}: {
  anchor: MenuAnchor;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [confirming, setConfirming] = useState(false);
  // 菜单紧贴按钮下方展开，超出右/下边缘时向回夹紧，避免溢出屏幕。
  const menuWidth = 160;
  const card = {
    position: "absolute" as const,
    left: Math.max(8, Math.min(anchor.x - menuWidth + 28, width - menuWidth - 8)),
    top: anchor.y + 10,
    width: menuWidth,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  } as const;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      {/* 透明背板：点击菜单外任意处关闭菜单 */}
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "transparent" }}>
        {/* 菜单面板：自身拦截点击，避免面板内点击冒泡到背板导致误关 */}
        <Pressable
          accessibilityViewIsModal
          onPress={(e) => e.stopPropagation()}
          style={[card, { gap: 4 }]}
        >
          {confirming ? (
            <>
              <Text
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.text,
                }}
              >
                {t("threads.deleteConfirmTitle")}
              </Text>
              <Text
                style={{
                  paddingHorizontal: 10,
                  paddingBottom: 8,
                  fontSize: 12,
                  lineHeight: 17,
                  color: colors.muted,
                }}
              >
                {t("threads.deleteConfirmNote")}
              </Text>
              <MenuAction
                icon={Trash2}
                label={t("threads.permanentlyDelete")}
                danger
                onPress={onDelete}
              />
              <MenuAction icon={X} label={t("common.cancel")} onPress={onClose} />
            </>
          ) : (
            <>
              <MenuAction icon={Pencil} label={t("threads.rename")} onPress={onRename} />
              <MenuAction icon={Archive} label={t("threads.archive")} onPress={onArchive} />
              <MenuAction
                icon={Trash2}
                label={t("threads.delete")}
                danger
                onPress={() => setConfirming(true)}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 对话列表里的一行：名字一行、说明一行，选中时用品牌浅紫底。 */
function ThreadRow({
  title,
  detail,
  active,
  onPress,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: {
  title: string;
  detail: string;
  active: boolean;
  onPress: () => void;
  editing?: boolean;
  draft?: string;
  onDraftChange?: (value: string) => void;
  // onStartEdit 传递铅笔按钮的点击坐标（pageX/pageY），供下拉菜单紧贴按钮定位。
  onStartEdit?: (x: number, y: number) => void;
  onCommitEdit?: () => void;
  onCancelEdit?: () => void;
}) {
  const { t } = useTranslation();
  // 整行按钮负责「选中对话」；操作入口是右侧一枚独立的铅笔图标，不能嵌套在按钮里。
  // 原因：react-native-web 的 PressResponder 在 onClick 里调用 stopPropagation，
  // 内层可点元素会把点击吞掉，导致外层 `select` 永远触发不了（点击按钮没反应）。
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={editing ? t("app.renameChatPlaceholder") : title}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        disabled={editing}
        style={({ pressed }) => ({
          flex: 1,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: active ? colors.sky : pressed ? colors.line : "transparent",
        })}
      >
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={onDraftChange}
            onSubmitEditing={onCommitEdit}
            onBlur={onCancelEdit}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            accessibilityLabel={t("app.renameChatPlaceholder")}
            style={{
              fontSize: 13.5,
              fontWeight: "500",
              color: colors.text,
              paddingVertical: 0,
              borderBottomWidth: 1,
              borderBottomColor: colors.blueDark,
            }}
          />
        ) : (
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "500", color: colors.text }}>
            {title}
          </Text>
        )}
        <Text numberOfLines={1} style={{ fontSize: 11.5, lineHeight: 16, color: colors.muted }}>
          {detail}
        </Text>
      </Pressable>
      {onStartEdit != null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? t("threads.saveName") : t("threads.actions")}
          onPress={(e) => {
            if (editing) {
              onCommitEdit?.();
              return;
            }
            const { pageX, pageY } = e.nativeEvent;
            onStartEdit?.(pageX, pageY);
          }}
          hitSlop={8}
          style={({ pressed }) => ({
            marginRight: 8,
            padding: 6,
            borderRadius: 10,
            backgroundColor: pressed ? colors.line : "transparent",
          })}
        >
          {editing ? (
            <Check size={15} strokeWidth={2.2} color={colors.blueDark} />
          ) : (
            <MoreHorizontal size={15} strokeWidth={2} color={colors.muted} />
          )}
        </Pressable>
      )}
    </View>
  );
}

/**
 * 对话列表栏：搜索框、按「主要聊天 / 旁聊」分组的会话列表，底部新建旁聊。
 *
 * 新建时线程由运行时懒创建，名字先记在本地（draftNames），等它出现在会话列表里再改名。
 */
export function ChatsColumn() {
  const { t } = useTranslation();
  const { notify } = useWorkspace();
  const { selection, visited, mainId, select, start, enabled, loading, error, retry } =
    useLingWuThread();
  const threads = useThreads({ agentId: "default", enabled, includeArchived: false, limit: 20 });
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  // 内联重命名：editingId 为当前正在改名的线程（服务端已存在的旁聊才算数）。
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState("");
  // 旁聊操作下拉菜单：menuAnchor 记录铅笔按钮点击坐标与目标线程 id。
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor>();

  // 侧边对话懒创建：名字先留在本地，等它第一次出现在服务端列表里再改名。
  const renameThread = threads.renameThread;
  useEffect(() => {
    if (!enabled) return;
    const ready = Object.entries(draftNames).filter(([id]) =>
      threads.threads.some((saved) => saved.id === id),
    );
    if (!ready.length) return;
    setDraftNames((map) => {
      const next = { ...map };
      for (const [id] of ready) delete next[id];
      return next;
    });
    for (const [id, name] of ready) {
      void renameThread(id, name).catch((e) => notify(errorText(e)));
    }
  }, [draftNames, enabled, notify, renameThread, threads.threads]);

  // 提交内联重命名；名字为空则视为取消。
  const commitRename = (id: string) => {
    const name = draft.trim();
    setEditingId(undefined);
    if (!name || threads.isMutating) return;
    void renameThread(id, name)
      .then(() => setEditingId(undefined))
      .catch((e) => notify(errorText(e)));
  };

  // 下拉菜单「重命名」：关闭菜单并进入内联改名。
  const renameFromMenu = () => {
    const thread = menuAnchor
      ? threads.threads.find((saved) => saved.id === menuAnchor.id)
      : undefined;
    if (!thread) return;
    setMenuAnchor(undefined);
    setEditingId(thread.id);
    setDraft(thread.name || "");
  };

  // 下拉菜单「归档」：成功后若选中的正是它，回主对话；失败保留菜单便于重试。
  const archiveFromMenu = () => {
    const id = menuAnchor?.id;
    if (!id || threads.isMutating) return;
    void threads
      .archiveThread(id)
      .then(() => {
        setMenuAnchor(undefined);
        if (selection.id === id) select({ id: mainId, existing: true });
      })
      .catch((e) => notify(errorText(e)));
  };

  // 下拉菜单「删除」：不可恢复，前端已二次确认；成功后若选中的正是它，回主对话。
  const deleteFromMenu = () => {
    const id = menuAnchor?.id;
    if (!id || threads.isMutating) return;
    void threads
      .deleteThread(id)
      .then(() => {
        setMenuAnchor(undefined);
        if (selection.id === id) select({ id: mainId, existing: true });
      })
      .catch((e) => notify(errorText(e)));
  };

  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);

  const mainThread = threads.threads.find((saved) => saved.id === mainId);
  const mainName = t("app.mainChatsHeading");
  // 下拉菜单弹出时从最新线程列表里取到当前目标，避免依赖快照状态。
  const menuThread = menuAnchor
    ? threads.threads.find((saved) => saved.id === menuAnchor.id)
    : undefined;
  // CopilotKit 运行时会在列表首屏直出服务端线程（含平台随机生成的 slug id），
  // 曾短暂返回同 id 两条记录；且一个本地待建的旁聊首次上线服务端列表时，同一 id
  // 会同时出现在 sideThreads 与 pendingThreads（同父级兄弟节点，key 必须互斥），
  // 因此两列表各自按 id 去重之外，还要跨列表排除，避免 React 重复 key 告警。
  const seenSideIds = new Set<string>();
  const sideThreads = threads.threads.filter((saved) => {
    if (saved.id === mainId || !matches(saved.name || "") || seenSideIds.has(saved.id))
      return false;
    seenSideIds.add(saved.id);
    return true;
  });
  const seenPendingIds = new Set<string>();
  const pendingThreads = visited.filter((item) => {
    if (
      item.id === mainId ||
      seenSideIds.has(item.id) ||
      threads.threads.some((saved) => saved.id === item.id) ||
      !matches(draftNames[item.id] ?? t("threads.untitledConversation")) ||
      seenPendingIds.has(item.id)
    )
      return false;
    seenPendingIds.add(item.id);
    return true;
  });

  const create = (name?: string) => {
    const id = start();
    const trimmed = (name ?? "").trim();
    if (trimmed) setDraftNames((map) => ({ ...map, [id]: trimmed }));
    setTitle("");
  };

  return (
    <View
      style={{
        width: CHATS_WIDTH,
        flexShrink: 0,
        borderRightWidth: 1,
        borderRightColor: colors.line,
        backgroundColor: "#FAFAFB",
      }}
    >
      <View style={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 }}>
        <Text
          style={{
            paddingHorizontal: 4,
            fontSize: 15,
            fontWeight: "600",
            color: colors.text,
            letterSpacing: -0.3,
          }}
        >
          {t("app.chatsColumnTitle")}
        </Text>
        <View
          style={[
            s.row,
            {
              gap: 8,
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: "#F1F2F3",
            },
          ]}
        >
          <Search size={14} strokeWidth={1.8} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("app.searchChatsPlaceholder")}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t("app.searchChatsPlaceholder")}
            style={{ flex: 1, minWidth: 0, fontSize: 13, color: colors.text, paddingVertical: 2 }}
          />
          {!!query && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              onPress={() => setQuery("")}
            >
              <X size={14} strokeWidth={1.8} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12, gap: 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {enabled && loading && (
          <Text style={[s.small, { paddingHorizontal: 12, paddingVertical: 8 }]}>
            {t("app.openingWorkspace")}
          </Text>
        )}
        <ErrorNotice error={error} />
        {!!error && (
          <Button small onPress={retry} style={{ marginHorizontal: 12 }}>
            {t("app.retryMainChat")}
          </Button>
        )}

        <Text style={columnHeading}>{mainName}</Text>
        <ThreadRow
          title={t("app.mainChatName")}
          detail={
            mainThread
              ? relativeDate(mainThread.lastRunAt ?? mainThread.updatedAt)
              : t("threads.mainChatDetail")
          }
          active={selection.id === mainId}
          onPress={() => select({ id: mainId, existing: true })}
        />

        {enabled ? (
          <>
            <View style={[s.between, { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 2 }]}>
              <Text style={columnHeadingCompact}>{t("app.sideChatsHeading")}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("app.newSideChatPlaceholder")}
                onPress={() => create()}
                style={({ pressed }) => ({
                  width: 24,
                  height: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: pressed ? colors.line : "transparent",
                })}
              >
                <Plus size={15} strokeWidth={1.9} color={colors.muted} />
              </Pressable>
            </View>

            {sideThreads.map((thread) => (
              <ThreadRow
                key={thread.id}
                title={thread.name || t("threads.untitledConversation")}
                detail={relativeDate(thread.lastRunAt ?? thread.updatedAt)}
                active={selection.id === thread.id}
                onPress={() => select({ id: thread.id, existing: true })}
                editing={editingId === thread.id}
                draft={draft}
                onDraftChange={setDraft}
                onStartEdit={(x, y) => {
                  setMenuAnchor({ x, y, id: thread.id });
                  setEditingId(undefined);
                }}
                onCommitEdit={() => commitRename(thread.id)}
                onCancelEdit={() => setEditingId(undefined)}
              />
            ))}
            {pendingThreads.map((item, index) => (
              <ThreadRow
                key={item.id}
                title={draftNames[item.id] || t("threads.sideChatNumber", { index: index + 1 })}
                detail={t("threads.openInThisApp")}
                active={selection.id === item.id}
                onPress={() => select(item)}
              />
            ))}
            {!sideThreads.length && !pendingThreads.length && (
              <Text style={[s.small, { paddingHorizontal: 12, paddingVertical: 8 }]}>
                {t("threads.emptyActive")}
              </Text>
            )}
          </>
        ) : (
          <Text style={[s.small, { paddingHorizontal: 12, paddingVertical: 8 }]}>
            {t("threads.workspaceSavedNote")}
          </Text>
        )}
      </ScrollView>

      <View
        style={[s.row, { gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line }]}
      >
        <TextInput
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={() => create(title)}
          placeholder={t("app.newSideChatPlaceholder")}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t("app.newSideChatPlaceholder")}
          style={{
            flex: 1,
            minWidth: 0,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: "#F1F2F3",
            fontSize: 13,
            color: colors.text,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("app.createSideChatLabel")}
          onPress={() => create(title)}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: colors.blue,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Plus size={17} strokeWidth={2.2} color={colors.onPrimary} />
        </Pressable>
      </View>
      {menuThread && menuAnchor && (
        <ThreadActionsMenu
          anchor={menuAnchor}
          onRename={renameFromMenu}
          onArchive={archiveFromMenu}
          onDelete={deleteFromMenu}
          onClose={() => setMenuAnchor(undefined)}
        />
      )}
    </View>
  );
}

const columnHeading = {
  fontSize: 11,
  fontWeight: "600" as const,
  letterSpacing: 0.6,
  color: colors.muted,
  paddingHorizontal: 12,
  paddingTop: 10,
  paddingBottom: 4,
};

const columnHeadingCompact = { ...columnHeading, paddingHorizontal: 0, paddingTop: 0 };
