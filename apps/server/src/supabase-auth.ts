/**
 * Supabase Auth 客户端。
 *
 * 灵台把「身份」交给 Supabase 托管（注册、密码、邮箱校验、第三方登录），
 * 自己只保存业务数据，并用 Supabase 用户的 uuid 作为工作区 owner，
 * 从而实现「不同用户的对话/文件/授权互相隔离」。
 *
 * 只依赖 fetch 调用 Supabase Auth 的 REST 接口，不引入额外 SDK：
 * - 注册：POST /auth/v1/admin/users（服务端角色密钥，直接标记邮箱已验证，注册即登录）
 * - 登录：POST /auth/v1/token?grant_type=password（匿名密钥）
 * - 邮箱验证码登录：POST /auth/v1/otp 发送验证码、POST /auth/v1/verify 校验并换取用户身份
 *
 * 登录成功后灵台会签发自己的会话令牌，后续请求不再访问 Supabase，
 * 因此每个 API 请求都不会产生额外的网络往返。
 */
import type { Config } from "./config.ts";
import { AppError } from "./errors.ts";

/** Supabase Auth 侧的用户标识，id 即灵台工作区 owner。 */
export interface SupabaseUser {
  id: string;
  email?: string;
}

/** GoTrue（Supabase Auth）的错误响应形状，兼容新旧两种字段命名。 */
interface SupabaseErrorBody {
  code?: string;
  msg?: string;
  message?: string;
  error?: string;
  error_description?: string;
}

