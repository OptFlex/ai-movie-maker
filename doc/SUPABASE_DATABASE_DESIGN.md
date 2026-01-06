# Supabaseデータベース設計 - 絵コンテ作成アプリ

## 概要

このドキュメントは、絵コンテ作成アプリ（storyboard.html）をSupabaseで実装する際のデータベース設計を定義します。

**対象アプリ:** 動画制作のための絵コンテ作成ツール
**機能範囲:** 企画管理、シーン作成、セリフ管理、画像候補管理
**非対象:** 動画生成機能（別アプリで提供）

---

## テーブル設計

### 1. projects（企画）

動画制作の企画を管理するテーブル。複数のYouTubeチャンネルの動画企画を管理できます。

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '無題の企画',
  channel_name TEXT,   -- NEW: YouTubeチャンネル名（企画ごとに設定）
  thumbnail_url TEXT,  -- NEW: 企画のサムネイル画像URL
  goal TEXT,           -- GPS の G (Goal) - 目標
  plan TEXT,           -- GPS の P (Plan) - 計画
  status TEXT,         -- GPS の S (Status) - 進捗状況
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**カラム説明:**
- `id`: 企画の一意識別子
- `user_id`: 作成者のユーザーID（Supabase Auth）
- `title`: 企画タイトル（例: "YouTube動画企画 #1"）
- `channel_name`: この企画が所属するYouTubeチャンネル名（例: "Tech解説チャンネル"）
- `thumbnail_url`: 企画専用のサムネイル画像URL（Supabase Storageのパス）
- `goal`: 目標（GPSメモのG部分）
- `plan`: 計画（GPSメモのP部分）
- `status`: 進捗状況（GPSメモのS部分）
- `created_at`: 作成日時
- `updated_at`: 最終更新日時

**用途:**
- 複数のYouTubeチャンネルを運営する場合、企画ごとに異なるチャンネル名を設定可能
- 例：「Tech解説チャンネル」の動画企画A、「料理チャンネル」の動画企画B

---

### 2. scenes（シーン）

各企画に紐づくシーンを管理するテーブル

```sql
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ユニーク制約（同じプロジェクト内で同じ番号は存在しない）
  CONSTRAINT unique_scene_number UNIQUE (project_id, number)
);
```

**カラム説明:**
- `id`: シーンの一意識別子
- `project_id`: 所属する企画のID
- `number`: シーン番号（#1, #2, ...）
- `created_at`: 作成日時
- `updated_at`: 最終更新日時

**制約:**
- 同じプロジェクト内で同じ番号のシーンは存在できない

---

### 3. dialogues（セリフ）

各シーンに紐づくセリフを管理するテーブル

```sql
CREATE TABLE dialogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  order_index INTEGER NOT NULL,  -- セリフの順序
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**カラム説明:**
- `id`: セリフの一意識別子
- `scene_id`: 所属するシーンのID
- `speaker`: 話者（例: "ナレーター", "真子さん"）
- `text`: セリフ本文
- `order_index`: セリフの順序（0から始まる）
- `created_at`: 作成日時
- `updated_at`: 最終更新日時

---

### 4. images（画像）

各シーンに紐づく画像候補を管理するテーブル

```sql
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,              -- 画像生成時のプロンプト
  image_url TEXT,                     -- Supabase Storageのパス
  selected BOOLEAN DEFAULT false,     -- シーンで採用されているか
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 1シーンにつき採用画像は1つだけ
  CONSTRAINT one_selected_per_scene UNIQUE (scene_id, selected)
    WHERE (selected = true)
);
```

**カラム説明:**
- `id`: 画像の一意識別子
- `scene_id`: 所属するシーンのID
- `prompt`: 画像生成時に使用したプロンプト
- `image_url`: Supabase Storageに保存した画像のURL
- `selected`: このシーンで採用されている画像かどうか
- `created_at`: 作成日時

**制約:**
- 1シーンにつき`selected = true`の画像は1つだけ

---

## インデックス

パフォーマンス最適化のためのインデックス設定

```sql
-- 企画一覧表示用
CREATE INDEX idx_projects_user_id_created ON projects(user_id, created_at DESC);

-- シーン取得用（番号順）
CREATE INDEX idx_scenes_project_number ON scenes(project_id, number);

-- セリフ取得用（順序）
CREATE INDEX idx_dialogues_scene_order ON dialogues(scene_id, order_index);

