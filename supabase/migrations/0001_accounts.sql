-- LingTai 用户账号（Supabase）建表脚本
--
-- 用途：创建灵台账号体系依赖的三张表、头像私有存储桶，以及「注册即建档案」的触发器。
-- 使用：在 Supabase 控制台的 SQL Editor 里粘贴运行，或用 `supabase db push` 执行。
--
-- 说明：
--   1. 灵台把所有 Supabase 读写都走服务端 service_role 密钥（绕过 RLS），
--      用户端不直接访问 Supabase，因此下面的表启用 RLS 后默认对用户端完全隐藏。
--   2. 邮箱直接来自 auth.users，不单独存表；昵称/简介/头像统一由 user_profiles 维护。

-- ============================================================================
-- 1. 用户资料表 user_profiles
--    头像、昵称、简介统一由这张表维护；邮箱来自 auth.users，不在这里存。
-- ============================================================================
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  bio text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- ============================================================================
-- 2. 操作行为日志表 lingtai_audit_logs
--    记录注册/登录/退出/远程下线等安全相关事件；旁路写入，失败不影响主流程。
-- ============================================================================
create table if not exists public.lingtai_audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.lingtai_audit_logs enable row level security;

create index if not exists lingtai_audit_logs_user_idx
  on public.lingtai_audit_logs (user_id, created_at desc);

-- ============================================================================
-- 3. 业务资源索引表 lingtai_resources
--    记录「某资源属于某用户」，用于快速定位归属；旁路写入。
-- ============================================================================
create table if not exists public.lingtai_resources (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  resource_type text not null,
  resource_id text not null,
  created_at timestamptz not null default now()
);

alter table public.lingtai_resources enable row level security;

create unique index if not exists lingtai_resources_owner_type_id_idx
  on public.lingtai_resources (user_id, resource_type, resource_id);

-- ============================================================================
-- 4. 头像私有存储桶 user-avatars
--    头像存于私有桶，前端无法直接读取；服务端用 service_role 签名后下发临时地址。
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('user-avatars', 'user-avatars', false)
on conflict (id) do nothing;

-- ============================================================================
-- 5. 「注册即建档案」触发器
--    Supabase Auth 新建用户后，自动在 user_profiles 里补一行，
--    并把注册时填写的昵称（user_metadata.display_name）写进 nickname。
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, nickname)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
