-- ホワイトリストテーブルの作成
CREATE TABLE IF NOT EXISTS allowed_emails (
  email TEXT PRIMARY KEY,
  name TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- RLSを有効化（管理者のみ編集可能にする想定）
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能（自分のメールアドレスがホワイトリストにあるかチェックするため）
CREATE POLICY "Anyone can read allowed_emails"
  ON allowed_emails
  FOR SELECT
  USING (true);

-- 初期データの挿入（あなたのメールアドレスに変更してください）
-- INSERT INTO allowed_emails (email, name, notes) VALUES
--   ('your-email@example.com', 'あなたの名前', '管理者');

-- コメント追加
COMMENT ON TABLE allowed_emails IS 'アプリケーションへのアクセスを許可されたメールアドレスのホワイトリスト';
COMMENT ON COLUMN allowed_emails.email IS 'メールアドレス（主キー）';
COMMENT ON COLUMN allowed_emails.name IS 'ユーザー名（任意）';
COMMENT ON COLUMN allowed_emails.added_at IS 'ホワイトリストに追加された日時';
COMMENT ON COLUMN allowed_emails.notes IS 'メモ（任意）';
