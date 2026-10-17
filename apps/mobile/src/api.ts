import { Platform } from "react-native";
import { readApiPayload } from "./api-response";

// 默认指向本机后端。这里用 127.0.0.1 而不是 localhost，是因为部分环境的 DNS 或系统代理
// 会把 localhost 解析成 ::1（IPv6）或代理虚拟地址，而后端默认只监听 IPv4 的 127.0.0.1，
// 导致浏览器请求时报 "Failed to fetch"。显式用 IPv4 loopback 可稳定连上本机后端。
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://127.0.0.1:8787")
).replace(/\/$/, "");

export class LingTaiApi {
  constructor(readonly token: string) {}
  async request<T>(path: string, body?: unknown, method?: string): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    const payload = await readApiPayload<T>(response);
    return payload;
  }
  url(path: string) {
    return path.startsWith("http") ? path : `${API_URL}${path}`;
  }
}

export async function createSession(
  accessKey?: string,
): Promise<{ token: string; mode: "sample" | "live" }> {
  const response = await fetch(`${API_URL}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey }),
  });
  const payload = await readApiPayload<{ token: string; mode: "sample" | "live" }>(
    response,
    "Could not open your workspace.",
  );
  return payload;
}

/**
 * 登录方式：
 * - "supabase"：每个用户用邮箱注册/登录，各自拥有独立工作区；
 * - "access-key"：整个部署共用一个访问密钥（单用户部署）。
 */
export type AuthMode = "supabase" | "access-key";

/** 登录成功后返回的会话：token 标识当前用户的工作区。 */
export interface AccountSession {
  token: string;
  mode: "sample" | "live";
  user: { id: string; email: string };
}

/** 询问服务端本部署使用哪种登录方式，用于决定展示哪个登录界面。 */
export async function authConfig(): Promise<{ mode: "sample" | "live"; authMode: AuthMode }> {
  const response = await fetch(`${API_URL}/api/auth/config`);
  return await readApiPayload<{ mode: "sample" | "live"; authMode: AuthMode }>(
    response,
    "Could not reach your workspace.",
  );
}

/** 请求向邮箱发送验证码（Supabase 内置 Email OTP）。 */
export async function requestOtp(email: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  await readApiPayload<{ ok: boolean }>(response, "Could not send the verification code.");
}

/** 用邮箱与验证码登录；未注册邮箱会自动建档，成功后进入该用户工作区。 */
export async function verifyOtp(input: { email: string; code: string }): Promise<AccountSession> {
  const response = await fetch(`${API_URL}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await readApiPayload<AccountSession>(response, "Could not sign you in.");
}

/**
 * 当前登录用户的档案：供「我的」页面展示个人信息。
 *
 * displayName / avatarUrl 来自 Supabase 侧 user_profiles 表，
 * email 来自登录会话；取不到时对应字段为 null。
 */
export interface AccountProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  authMode: AuthMode;
  mode: "sample" | "live";
  /** 会话到期时间戳（毫秒）。 */
  expiresAt: number;
}