export class SupabaseAuth {
  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly serviceRoleKey: string,
  ) {}

  private endpoint(path: string) {
    return `${this.url.replace(/\/+$/, "")}${path}`;
  }

  /** 统一发起请求并把 Supabase 的错误转换成用户可读的 AppError。 */
  private async request<T>(path: string, init: RequestInit, fallbackMessage: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.endpoint(path), init);
    } catch {
      throw new AppError("Cannot reach the sign-in service. Try again shortly.", 503);
    }
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      const body = (payload ?? {}) as SupabaseErrorBody;
      const detail =
        body.msg ?? body.message ?? body.error_description ?? body.error ?? body.code ?? "";
      const status = response.status === 429 ? 429 : response.status === 409 ? 409 : 401;
      throw new AppError(detail ? `${fallbackMessage} (${detail})` : fallbackMessage, status);
    }
    return payload as T;
  }

  private jsonHeaders(key: string): Record<string, string> {
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * 创建账号。
   *
   * 使用服务端角色密钥直接创建并标记邮箱已验证，用户无需等待邮件确认即可进入工作区；
   * 邮箱唯一性仍由 Supabase Auth 保证，重复注册会返回 409。
   */
  async signUp(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<SupabaseUser> {
    const payload = await this.request<{ user?: SupabaseUser; id?: string; email?: string }>(
      "/auth/v1/admin/users",
      {
        method: "POST",
        headers: this.jsonHeaders(this.serviceRoleKey),
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: input.displayName ? { display_name: input.displayName } : {},
        }),
      },
      "Could not create your account.",
    );
    const user = payload.user ?? payload;
    if (!user?.id) throw new AppError("Could not create your account.", 502);
    return { id: user.id, email: user.email ?? input.email };
  }

  /** 用邮箱 + 密码换取 Supabase 会话，仅取其中的用户身份。 */
  async signIn(input: { email: string; password: string }): Promise<SupabaseUser> {
    const payload = await this.request<{ user?: SupabaseUser }>(
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        headers: this.jsonHeaders(this.anonKey),
        body: JSON.stringify({ email: input.email, password: input.password }),
      },
      "Email or password is incorrect.",
    );
    if (!payload.user?.id) throw new AppError("Email or password is incorrect.", 401);
    return { id: payload.user.id, email: payload.user.email ?? input.email };
  }

  /**
   * 发送邮箱验证码。
   *
   * 调用 Supabase Auth 的 OTP 接口；`create_user: true` 让未注册邮箱在验证时自动建档，
   * 这样「验证码登录」对首次使用的邮箱同样成立。是否发送 6 位验证码（而非魔法链接）
   * 由 Supabase Auth 控制台里的「Email OTP」开关决定。
   */
  async sendOtp(email: string): Promise<void> {
    await this.request(
      "/auth/v1/otp",
      {
        method: "POST",
        headers: this.jsonHeaders(this.anonKey),
        body: JSON.stringify({ email, create_user: true }),
      },
      "Could not send the verification code.",
    );
  }

  /**
   * 校验邮箱验证码并返回 Supabase 用户身份。
   *
   * 验证成功后 Supabase 会返回会话与用户信息；灵台只取其中的用户 id/email，
   * 随后签发自己的会话令牌（见 auth.ts），不再依赖 Supabase 会话。
   */
  async verifyOtp(email: string, token: string): Promise<SupabaseUser> {
    const payload = await this.request<{ user?: SupabaseUser }>(
      "/auth/v1/verify",
      {
        method: "POST",
        headers: this.jsonHeaders(this.anonKey),
        body: JSON.stringify({ type: "email", email, token }),
      },
      "Verification code is incorrect.",
    );
    if (!payload.user?.id) throw new AppError("Verification code is incorrect.", 401);
    return { id: payload.user.id, email: payload.user.email ?? email };
  }

  /**
   * 读取灵台档案（头像、昵称等展示信息）。
   *
   * 头像与昵称统一由 user_profiles 维护（主应用写入，缺失则回退会话里的邮箱前缀），
   * 邮箱则直接来自登录会话（Supabase Auth 的 auth.users），不再单独存表。
   * 因此这里用服务端角色密钥直接读表。这只是展示信息，读失败不应影响登录，
   * 所以吞掉错误并返回空对象。
   */
  async readProfile(userId: string): Promise<{
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  }> {
    try {
      const response = await fetch(
        this.endpoint(
          `/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}&select=nickname,bio,avatar_url&limit=1`,
        ),
        { headers: this.jsonHeaders(this.serviceRoleKey) },
      );
      if (!response.ok) return {};
      const rows = (await response.json()) as {
        nickname?: string | null;
        bio?: string | null;
        avatar_url?: string | null;
      }[];
      const row = rows[0];
      if (!row) return {};
      const avatarPath = row.avatar_url?.trim() || undefined;
      return {
        displayName: row.nickname?.trim() || undefined,
        bio: row.bio?.trim() || undefined,
        // 头像存在私有桶里，需要签名后才能被前端直接加载；签不到就退回首字母。
        avatarUrl: avatarPath ? await this.signAvatarUrl(avatarPath) : undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * 把 user_profiles.avatar_url 的相对路径转成带签名的完整可访问 URL。
   *
   * 头像统一存于私有桶 user-avatars，前端无法直接读取，需要服务端用 service_role
   * 密钥调用 Storage 的签名接口，换取一段临时有效的完整地址。签名接口失败时返回
   * undefined（前端退回昵称首字母），不影响档案其它信息的展示。
   */
  private async signAvatarUrl(avatarPath: string): Promise<string | undefined> {
    // 已经是完整 URL 时直接返回，避免对 http/https 地址再做无谓的签名。
    if (/^https?:\/\//i.test(avatarPath)) return avatarPath;
    try {
      const objectPath = avatarPath.replace(/^\/+/, "");
      const payload = await this.request<{ signedURL?: string }>(
        `/storage/v1/object/sign/user-avatars/${objectPath}`,
        {
          method: "POST",
          headers: this.jsonHeaders(this.serviceRoleKey),
          body: JSON.stringify({ expiresIn: 3600 }),
        },
        "Could not sign the avatar.",
      );
      if (!payload.signedURL) return undefined;
      // Supabase 返回的是相对路径（/object/sign/...?token=...），需拼上
      // supabaseUrl + /storage/v1 前缀才是可公开访问的完整地址。
      if (/^https?:\/\//i.test(payload.signedURL)) return payload.signedURL;
      return `${this.url.replace(/\/+$/, "")}/storage/v1${payload.signedURL}`;
    } catch {
      return undefined;
    }
  }
}

/** 仅在配置了 Supabase 项目时返回客户端，否则返回 undefined（回退到访问密钥模式）。 */
export function createSupabaseAuth(config: Config): SupabaseAuth | undefined {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = config;
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) return undefined;
  return new SupabaseAuth(supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey);
}
