import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config.ts";
import type { Store } from "./db.ts";
import { AppError } from "./errors.ts";
import { signJwt, verifyJwt } from "./jwt.ts";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** 一条登录会话。id 即 JWT 的 jti，与令牌一一对应。 */
export interface SessionRecord {
  id: string;
  owner: string;
  email?: string;
  /** 登录设备的可读标识（User-Agent 摘要），用于多端管理页展示。 */
  device?: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  /** 被远程下线或主动退出后写入时间戳，该会话立即失效。 */
  revokedAt?: number;
}
export class Auth {
  constructor(
    private readonly db: Store,
    private readonly config: Config,
    private readonly signingKey: string,
  ) {}
  /** 会话有效期（毫秒），默认 24 小时。 */
  private ttl() {
    return this.config.sessionTtlMs ?? 24 * 60 * 60 * 1000;
  }
  /**
   * 为指定 owner 签发登录会话。
   *
   * 返回一个标准 JWT（含 sub=owner、jti=会话 id、exp=过期时间），同时在
   * system/sessions 里落一条会话记录用于「多端列表」和「远程下线」。
   * owner 即工作区标识：账号体系下是 Supabase 用户 uuid，访问密钥模式下是固定的 local-user。
   */
  async issue(owner: string, email?: string, device?: string) {
    const jti = randomBytes(16).toString("base64url");
    const now = Date.now();
    const expiresAt = now + this.ttl();
    const record: SessionRecord = {
      id: jti,
      owner,
      email,
      device,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    };
    await this.db.put("system", "sessions", record);
    const token = signJwt(
      {
        sub: owner,
        email,
        jti,
        iat: Math.floor(now / 1000),
        exp: Math.floor(expiresAt / 1000),
      },
      this.signingKey,
    );
    return { token, mode: this.config.mode, expiresAt, sessionId: jti };
  }
  /** 单一共享访问密钥模式：校验密钥后为固定 owner 签发会话。 */
  async session(accessKey?: string, device?: string) {
    if (
      this.config.mode === "live" &&
      (!accessKey ||
        !this.config.accessKey ||
        !timingSafeEqual(digest(accessKey), digest(this.config.accessKey)))
    )
      throw new AppError("Access key is incorrect", 401);
    return this.issue("local-user", undefined, device);
  }
  /** 读取会话详情：先验 JWT 签名/过期，再查库确认会话未被撤销。 */
  async profile(authorization?: string) {
    if (!authorization?.startsWith("Bearer ")) throw new AppError("Sign in to LingTai", 401);
    const claims = verifyJwt(authorization.slice(7), this.signingKey);
    if (!claims) throw new AppError("Session expired. Sign in again.", 401);
    const session = await this.db.get<SessionRecord>("system", "sessions", claims.jti);
    if (!session || session.revokedAt || session.expiresAt < Date.now())
      throw new AppError("Session expired. Sign in again.", 401);
    return {
      owner: session.owner,
      email: session.email,
      expiresAt: session.expiresAt,
      sessionId: session.id,
    };
  }
  async owner(authorization?: string) {
    return (await this.profile(authorization)).owner;
  }
  /** 列出某个用户当前所有活跃会话，用于多端登录管理。 */
  async sessions(owner: string): Promise<SessionRecord[]> {
    const records = await this.db.listByField<SessionRecord>("system", "sessions", "owner", owner);
    return records.filter((s) => !s.revokedAt && s.expiresAt >= Date.now());
  }
  /** 远程下线某个会话；只能下线属于当前登录用户的会话。 */
  async revokeSession(owner: string, sessionId: string): Promise<boolean> {
    const session = await this.db.get<SessionRecord>("system", "sessions", sessionId);
    if (!session || session.owner !== owner) return false;
    await this.db.put("system", "sessions", { ...session, revokedAt: Date.now() });
    return true;
  }
  /** 退出登录：作废当前会话令牌。 */
  async revoke(authorization?: string) {
    if (!authorization?.startsWith("Bearer ")) return;
    const claims = verifyJwt(authorization.slice(7), this.signingKey);
    if (!claims) return;
    const session = await this.db.get<SessionRecord>("system", "sessions", claims.jti);
    if (session) await this.db.put("system", "sessions", { ...session, revokedAt: Date.now() });
  }
  sign(owner: string, path: string) {
    const expires = String(Date.now() + 15 * 60 * 1000);
    const signature = createHmac("sha256", this.signingKey)
      .update(`${owner}\n${path}\n${expires}`)
      .digest("hex");
    return `${this.config.publicUrl}${path}?owner=${encodeURIComponent(owner)}&expires=${expires}&signature=${signature}`;
  }
  verify(url: URL) {
    const owner = url.searchParams.get("owner") ?? "";
    const expires = url.searchParams.get("expires") ?? "";
    const signature = url.searchParams.get("signature") ?? "";
    if (
      !owner ||
      !/^\d+$/.test(expires) ||
      Number(expires) < Date.now() ||
      !/^\w{64}$/.test(signature)
    )
      throw new AppError("Document link expired; refresh the workspace", 401);
    const expected = createHmac("sha256", this.signingKey)
      .update(`${owner}\n${url.pathname}\n${expires}`)
      .digest("hex");
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
      throw new AppError("Invalid access link", 403);
    return owner;
  }
}
export async function createAuth(db: Store, config: Config) {
  await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  const path = join(config.dataDir, "session-signing-key");
  let key: string;
  try {
    key = await readFile(path, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    key = randomBytes(32).toString("base64");
    const temporary = `${path}.${randomBytes(16).toString("hex")}.tmp`;
    await writeFile(temporary, key, { mode: 0o600, flag: "wx" });
    try {
      // Publish only complete bytes, without replacing another process's key.
      await link(temporary, path);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      key = await readFile(path, "utf8");
    } finally {
      await unlink(temporary);
    }
  }
  return new Auth(db, config, key);
}
