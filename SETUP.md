# セットアップ手順

このアプリはSO CRMと**同じSupabaseプロジェクト**（`gotos-code's Project`／`qoaovyinizzwhfahcowz.supabase.co`）を使い回しています。ただし、承認（使える／使えない）は完全に別テーブル `eval_profiles` で管理しており、SO CRMの`profiles`テーブルとは独立しています。SO CRMで承認済みでも、このアプリでは別途承認が必要です。

`config.js` には既にこのプロジェクトのURL・anon keyが反映済みです。

## 1. テーブル・関数を作成（SQL Editorに貼り付けて実行）

SupabaseのSQL Editorで **「gotos-code's Project」を選択した状態**で、以下を実行してください（`calendar-app`側では実行しないでください）。

```sql
create table public.eval_profiles (
  id uuid references auth.users(id) primary key,
  email text,
  last_name text,
  first_name text,
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.eval_profiles enable row level security;

-- 承認/管理者フラグの判定用（SECURITY DEFINERでRLSの再帰を回避）
create or replace function public.is_eval_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.eval_profiles where id = uid), false);
$$;

-- 行の可視範囲：自分の行 / 管理者は全員分
create policy "eval: select own profile" on public.eval_profiles
  for select using (auth.uid() = id);

create policy "eval: insert own profile" on public.eval_profiles
  for insert with check (auth.uid() = id);

create policy "eval: update own profile" on public.eval_profiles
  for update using (auth.uid() = id);

create policy "eval: admin select all" on public.eval_profiles
  for select using (public.is_eval_admin(auth.uid()));

-- 列単位の権限：一般ユーザーは自分の氏名だけ更新可能。
-- approved / is_admin は直接更新できないようにし、権限昇格を防ぐ。
revoke all on public.eval_profiles from authenticated, anon;
grant select on public.eval_profiles to authenticated;
grant insert (id, email, last_name, first_name) on public.eval_profiles to authenticated;
grant update (last_name, first_name) on public.eval_profiles to authenticated;

-- 承認・管理者フラグの変更は、管理者だけが呼べるこの関数経由に限定
create or replace function public.eval_set_approved(target_id uuid, new_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_eval_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  update public.eval_profiles set approved = new_value where id = target_id;
end;
$$;

create or replace function public.eval_set_admin(target_id uuid, new_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_eval_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  if target_id = auth.uid() then
    raise exception 'cannot change your own admin status';
  end if;
  update public.eval_profiles set is_admin = new_value where id = target_id;
end;
$$;
```

## 2. （任意）メール確認を無効化

Authentication → Providers → Email → 「Confirm email」をオフにすると、登録直後にログインできます（既にSO CRM用にオフにしてある場合はそのままでOK）。

## 3. 最初の管理者を承認する

1. サイトの `signup.html` から新規登録（SO CRMのアカウントを既に持っている場合は、`signup.html`ではなく`login.html`からそのままログインしてください。初回ログイン時に`eval_profiles`の行が自動作成されます）
2. Supabase SQL Editorで以下を実行し、自分自身を承認済み・管理者にする

```sql
update public.eval_profiles
set approved = true, is_admin = true
where email = 'goto.s@sora1.jp';
```

3. 以降は `admin.html` から他のメンバーを承認できます（承認・管理者権限の切り替えはすべて上記のDB関数経由で行われるため、一般ユーザーが自分で承認済みにすることはできません）

## 4. 複数人分のデータ保存用テーブル（eval_sheets）を追加

一括インポート・サマリーページ機能のために、人ごとの評価データを保存するテーブルを追加します。**「gotos-code's Project」を選択した状態**でSQL Editorに貼り付けて実行してください。

```sql
create table public.eval_sheets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data jsonb not null,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.eval_sheets enable row level security;

-- 承認済みユーザーなら誰でも閲覧・作成・更新できる（削除は管理者のみ）
create policy "eval sheets: approved select" on public.eval_sheets
  for select using (
    exists (select 1 from public.eval_profiles p where p.id = auth.uid() and p.approved)
  );

create policy "eval sheets: approved insert" on public.eval_sheets
  for insert with check (
    exists (select 1 from public.eval_profiles p where p.id = auth.uid() and p.approved)
  );

create policy "eval sheets: approved update" on public.eval_sheets
  for update using (
    exists (select 1 from public.eval_profiles p where p.id = auth.uid() and p.approved)
  );

create policy "eval sheets: admin delete" on public.eval_sheets
  for delete using (public.is_eval_admin(auth.uid()));

revoke all on public.eval_sheets from anon;
grant select, insert, update, delete on public.eval_sheets to authenticated;

create or replace function public.eval_sheets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger eval_sheets_touch_updated_at
before update on public.eval_sheets
for each row execute procedure public.eval_sheets_set_updated_at();
```

## 5. GitHub Pagesの公開設定

`main` ブランチのルートから配信するよう設定済みです。公開URL：https://gotos-code.github.io/eval-sheet-app/
