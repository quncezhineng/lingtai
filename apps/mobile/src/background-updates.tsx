import { ArrowRight, Bell, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAgentWorkspace } from "./agent-workspace";
import { useTranslation } from "./i18n";
import { Button, Card, colors, ErrorNotice, resultSummary, s } from "./ui";
import { useWorkspace } from "./workspace";

export function BackgroundUpdates() {
  const { data, mutate } = useAgentWorkspace();
  const { open } = useWorkspace();
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const updates = data?.notifications.filter((item) => !item.read && item.taskId) || [];
  const update = updates[0];
  if (!update || data?.identity.showChatUpdates === false) return null;
  async function markRead() {
    if (!update) return false;
    setBusy(true);
    try {
      await mutate(`/notifications/${update.id}/read`, {});
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function dismiss() {
    await markRead();
  }
  // 打开任务就等于看过这条更新：和「通知」里一致地标为已读，右上角的提示随之收起。
  async function view() {
    if (!update?.taskId) return;
    if (await markRead()) open({ type: "task", taskId: update.taskId });
  }
  return (
    <Card style={{ backgroundColor: colors.sky, padding: 16, gap: 10 }}>
      <View style={[s.between, { gap: 12 }]}>
        <View style={[s.row, { gap: 7 }]}>
          <Bell size={14} color={colors.blueDark} />
          <Text style={s.small}>{t("tools.updateForYou")}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("tools.dismissBackgroundUpdate")}
          disabled={busy}
          onPress={() => void dismiss()}
          hitSlop={10}
          style={{ padding: 6 }}
        >
          <X size={16} color={colors.muted} />
        </Pressable>
      </View>
      <Text style={s.heading}>{update.title}</Text>
      <Text style={s.text}>{resultSummary(update.body)}</Text>
      <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Button small icon={ArrowRight} busy={busy} onPress={() => void view()}>
          {t("tools.viewTask")}
        </Button>
        {updates.length > 1 && (
          <Button small onPress={() => open({ type: "notifications" })}>
            {updates.length - 1 === 1
              ? t("tools.moreUpdatesOne")
              : t("tools.moreUpdates", { count: updates.length - 1 })}
          </Button>
        )}
      </View>
      <ErrorNotice error={error} />
    </Card>
  );
}