-- 画像取得用
CREATE INDEX idx_images_scene_id ON images(scene_id);
CREATE INDEX idx_images_created ON images(scene_id, created_at DESC);
```

---

## Row Level Security (RLS)

セキュリティポリシー設定

### Projects テーブル

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own projects"
  ON projects
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**ポリシー内容:**
- ユーザーは自分が作成した企画のみ閲覧・作成・更新・削除可能

### Scenes テーブル

```sql
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD scenes in their projects"
  ON scenes
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
      AND projects.user_id = auth.uid()
    )
  );
```

**ポリシー内容:**
- ユーザーは自分の企画に紐づくシーンのみ操作可能

### Dialogues テーブル

```sql
ALTER TABLE dialogues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD dialogues in their scenes"
  ON dialogues
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = dialogues.scene_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenes
      JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = dialogues.scene_id
      AND projects.user_id = auth.uid()
    )
  );
```

**ポリシー内容:**
- ユーザーは自分の企画のシーンに紐づくセリフのみ操作可能

### Images テーブル

```sql
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD images in their scenes"
  ON images
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = images.scene_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenes
      JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = images.scene_id
      AND projects.user_id = auth.uid()
    )
  );
```

**ポリシー内容:**
- ユーザーは自分の企画のシーンに紐づく画像のみ操作可能

---

## Supabase Storage設定

### バケット: storyboard-images

画像ファイルの保存用バケット

```javascript
{
  name: 'storyboard-images',
  public: false,
  fileSizeLimit: 10485760, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
}
```

**設定内容:**
- バケット名: `storyboard-images`
- 公開設定: プライベート（認証必要）
- ファイルサイズ上限: 10MB
- 許可形式: JPEG, PNG, WebP

**RLS設定（Storage）:**
```sql
-- 自分の企画のシーンに紐づく画像のみアップロード可能
CREATE POLICY "Users can upload images for their scenes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'storyboard-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 自分の画像のみ削除可能
CREATE POLICY "Users can delete their own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'storyboard-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## データ構造イメージ

```
projects（動画企画）
  ├── id: uuid
  ├── title: "YouTube動画企画 #1"
  ├── channel_name: "Tech解説チャンネル"
  ├── thumbnail_url: "storage/thumbnails/xxx.jpg"
  ├── goal: "視聴者に製品の魅力を伝える"
  ├── plan: "3分の解説動画、5シーン構成"
  └── status: "構成案作成中"

  └── scenes（シーン）[1対多]
       ├── id: uuid
       ├── number: 1, 2, 3...
       │
       ├── dialogues（セリフ）[1対多]
       │    ├── id: uuid
       │    ├── speaker: "ナレーター"
       │    ├── text: "こんにちは..."
       │    └── order_index: 0, 1, 2...
       │
       └── images（画像候補）[1対多]
            ├── id: uuid
            ├── prompt: "AI technology concept..."
            ├── image_url: "storage/..."
            └── selected: true/false（1つだけtrue）
```

**UI配置:**
```
[GPS]
  ↓
[サムネイル専用エリア] ← projects.thumbnail_url
  ↓
[シーン#1] ← scenes[0]
  ↓
[シーン#2] ← scenes[1]
  ...
```

---

## フロントエンド実装例

