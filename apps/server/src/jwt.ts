/**
 * 零依赖的 JWT（HS256）实现。
 *
 * 灵悟把「登录会话」做成标准的签名令牌：签名的载荷里带有用户身份（sub）、
 * 会话标识（jti）和过期时间（exp），服务端用 HMAC-SHA256 校验签名，
 * 因此任何一处修改令牌内容都会导致校验失败。只依赖 node:crypto，不引入 SDK。
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** JWT 的 claims。exp 使用秒级 Unix 时间戳（RFC 7519 约定）。 */
export interface JwtClaims {
  /** 工作区 owner，即 Supabase 用户 uuid（访问密钥模式下为 local-user）。 */
  sub: string;
  email?: string;
  /** 会话标识，对应 system/sessions 里的一条记录。 */
  jti: string;
  /** 签发时间（秒）。 */
  iat: number;
  /** 过期时间（秒）。 */
  exp: number;
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function signature(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

/** 用 HS256 签发一个令牌，返回标准的 `header.payload.signature` 三段字符串。 */
export function signJwt(claims: JwtClaims, secret: string): string {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(claims);
  return `${header}.${body}.${signature(`${header}.${body}`, secret)}`;
}

/**
 * 校验令牌并返回载荷；签名不符、结构非法或已过期时返回 null。
 * 这里只做「签名 + 过期」两个无状态检查，会话是否被撤销由调用方查库确认。
 */
export function verifyJwt(token: string, secret: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, provided] = parts;
  const expected = signature(`${header}.${body}`, secret);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtClaims;
    if (typeof claims.sub !== "string" || typeof claims.jti !== "string") return null;
    if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
