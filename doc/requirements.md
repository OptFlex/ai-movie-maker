# AI動画生成アプリ 要件定義書

## プロジェクト概要

YouTubeチャンネル運営を効率化するための、AI動画生成支援Webアプリケーション。
複数チャンネルの管理、企画ごとの動画制作、AIによる画像・動画・音声生成、DaVinci Resolve連携による最終編集までを一貫してサポート。

## 制作ワークフロー

### 原稿優先型フロー

1. チャンネル選択 → 企画作成
2. GPS設定（ゴール・戦略・現在地）
3. 構成作成（見出しリスト）
4. 各見出しごとに:
   - a. ナレーション原稿作成
   - b. Fish Audioで音声生成
   - c. 映像プロンプト作成
   - d. nanobanana Proで画像生成（複数候補）
   - e. 選択した画像をVeo3で動画化（音声の長さに合わせる）
5. タイムライン編集（BGM・効果音配置）
6. DaVinci Resolveに送信

## フォルダ構造

```
チャンネルA/
  ├─ 企画1/
  ├─ 企画2/
チャンネルB/
  ├─ 企画1/
  └─ 企画2/
```

## UI構成（6カラムレイアウト）

横スクロール可能な6カラム構成：

```
[1: GPS] → [2: 構成] → [3: 原稿] → [4: 音声] → [5: 映像] → [6: タイムライン]
```

### 1. GPS カラム
- ゴール入力欄
- 戦略入力欄
- 現在地入力欄
- 自動保存機能

### 2. 構成リスト カラム
- 見出し一覧表示
- ドラッグ&ドロップで並び替え
- 見出し追加ボタン
- クリックで3カラム目に反映

### 3. 原稿編集 カラム
- 見出しタイトル編集
- ナレーション原稿テキストエリア
- Fish Audio音声生成ボタン
- 映像プロンプト入力欄

### 4. 音声生成 カラム（Fish Audio）
- 音声プレビュー再生
- Fish Audio設定
  - 声のスタイル選択
  - 速度調整
  - 感情設定
- 再生成・確定ボタン

### 5. 映像生成 カラム
- nanobanana Pro画像生成（複数候補表示）
- グリッド表示で選択
- 選択後にVeo3動画化設定
  - 長さ（音声に自動合わせ）
  - プロンプト追加編集
- 動画生成開始ボタン

### 6. タイムライン カラム
- マスタータイムライン表示
  - 映像トラック
  - 音声トラック
  - BGMトラック
  - 効果音トラック
- BGM・効果音追加ボタン
- ドラッグ&ドロップで配置
- DaVinci Resolve送信ボタン

## データベーススキーマ（Supabase）

### channels（チャンネル）
- id (uuid, primary key)
- name (text)
- created_at (timestamp)

### projects（企画）
- id (uuid, primary key)
- channel_id (uuid, foreign key)
- title (text)
- created_at (timestamp)
- updated_at (timestamp)

### gps
- id (uuid, primary key)
- project_id (uuid, foreign key, unique)
- goal (text)
- strategy (text)
- current_position (text)

### sections（セクション/見出し）
- id (uuid, primary key)
- project_id (uuid, foreign key)
- order (int)
- title (text)
- narration_script (text) -- ナレーション原稿
- video_prompt (text) -- 映像プロンプト
- created_at (timestamp)

### narrations（音声）
- id (uuid, primary key)
- section_id (uuid, foreign key, unique)
- audio_url (text)
- duration (float) -- 秒数
- fish_audio_settings (jsonb) -- 声のスタイル等
- created_at (timestamp)

### generated_images（生成画像）
- id (uuid, primary key)
- section_id (uuid, foreign key)
- image_url (text)
- prompt (text)
- is_selected (boolean)
- created_at (timestamp)

### generated_videos（生成動画）
- id (uuid, primary key)
- section_id (uuid, foreign key, unique)
- video_url (text)
- duration (float)
- veo3_prompt (text)
- created_at (timestamp)

### timeline_audio（タイムライン音声要素）
- id (uuid, primary key)
- project_id (uuid, foreign key)
- type (enum: 'bgm', 'sfx')
- audio_url (text)
- start_time (float) -- 秒
- duration (float)
- volume (float) -- 0.0 ~ 1.0
- created_at (timestamp)

## 技術スタック

### フロントエンド
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Zustand（状態管理）

### バックエンド
- Supabase（DB + Auth + Storage）
- Next.js API Routes
- DaVinci Resolve Python API

### AI API連携
- Fish Audio API（ナレーション生成）
- nanobanana Pro API（画像生成）
- Veo3 API（動画生成）

### DaVinci Resolve連携
- DaVinci Resolve Studio API (Python)
- ローカルサーバー経由でWebSocket通信
- タイムライン自動生成

## AI連携詳細

### Fish Audio
- ナレーション原稿からリアルタイム音声生成
- 音声の長さを取得して動画生成時の基準にする
- 複数の声スタイルを選択可能なUI

### nanobanana Pro
- 複数の画像候補を生成
- グリッド表示で選択UI
- プロンプト編集機能

### Veo3
- 選択した画像から動画生成
- 音声の長さに自動で合わせる
- プロンプト追加編集可能

## DaVinci Resolve連携

### 構成
```
Webアプリ → WebSocket → ローカルPythonサーバー → DaVinci Resolve API
```

### 処理フロー
1. Webアプリで「DaVinciに送信」クリック
2. ローカルサーバーがDaVinci Resolve APIを呼び出し
3. 新規プロジェクト作成または既存を開く
4. タイムラインに動画クリップを順番に配置
5. オーディオトラックにナレーション音声を配置
6. BGM・効果音トラックに配置
7. 完了通知

### Python APIイメージ
```python
import DaVinciResolveScript as dvr_script

def create_timeline(project_data):
    resolve = dvr_script.scriptapp("Resolve")
    project = resolve.GetProjectManager().CreateProject("AI動画_" + project_data['title'])

    timeline = project.GetMediaPool().CreateEmptyTimeline("メインタイムライン")

    # 動画クリップを追加
    for section in project_data['sections']:
        add_video_clip(timeline, section['video_url'], section['start_time'])
        add_audio_clip(timeline, section['narration_url'], section['start_time'])

    # BGM・効果音を追加
    for audio in project_data['timeline_audio']:
        add_audio_to_track(timeline, audio['url'], audio['start_time'], audio['volume'])
```

## タイムライン機能

### 基本機能
- ドラッグ&ドロップで音声配置
- 波形表示
- ズームイン/アウト
- 音量調整スライダー

### 追加検討機能
- フェードイン/アウト
- 音量自動調整（ダッキング）
- マーカー配置
- プレビュー再生

## 開発フェーズ

### Phase 1: 基本構造
- Supabaseセットアップ
- 認証機能
- チャンネル/企画/GPS管理
- 基本UI（6カラムレイアウト）

### Phase 2: コンテンツ作成
- 見出し作成・編集
- ドラッグ&ドロップ並び替え
- 原稿入力UI

### Phase 3: AI生成
- Fish Audio連携
- nanobanana Pro連携
- Veo3連携
- 進行状況表示

### Phase 4: タイムライン編集
- タイムライン表示
- BGM・効果音配置
- プレビュー機能

### Phase 5: DaVinci連携
- ローカルサーバー構築
- DaVinci Resolve API実装
- WebSocket通信
- タイムライン自動生成

## 備考

- BGM・効果音の音源は後で検討（ファイルアップロード、AI生成、外部サービス連携等）
- UI/UXは実装しながら改善していく
- パフォーマンス最適化は後のフェーズで対応
