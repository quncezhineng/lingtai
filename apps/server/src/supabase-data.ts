/**
 * Supabase 数据层客户端（操作行为日志 + 业务资源索引）。
 *
 * 这两类数据是「旁路写入」：主流程不依赖它们成功，失败只记录后台日志，
 * 不影响用户的正常操作。写入使用服务端角色密钥直接调 PostgREST，
 * 绕过 RLS（灵悟的用户不会直接访问 Supabase，所有访问都经过灵悟 API）。
 */
import type { Config } from "./config.ts";
import { backgroundFailure } from "./log.ts";

/** 一条操作行为日志。 */
export interface AuditEntry {
  user_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
}

/** 一条业务资源索引，用于快速定位某用户的业务数据归属。 */
export interface ResourceEntry {
  user_id: string;
  resource_type: string;
  resource_id: string;
}

export class SupabaseData {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  private endpoint(path: string) {
    return `${this.url.replace(/\/+$/, "")}${path}`;
  }

  private async insert(table: string, row: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await fetch(this.endpoint(`/rest/v1/${table}`), {
        method: "POST",
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(row),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** 写入一条操作行为日志；失败不影响主流程。 */
  async writeAuditLog(entry: AuditEntry): Promise<void> {
    const ok = await this.insert("lingwu_audit_logs", {
      user_id: entry.user_id,
      action: entry.action,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.user_agent ?? null,
    });
    if (!ok) backgroundFailure("supabase audit log", new Error(`action=${entry.action}`));
  }

  /** 登记一条业务资源索引；失败不影响主流程。 */
  async indexResource(entry: ResourceEntry): Promise<void> {
    const ok = await this.insert("lingwu_resources", {
      user_id: entry.user_id,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
    });
    if (!ok)
      backgroundFailure(
        "supabase resource index",
        new Error(`${entry.resource_type}:${entry.resource_id}`),
      );
  }
}

/** 仅在配置了 Supabase 项目时返回数据层客户端，否则返回 undefined。 */
export function createSupabaseData(config: Config): SupabaseData | undefined {
  const { supabaseUrl, supabaseServiceRoleKey } = config;
  if (!supabaseUrl || !supabaseServiceRoleKey) return undefined;
  return new SupabaseData(supabaseUrl, supabaseServiceRoleKey);
}
