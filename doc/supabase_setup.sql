-- ================================================
-- 絵コンテアプリ - Supabase テーブル作成SQL
-- 作成日: 2026-01-13
-- ================================================

-- ================================================
-- 1. Projects テーブル（プロジェクト管理）
-- ================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  channel_name TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projectsテーブルのインデックス
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- ================================================
-- 2. Scenes テーブル（シーン管理）
-- ================================================
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  cut_number TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同一プロジェクト内でシーン番号は一意
  UNIQUE(project_id, scene_number)
);

-- Scenesテーブルのインデックス
CREATE INDEX idx_scenes_project_id ON scenes(project_id);
CREATE INDEX idx_scenes_scene_number ON scenes(project_id, scene_number);

-- ================================================
-- 3. Dialogues テーブル（セリフ管理）
-- ================================================
CREATE TABLE dialogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  order_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同一シーン内でorder_numberは一意
  UNIQUE(scene_id, order_number)
);

-- Dialoguesテーブルのインデックス
CREATE INDEX idx_dialogues_scene_id ON dialogues(scene_id);
CREATE INDEX idx_dialogues_order ON dialogues(scene_id, order_number);

-- ================================================
-- 4. Images テーブル（生成画像管理）
-- ================================================
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  reference_images JSONB DEFAULT '[]'::jsonb,
  parent_image_id UUID REFERENCES images(id) ON DELETE SET NULL,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Imagesテーブルのインデックス
CREATE INDEX idx_images_scene_id ON images(scene_id);
CREATE INDEX idx_images_created_at ON images(created_at DESC);
CREATE INDEX idx_images_is_selected ON images(scene_id, is_selected);
CREATE INDEX idx_images_parent_id ON images(parent_image_id);

-- ================================================
-- 5. Videos テーブル（生成動画管理）
-- ================================================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  base_image_id UUID REFERENCES images(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  video_url TEXT NOT NULL,
  duration INTEGER,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Videosテーブルのインデックス
CREATE INDEX idx_videos_scene_id ON videos(scene_id);
CREATE INDEX idx_videos_base_image_id ON videos(base_image_id);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_is_selected ON videos(scene_id, is_selected);

-- ================================================
-- 6. updated_at 自動更新トリガー
-- ================================================

-- トリガー関数の作成
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Projectsテーブルにトリガーを設定
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Scenesテーブルにトリガーを設定
CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 7. Row Level Security (RLS) 設定
-- ================================================

-- RLSを有効化
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- ================================================
-- Projects テーブルのRLSポリシー
-- ================================================

-- 認証済みユーザーは全プロジェクトを閲覧可能
CREATE POLICY "Authenticated users can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

-- 認証済みユーザーは新規プロジェクトを作成可能
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 認証済みユーザーは全プロジェクトを更新可能
CREATE POLICY "Authenticated users can update all projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (true);

-- 認証済みユーザーは全プロジェクトを削除可能
CREATE POLICY "Authenticated users can delete all projects"
  ON projects FOR DELETE
  TO authenticated
  USING (true);

-- ================================================
-- Scenes テーブルのRLSポリシー
-- ================================================

-- 認証済みユーザーは全シーンを閲覧可能
CREATE POLICY "Authenticated users can view all scenes"
  ON scenes FOR SELECT
  TO authenticated
  USING (true);

-- 認証済みユーザーは新規シーンを作成可能
CREATE POLICY "Authenticated users can create scenes"
  ON scenes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 認証済みユーザーは全シーンを更新可能
CREATE POLICY "Authenticated users can update all scenes"
  ON scenes FOR UPDATE
  TO authenticated
  USING (true);

-- 認証済みユーザーは全シーンを削除可能
CREATE POLICY "Authenticated users can delete all scenes"
  ON scenes FOR DELETE
  TO authenticated
  USING (true);

-- ================================================
-- Dialogues テーブルのRLSポリシー
-- ================================================

-- 認証済みユーザーは全セリフを閲覧可能
CREATE POLICY "Authenticated users can view all dialogues"
  ON dialogues FOR SELECT
  TO authenticated
  USING (true);

-- 認証済みユーザーは新規セリフを作成可能
CREATE POLICY "Authenticated users can create dialogues"
  ON dialogues FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 認証済みユーザーは全セリフを更新可能
CREATE POLICY "Authenticated users can update all dialogues"
  ON dialogues FOR UPDATE
  TO authenticated
  USING (true);

-- 認証済みユーザーは全セリフを削除可能
CREATE POLICY "Authenticated users can delete all dialogues"
  ON dialogues FOR DELETE
  TO authenticated
  USING (true);

-- ================================================
-- Images テーブルのRLSポリシー
-- ================================================

-- 認証済みユーザーは全画像を閲覧可能
CREATE POLICY "Authenticated users can view all images"
  ON images FOR SELECT
  TO authenticated
  USING (true);

-- 認証済みユーザーは新規画像を作成可能
CREATE POLICY "Authenticated users can create images"
  ON images FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 認証済みユーザーは全画像を更新可能
CREATE POLICY "Authenticated users can update all images"
  ON images FOR UPDATE
  TO authenticated
  USING (true);

-- 認証済みユーザーは全画像を削除可能
CREATE POLICY "Authenticated users can delete all images"
  ON images FOR DELETE
  TO authenticated
  USING (true);

-- ================================================
-- Videos テーブルのRLSポリシー
-- ================================================

-- 認証済みユーザーは全動画を閲覧可能
CREATE POLICY "Authenticated users can view all videos"
  ON videos FOR SELECT
  TO authenticated
  USING (true);

-- 認証済みユーザーは新規動画を作成可能
CREATE POLICY "Authenticated users can create videos"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 認証済みユーザーは全動画を更新可能
CREATE POLICY "Authenticated users can update all videos"
  ON videos FOR UPDATE
  TO authenticated
  USING (true);

-- 認証済みユーザーは全動画を削除可能
CREATE POLICY "Authenticated users can delete all videos"
  ON videos FOR DELETE
  TO authenticated
  USING (true);

-- ================================================
-- 完了メッセージ
-- ================================================
-- テーブル作成が完了しました
-- 次のステップ: Storageバケットの作成
-- 1. images バケット（生成画像）
-- 2. references バケット（参照画像）
-- 3. videos バケット（生成動画）
-- 4. thumbnails バケット（サムネイル画像）
