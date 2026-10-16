import {
  CalendarClock,
  IdCard,
  LogOut,
  type LucideIcon,
  Mail,
  Monitor,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import type { AccountProfile } from "./api";
import { useTranslation } from "./i18n";
import { Button, Card, colors, dateLabel, ErrorNotice, s, timeLabel } from "./ui";
import { useWorkspace } from "./workspace";

/** 个人信息里的一行：图标 + 名称 + 取值。 */
function ProfileRow({
  icon: Icon,
  label,
  value,
  divided,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  divided?: boolean;
}) {
  return (
    <View
      style={[
        s.row,
        { gap: 14, paddingVertical: 13 },
        divided && { borderTopWidth: 1, borderTopColor: colors.line },
      ]}
    >
      <View style={s.iconBox}>
        <Icon size={18} color={colors.blueDark} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.small}>{label}</Text>
        <Text selectable style={[s.text, { fontWeight: "500" }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/**
 * 「我的」页面：展示当前登录用户的昵称、邮箱等个人信息，并提供退出登录。
 *
 * 数据来自 /api/auth/me：owner（账号 ID）、邮箱与昵称都随会话隔离，
 * 因此换一个账号登录看到的完全是另一份信息。
 */
export function AccountScreen({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  const { api } = useWorkspace();
  const [profile, setProfile] = useState<AccountProfile>();
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setProfile(await api.request<AccountProfile>("/api/auth/me"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!profile && !error)
    return (
      <View style={{ alignItems: "center", padding: 40, gap: 13 }}>
        <ActivityIndicator color={colors.blueDark} />
        <Text style={s.muted}>{t("app.profileLoading")}</Text>
      </View>
    );
  if (!profile)
    return (
      <View style={{ gap: 12 }}>
        <ErrorNotice error={error} />
        <Button onPress={() => void load()}>{t("common.tryAgain")}</Button>
      </View>
    );
  const nickname = profile.displayName || t("app.profileUnset");
  const email = profile.email || t("app.profileUnset");
  // 简介：来自 user_profiles.bio，未填写时显示占位文案。
  const bio = profile.bio || t("app.profileUnset");
  // 头像优先用 Supabase 里的头像地址，取不到再退回昵称/邮箱首字母。
  const initial = (profile.displayName || profile.email || "?").trim().charAt(0).toUpperCase();
  const expiresAt = new Date(profile.expiresAt).toISOString();
  return (
    <View style={{ gap: 22 }}>
      <Card style={{ alignItems: "center", gap: 9, paddingVertical: 28 }}>
        <View
          style={{
            width: 66,
            height: 66,
            borderRadius: 33,
            backgroundColor: colors.lavender,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={{ width: 66, height: 66 }} />
          ) : (
            <Text style={{ fontSize: 26, fontWeight: "600", color: colors.primary }}>
              {initial}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 19, fontWeight: "600", color: colors.text }}>{nickname}</Text>
        <Text style={s.muted}>{bio}</Text>
      </Card>
      <View style={{ gap: 10 }}>
        <Text style={s.heading}>{t("app.profileDetails")}</Text>
        <Card style={{ paddingVertical: 4 }}>
          <ProfileRow icon={UserRound} label={t("app.profileNickname")} value={nickname} />
          <ProfileRow divided icon={Mail} label={t("app.emailLabel")} value={email} />
          <ProfileRow divided icon={IdCard} label={t("app.profileAccountId")} value={profile.id} />
          <ProfileRow
            divided
            icon={ShieldCheck}
            label={t("app.profileSignInMethod")}
            value={
              profile.authMode === "supabase"
                ? t("app.profileSignInAccount")
                : t("app.profileSignInKey")
            }
          />
          <ProfileRow
            divided
            icon={Monitor}
            label={t("app.profileMode")}
            value={profile.mode === "live" ? t("app.profileModeLive") : t("app.profileModeSample")}
          />
          <ProfileRow
            divided
            icon={CalendarClock}
            label={t("app.profileSessionExpires")}
            value={`${dateLabel(expiresAt)} ${timeLabel(expiresAt)}`}
          />
        </Card>
      </View>
      <View style={{ gap: 10 }}>
        <Button danger icon={LogOut} onPress={onSignOut}>
          {t("app.signOutLabel")}
        </Button>
        <Text style={[s.small, { textAlign: "center" }]}>{t("app.signOutHint")}</Text>
      </View>
    </View>
  );
}
