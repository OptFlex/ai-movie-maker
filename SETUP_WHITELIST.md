# ホワイトリスト認証のセットアップ手順

このドキュメントでは、Supabaseにホワイトリストテーブルを作成し、許可されたメールアドレスのみがアプリにアクセスできるようにする手順を説明します。

## 前提条件

- Supabaseプロジェクトが作成済みであること
- Supabase CLIがインストールされているか、Supabaseダッシュボードにアクセスできること

---

## セットアップ手順

### オプション1: Supabase CLIを使用（推奨）

#### 1. マイグレーションを適用

ローカル環境でSupabaseを起動している場合：

```bash
# Supabaseローカル環境を起動
supabase start

# マイグレーションを適用
supabase db reset
```

リモート（本番）環境に適用する場合：

```bash
# Supabaseにログイン
supabase login

# プロジェクトをリンク
supabase link --project-ref <your-project-ref>

# マイグレーションをプッシュ
supabase db push
```

#### 2. ホワイトリストにメールアドレスを追加

SQL Editorまたはpsqlで以下を実行：

```sql
INSERT INTO allowed_emails (email, name, notes) VALUES
  ('your-email@example.com', 'あなたの名前', '管理者'),
  ('team-member@example.com', 'チームメンバー', 'メンバー');
```

**重要**: `your-email@example.com` を実際のGoogleアカウントのメールアドレスに変更してください。

---

### オプション2: Supabaseダッシュボードを使用

#### 1. Supabaseダッシュボードにアクセス

https://supabase.com/dashboard にアクセスし、プロジェクトを選択

#### 2. SQL Editorを開く

左サイドバーから「SQL Editor」を選択

#### 3. マイグレーションSQLを実行

以下のSQLをコピー＆ペーストして実行：

```sql
-- ホワイトリストテーブルの作成
CREATE TABLE IF NOT EXISTS allowed_emails (
  email TEXT PRIMARY KEY,
  name TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- RLSを有効化
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能
CREATE POLICY "Anyone can read allowed_emails"
  ON allowed_emails
  FOR SELECT
  USING (true);

-- コメント追加
COMMENT ON TABLE allowed_emails IS 'アプリケーションへのアクセスを許可されたメールアドレスのホワイトリスト';
COMMENT ON COLUMN allowed_emails.email IS 'メールアドレス（主キー）';
COMMENT ON COLUMN allowed_emails.name IS 'ユーザー名（任意）';
COMMENT ON COLUMN allowed_emails.added_at IS 'ホワイトリストに追加された日時';
COMMENT ON COLUMN allowed_emails.notes IS 'メモ（任意）';
```

#### 4. ホワイトリストにメールアドレスを追加

別のSQLクエリを実行：

```sql
INSERT INTO allowed_emails (email, name, notes) VALUES
  ('your-email@example.com', 'あなたの名前', '管理者');
```

**重要**: `your-email@example.com` を実際のGoogleアカウントのメールアドレスに変更してください。

---

## 動作確認

### 1. テーブル確認

```sql
SELECT * FROM allowed_emails;
```

追加したメールアドレスが表示されることを確認してください。

### 2. アプリにアクセス

1. ブラウザでアプリを開く（例: https://optflex.github.io/ai-movie-maker/）
2. 「Googleでログイン」をクリック
3. ホワイトリストに登録したGoogleアカウントでログイン
4. 正常にログインできることを確認

### 3. ホワイトリスト外のアカウントでテスト

1. ホワイトリストに**登録していない**別のGoogleアカウントでログイン
2. 「このアプリへのアクセス権限がありません」というメッセージが表示されることを確認
3. 自動的にログアウトされることを確認

---

## メールアドレスの管理

### メールアドレスを追加

```sql
INSERT INTO allowed_emails (email, name, notes) VALUES
  ('new-user@example.com', 'New User', 'チームメンバー');
```

### メールアドレスを削除

```sql
DELETE FROM allowed_emails WHERE email = 'user-to-remove@example.com';
```

### 全ユーザー一覧を表示

```sql
SELECT email, name, added_at, notes FROM allowed_emails ORDER BY added_at DESC;
```

---

## トラブルシューティング

### 問題: ホワイトリストに登録したのにログインできない

**原因**:
- メールアドレスが完全一致していない（大文字小文字、スペース等）
- テーブルが正しく作成されていない

**解決方法**:
1. Googleアカウントのメールアドレスを確認
2. データベースに登録されているメールアドレスを確認
   ```sql
   SELECT * FROM allowed_emails WHERE email = 'your-email@example.com';
   ```
3. 完全一致するように修正

### 問題: 「ホワイトリストチェックエラー」が表示される

**原因**:
- テーブルが作成されていない
- RLSポリシーが正しく設定されていない

**解決方法**:
1. テーブルの存在確認
   ```sql
   SELECT * FROM allowed_emails LIMIT 1;
   ```
2. エラーが出る場合は、マイグレーションを再実行

### 問題: ブラウザのコンソールに「allowed_emails」が見つからないエラー

**原因**: テーブルが作成されていない

**解決方法**: 上記の「セットアップ手順」を最初から実行

---

## セキュリティに関する注意

1. **ホワイトリストテーブルは読み取り専用**
   - 現在のRLSポリシーでは、誰でも読み取り可能ですが、書き込みはできません
   - メールアドレスの追加/削除は、管理者がSupabaseダッシュボード経由で行う必要があります

2. **Google OAuth設定**
   - Google Cloud Consoleで「OAuth同意画面」が「本番」モードになっている場合、誰でもログイン画面は表示されます
   - しかし、ホワイトリストに登録されていないユーザーは、ログイン後すぐにログアウトされます

3. **管理者用インターフェース**
   - 現在、ホワイトリストの管理はSQL経由のみです
   - 将来的に、管理画面を追加することをお勧めします

---

## まとめ

これでホワイトリスト認証が有効になりました。

✅ ホワイトリストに登録されたメールアドレスのみアクセス可能
✅ 未登録ユーザーは自動的にログアウト
✅ Supabase RLSで保護されたデータベース

以上でセットアップは完了です。