### Supabaseクライアント初期化

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
)
```

### 企画管理

#### 企画一覧取得

```javascript
async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, channel_name, thumbnail_url, created_at, updated_at')
    .order('created_at', { ascending: false })

  return data
}
```

#### 企画作成

```javascript
async function createProject(title = '無題の企画') {
  const { data, error } = await supabase
    .from('projects')
    .insert({ title })
    .select()
    .single()

  return data
}
```

#### 企画削除

```javascript
async function deleteProject(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
}
```

#### GPSメモ更新

```javascript
async function updateGPS(projectId, { goal, plan, status }) {
  const { data, error } = await supabase
    .from('projects')
    .update({
      goal,
      plan,
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single()

  return data
}
```

### 絵コンテデータ取得

#### 企画の全データを取得（シーン・セリフ・画像含む）

```javascript
async function loadStoryboard(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      scenes (
        id,
        number,
        dialogues (
          id,
          speaker,
          text,
          order_index
        ),
        images (
          id,
          prompt,
          image_url,
          selected,
          created_at
        )
      )
    `)
    .eq('id', projectId)
    .order('number', { foreignTable: 'scenes', ascending: true })
    .order('order_index', { foreignTable: 'scenes.dialogues', ascending: true })
    .order('created_at', { foreignTable: 'scenes.images', ascending: false })
    .single()

  return data
}
```

### シーン操作

#### シーン追加

```javascript
async function addScene(projectId, number) {
  const { data, error } = await supabase
    .from('scenes')
    .insert({ project_id: projectId, number })
    .select()
    .single()

  return data
}
```

#### シーン削除

```javascript
async function deleteScene(sceneId) {
  const { error } = await supabase
    .from('scenes')
    .delete()
    .eq('id', sceneId)
}
```

#### シーンの並び替え（番号更新）

```javascript
async function reorderScenes(scenes) {
  const updates = scenes.map((scene, index) => ({
    id: scene.id,
    number: index + 1
  }))

  const { data, error } = await supabase
    .from('scenes')
    .upsert(updates)
    .select()

  return data
}
```

### セリフ操作

#### セリフ追加

```javascript
async function addDialogue(sceneId, speaker, text, orderIndex) {
  const { data, error } = await supabase
    .from('dialogues')
    .insert({
      scene_id: sceneId,
      speaker,
      text,
      order_index: orderIndex
    })
    .select()
    .single()

  return data
}
```

#### セリフ更新

```javascript
async function updateDialogue(dialogueId, field, value) {
  const { data, error } = await supabase
    .from('dialogues')
    .update({ [field]: value })
    .eq('id', dialogueId)
    .select()
    .single()

  return data
}
```

#### セリフ削除

```javascript
async function deleteDialogue(dialogueId) {
  const { error } = await supabase
    .from('dialogues')
    .delete()
    .eq('id', dialogueId)
}
```

### 画像操作

#### 画像生成後に保存

```javascript
async function saveGeneratedImage(sceneId, prompt, imageBlob) {
  // 1. ストレージにアップロード
  const fileName = `${sceneId}/${Date.now()}.jpg`
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('storyboard-images')
    .upload(fileName, imageBlob, {
      contentType: 'image/jpeg'
    })

  if (uploadError) throw uploadError

  // 2. 公開URLを取得
  const { data: urlData } = supabase
    .storage
    .from('storyboard-images')
    .getPublicUrl(fileName)

  // 3. DBに画像情報を保存
  const { data, error } = await supabase
    .from('images')
    .insert({
      scene_id: sceneId,
      prompt: prompt,
      image_url: urlData.publicUrl,
      selected: false
    })
    .select()
    .single()

  return data
}
```

#### 画像を採用

```javascript
async function selectImage(sceneId, imageId) {
  // 1. 同じシーンの全画像のselectedをfalseに
  await supabase
    .from('images')
    .update({ selected: false })
    .eq('scene_id', sceneId)

  // 2. 指定した画像をtrueに
  const { data, error } = await supabase
    .from('images')
    .update({ selected: true })
    .eq('id', imageId)
    .select()
    .single()

  return data
}
```

#### 画像削除

```javascript
async function deleteImage(imageId, imageUrl) {
  // 1. ストレージから削除
  const path = imageUrl.split('/storyboard-images/')[1]
  await supabase.storage.from('storyboard-images').remove([path])

  // 2. DBから削除
  const { error } = await supabase
    .from('images')
    .delete()
    .eq('id', imageId)
}
```

---

## アプリの使用フロー

1. **ログイン** - Supabase Auth（メール/Google/GitHub等）
2. **企画一覧** - 企画一覧画面で「新規企画」作成
3. **企画選択** - 企画を選択 → storyboard.html画面へ
4. **GPSメモ** - 目標・計画・進捗を記入
5. **シーン管理** - シーン追加・並び替え
6. **セリフ追加** - 各シーンにセリフを追加
7. **画像生成** - 画像生成 → 保存 → 採用
8. **エクスポート** - 完成したら絵コンテをエクスポート（JSON/PDF）

---

## コスト見積もり

### Supabase無料プラン

- データベース: 500MB
- ストレージ: 1GB
- 帯域幅: 2GB/月
- 月間アクティブユーザー: 無制限

**個人利用なら無料枠で十分です！**

### 画像ストレージ容量試算

- 1画像あたり: 約500KB（JPEG圧縮）
- 1GB = 約2,000枚
- 10企画 × 10シーン × 5画像候補 = 500枚 → 約250MB

**100企画程度まで無料枠で運用可能**

---

## セットアップ手順

1. Supabaseプロジェクト作成
2. SQL Editorで上記テーブル・インデックス・RLSを実行
3. Storage設定でバケット作成
4. Supabase URLとAnon Keyを取得
5. フロントエンドに組み込み
6. Renderにデプロイ

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
