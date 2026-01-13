# Supabase セットアップガイド

絵コンテアプリのSupabaseプロジェクト作成とデータベース設定の手順です。

## 📋 目次

1. [Supabaseプロジェクト作成](#1-supabaseプロジェクト作成)
2. [テーブル作成](#2-テーブル作成)
3. [Storageバケット作成](#3-storageバケット作成)
4. [認証設定](#4-認証設定)
5. [環境変数の取得](#5-環境変数の取得)

---

## 1. Supabaseプロジェクト作成

### 1-1. Supabaseアカウント作成
1. https://supabase.com/ にアクセス
2. 「Start your project」をクリック
3. GitHubアカウントでサインアップ（推奨）

### 1-2. 新規プロジェクト作成
1. ダッシュボードで「New Project」をクリック
2. 以下の情報を入力：
   - **Name**: `ai-movie-maker`（または任意の名前）
   - **Database Password**: 強力なパスワードを生成（保存しておく）
   - **Region**: `Northeast Asia (Tokyo)` を選択（日本から最速）
   - **Pricing Plan**: `Free` でOK（開発・テスト用）

3. 「Create new project」をクリック
4. プロジェクトの準備が完了するまで約2分待つ

---

## 2. テーブル作成

### 2-1. SQL Editorを開く
1. 左サイドバーの「SQL Editor」をクリック
2. 「New query」をクリック

### 2-2. SQLを実行
1. `/doc/supabase_setup.sql` ファイルの内容を全てコピー
2. SQL Editorに貼り付け
3. 右下の「Run」ボタンをクリック（または Cmd+Enter / Ctrl+Enter）

### 2-3. テーブル作成の確認
1. 左サイドバーの「Table Editor」をクリック
2. 以下のテーブルが作成されていることを確認：
   - ✅ `projects`
   - ✅ `scenes`
   - ✅ `images`
   - ✅ `videos`

3. 各テーブルをクリックして、カラム構成を確認

---

## 3. Storageバケット作成

### 3-1. Storageページを開く
1. 左サイドバーの「Storage」をクリック
2. 「Create a new bucket」をクリック

### 3-2. バケットを作成（4つ）

#### ① images バケット（生成画像）
- **Name**: `images`
- **Public bucket**: ✅ チェックを入れる（公開）
- **Allowed MIME types**: `image/*`
- 「Create bucket」をクリック

#### ② references バケット（参照画像）
- **Name**: `references`
- **Public bucket**: ✅ チェックを入れる
- **Allowed MIME types**: `image/*`
- 「Create bucket」をクリック

#### ③ videos バケット（生成動画）
- **Name**: `videos`
- **Public bucket**: ✅ チェックを入れる
- **Allowed MIME types**: `video/*`
- 「Create bucket」をクリック

#### ④ thumbnails バケット（サムネイル画像）
- **Name**: `thumbnails`
- **Public bucket**: ✅ チェックを入れる
- **Allowed MIME types**: `image/*`
- 「Create bucket」をクリック

### 3-3. Storage Policyの設定（各バケット共通）

各バケットで以下のポリシーを設定：

1. バケット名をクリック → 「Policies」タブを開く
2. 「New Policy」をクリック

**アップロードポリシー（INSERT）:**
```sql
-- ログインユーザーのみアップロード可能
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');  -- バケット名に応じて変更
```

**削除ポリシー（DELETE）:**
```sql
-- 自分がアップロードしたファイルのみ削除可能
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'images' AND auth.uid()::text = owner);  -- バケット名に応じて変更
```

> **注意**: `bucket_id` の値を各バケット名（`images`, `references`, `videos`, `thumbnails`）に合わせて変更してください。

---

## 4. 認証設定

### 4-1. Email認証を有効化
1. 左サイドバーの「Authentication」をクリック
2. 「Providers」タブを選択
3. 「Email」が有効になっていることを確認（デフォルトで有効）

### 4-2. 確認メール設定（本番環境用）
開発環境では不要ですが、本番環境では以下を設定：

1. 「Authentication」→「Settings」
2. 「Email Templates」で確認メールのカスタマイズ
3. 「Site URL」を本番URLに設定

### 4-3. テストユーザーの作成（任意）
1. 「Authentication」→「Users」
2. 「Add user」→「Create new user」
3. メールアドレスとパスワードを入力して作成

---

## 5. 環境変数の取得

### 5-1. API KeysとURLを取得
1. 左サイドバーの「Project Settings」（歯車アイコン）をクリック
2. 「API」タブを選択
3. 以下の値をコピー：

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5-2. 環境変数ファイルの作成

プロジェクトルートに `.env.local` ファイルを作成：

```bash
# Supabase設定
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **重要**: `.env.local` ファイルは `.gitignore` に追加して、Gitにコミットしないようにしてください。

### 5-3. .gitignore に追加

`.gitignore` ファイルに以下を追加：

```
# Environment variables
.env.local
.env
```

---

## ✅ セットアップ完了チェックリスト

- [ ] Supabaseプロジェクトを作成
- [ ] SQL Editorで `supabase_setup.sql` を実行
- [ ] 4つのテーブル（projects, scenes, images, videos）が作成されている
- [ ] 4つのStorageバケット（images, references, videos, thumbnails）が作成されている
- [ ] 各バケットにStorage Policyを設定
- [ ] Email認証が有効になっている
- [ ] `.env.local` ファイルに環境変数を設定
- [ ] `.gitignore` に `.env.local` を追加

---

## 🚀 次のステップ

セットアップが完了したら、次は `storyboard.html` にSupabase接続を実装します：

1. Supabase Client SDKの読み込み
2. 認証機能の実装（ログイン/ログアウト）
3. CRUD操作の実装（プロジェクト、シーン、画像、動画）
4. Storage アップロード機能の実装

---

## 🆘 トラブルシューティング

### テーブル作成でエラーが出る
- SQL Editorで全文をコピーできているか確認
- 既存のテーブルがある場合は削除してから再実行
- エラーメッセージを確認してテーブル名の重複などをチェック

### RLSポリシーでエラーが出る
- テーブルが正しく作成されているか確認
- `auth.uid()` が NULL の場合、ログインしていないため
- Supabase Dashboardの「SQL Editor」で直接クエリを確認

### Storageにアップロードできない
- バケットが Public になっているか確認
- Storage Policy が正しく設定されているか確認
- ファイルサイズ制限（Free プランは50MB）を確認

---

## 📚 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)
