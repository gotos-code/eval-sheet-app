# セットアップ手順

## 1. Supabaseプロジェクトを新規作成

1. https://supabase.com にログインし、「New project」
2. プロジェクト名は任意（例：`eval-sheet`）、リージョンは `Northeast Asia (Tokyo)` を推奨
3. 作成完了後、左メニュー「Project Settings」→「API」を開き、以下の2つをコピー
   - **Project URL**（例：`https://xxxxxxxxxxxx.supabase.co`）
   - **anon / public key**（"Publishable key" とも表示されます。**service_role key ではない方**）

## 2. config.js に反映

このリポジトリの `config.js` を開き、以下を実際の値に書き換えてください（このままClaudeに値を伝えてもらえれば、代わりに書き換えて反映することもできます）。

```js
window.SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'ここにanon/publishable keyを貼り付け';
```

## 3. テーブル作成（SQL Editorに貼り付けて実行）

Supabaseダッシュボード → 「SQL Editor」→ 「New query」に以下を貼り付けて実行してください。

```sql
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  last_name text,
  first_name text,
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

create policy "select own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "admin select all" on public.profiles
  for select using (public.is_admin(auth.uid()));

create policy "admin update all" on public.profiles
  for update using (public.is_admin(auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, last_name, first_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'first_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 4. （任意）メール確認を無効化

社内限定ツールで手軽に使いたい場合：Authentication → Providers → Email → 「Confirm email」をオフにすると、登録直後にログインできるようになります（オンのままだと確認メールのリンクをクリックするまでログインできません）。

## 5. 最初の管理者を承認する

1. サイトの `signup.html` から自分（例：goto.s@sora1.jp）のアカウントを作成
2. Supabase SQL Editorで以下を実行し、自分自身を承認済み・管理者にする

```sql
update public.profiles
set approved = true, is_admin = true
where email = 'goto.s@sora1.jp';
```

3. 以降は `admin.html` から他のメンバーを承認できます

## 6. GitHub Pagesの公開設定

リポジトリ設定 → Pages → Source を「Deploy from a branch」→ `main` / `/(root)` に設定してください（Claude側でAPI経由の設定も試みます）。
