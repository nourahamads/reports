-- التحكم والرصد في الفضاء الرقمي — مخطط قاعدة البيانات (Supabase)
-- الصقه في: Supabase > SQL Editor > New query > Run

create table if not exists public.sites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  url         text not null unique,
  cat         text not null default '',
  file        text not null default '',
  meta        jsonb not null default '{}',   -- المحتوى والرابط الفرعي والدليل والملاحظات
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  site_id     text,
  site        text not null,
  url         text not null,
  types       text[] not null default '{}',
  result      text not null check (result in ('مخالف', 'غير مخالف')),
  source      text,
  inspector   text not null default '',
  screenshot  text,          -- مسار لقطة الفحص الآلي
  image       text,          -- الصورة الملصقة (data URL)
  extra       jsonb not null default '{}',   -- تفاصيل البلاغ (محتوى/دليل/ملاحظات)
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

-- للقواعد المنشأة سابقاً:
alter table public.sites   add column if not exists meta  jsonb not null default '{}';
alter table public.reports add column if not exists extra jsonb not null default '{}';

create index if not exists sites_created_idx   on public.sites   (created_at desc);
create index if not exists reports_created_idx on public.reports (created_at desc);

-- الأمان: لا وصول إلا للمستخدمين المسجّلين (anon لا يرى شيئاً)
alter table public.sites   enable row level security;
alter table public.reports enable row level security;

drop policy if exists "sites select"   on public.sites;
drop policy if exists "sites insert"   on public.sites;
drop policy if exists "sites delete"   on public.sites;
drop policy if exists "reports select" on public.reports;
drop policy if exists "reports insert" on public.reports;

create policy "sites select"   on public.sites   for select to authenticated using (true);
create policy "sites insert"   on public.sites   for insert to authenticated with check (true);
create policy "sites delete"   on public.sites   for delete to authenticated using (true);
-- التقارير: قراءة وإضافة فقط (لا تعديل ولا حذف حفاظاً على السجل)
create policy "reports select" on public.reports for select to authenticated using (true);
create policy "reports insert" on public.reports for insert to authenticated with check (true);
