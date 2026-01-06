# AI Movie Maker - アプリケーション設計書

## 概要

AI Movie Makerは、動画制作のための統合ツール群です。以下の3つのアプリケーションで構成されています：

1. **絵コンテ作成アプリ**（storyboard.html）- Supabase連携、データ永続化
2. **画像生成ツール**（api-test-image.html）- 単体ツール、ログイン必須
3. **動画生成ツール**（api-test-movie.html）- 単体ツール、ログイン必須

---

## アプリケーション構成

### 1. 全体構成図

```
┌─────────────────────────────────────────┐
│          https://ai-movie-maker.com      │
│              （Render デプロイ）          │
└─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
    ┌───▼───┐  ┌───▼────┐  ┌──▼────┐
    │絵コンテ│  │画像生成│  │動画生成│
    │作成   │  │ツール  │  │ツール  │
    └───┬───┘  └────────┘  └───────┘
        │
    ┌───▼────┐
    │Supabase│
    │Database│
    │Storage │
    └────────┘
```

### 2. ファイル構成

```
ai-movie-maker/
├── index.html                     # トップページ（ツール選択）
├── login.html                     # 認証ページ
├── projects.html                  # 企画一覧ページ（NEW）
├── storyboard.html                # 絵コンテ作成アプリ
├── api-test-image.html            # 画像生成ツール
├── api-test-movie.html            # 動画生成ツール
├── server.js                      # Node.jsサーバー（プロキシ + 静的配信）
├── package.json                   # 依存関係
├── .env                           # 環境変数
└── doc/                           # ドキュメント
    ├── APP_ARCHITECTURE_DESIGN.md
    ├── SUPABASE_DATABASE_DESIGN.md
    ├── VEO3_API_REFERENCE.md
    └── API_INTEGRATION_BEST_PRACTICES.md
```

---

## 認証システム（ホワイトリスト方式）

### 概要

- **認証プロバイダー**: Google OAuth（Supabase Authを使用）
- **実装方法**: Supabase JavaScript SDK（CDN経由）
- **アクセス制御**: メールアドレスホワイトリスト（allowed_emailsテーブル）
- **適用範囲**: 全アプリ（index.html含む）

**重要:** Google OAuthの認証フローは全てSupabaseが処理します。Google認証モジュールを直接使う必要はありません。

### データベース設計

#### allowed_emails テーブル

```sql
CREATE TABLE allowed_emails (
  email TEXT PRIMARY KEY,
  name TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ（管理者のメールアドレス）
INSERT INTO allowed_emails (email, name) VALUES
  ('your-email@gmail.com', 'あなたの名前');
```

### 認証フロー

```
1. ユーザーがアプリにアクセス
   ↓
2. セッションチェック（未ログイン？）
   YES → login.html へリダイレクト
   NO → 次へ
   ↓
3. allowed_emails テーブルでメールアドレスチェック
   ↓
4. ホワイトリストに存在する？
   YES → アプリ表示
   NO → サインアウト + login.html へリダイレクト
```

### 実装例

#### login.html（認証画面）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ログイン - AI Movie Maker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 class="text-2xl font-bold mb-6 text-center">AI Movie Maker</h1>
        <p class="text-gray-600 mb-6 text-center text-sm">
            許可されたユーザーのみアクセス可能です
        </p>

        <button id="google-login" class="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-3 transition">
            <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span class="font-medium">Googleでログイン</span>
        </button>

        <p class="text-xs text-gray-500 mt-6 text-center">
            ※ 許可されていないメールアドレスではログインできません
        </p>
    </div>

    <script type="module">
        const supabase = supabase.createClient(
            'YOUR_SUPABASE_URL',
            'YOUR_SUPABASE_ANON_KEY'
        )

        // ログインボタン
        document.getElementById('google-login').addEventListener('click', async () => {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            })

            if (error) {
                alert('ログインに失敗しました: ' + error.message)
            }
        })
    </script>
</body>
</html>
```

#### 各HTML共通の認証チェックコード

```javascript
// storyboard.html, api-test-image.html, api-test-movie.html, index.html の冒頭に追加

const supabase = supabase.createClient(
    'YOUR_SUPABASE_URL',
    'YOUR_SUPABASE_ANON_KEY'
)

// ページ読み込み時に認証チェック
window.addEventListener('DOMContentLoaded', async () => {
    // 1. セッションチェック
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        // ログインしていない → ログインページへ
        window.location.href = '/login.html'
        return
    }

    // 2. ホワイトリストチェック
    const userEmail = session.user.email
    const { data: allowed, error } = await supabase
        .from('allowed_emails')
        .select('email')
        .eq('email', userEmail)
        .single()

    if (error || !allowed) {
        // ホワイトリストにない → アクセス拒否
        alert('このアプリへのアクセス権限がありません')
        await supabase.auth.signOut()
        window.location.href = '/login.html'
        return
    }

    // 3. OK → アプリを表示
    document.getElementById('app').style.display = 'block'
})
```

---

## アプリケーション詳細

### 1. トップページ（index.html）

#### 役割
- 3つのツールへの入り口
- ユーザー情報表示
- ログアウト機能

#### UI構成

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Movie Maker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <!-- 認証チェック中は非表示 -->
    <div id="app" style="display: none;">
        <!-- ヘッダー -->
        <header class="bg-white border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                <h1 class="text-2xl font-bold text-gray-900">AI Movie Maker</h1>
                <div class="flex items-center gap-4">
                    <span id="user-email" class="text-sm text-gray-600"></span>
                    <button id="logout-btn" class="text-sm text-red-600 hover:text-red-700">
                        ログアウト
                    </button>
                </div>
            </div>
        </header>

        <!-- メインコンテンツ -->
        <main class="max-w-7xl mx-auto px-4 py-12">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <!-- 絵コンテ作成アプリ -->
                <a href="./projects.html" class="block bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition group">
                    <div class="text-5xl mb-4">📋</div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition">
                        絵コンテ作成
                    </h2>
                    <p class="text-gray-600 mb-4">
                        動画制作のための絵コンテを作成・管理できます
                    </p>
                    <ul class="text-sm text-gray-500 space-y-1">
                        <li>✓ 企画・シーン・セリフ管理</li>
                        <li>✓ 原稿インポート（YAML/AI解析）</li>
                        <li>✓ 画像生成・採用機能</li>
                        <li>✓ データ自動保存</li>
                    </ul>
                </a>

                <!-- 画像生成ツール -->
                <a href="/api-test-image.html" class="block bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition group">
                    <div class="text-5xl mb-4">🖼️</div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition">
                        画像生成
                    </h2>
                    <p class="text-gray-600 mb-4">
                        AI画像生成ツール（Google Imagen）
                    </p>
                    <ul class="text-sm text-gray-500 space-y-1">
                        <li>✓ プロンプトから画像生成</li>
                        <li>✓ 生成履歴表示</li>
                        <li>✓ 画像ダウンロード</li>
                        <li>✓ データ保存なし（単体利用）</li>
                    </ul>
                </a>

                <!-- 動画生成ツール -->
                <a href="/api-test-movie.html" class="block bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition group">
                    <div class="text-5xl mb-4">🎬</div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-3 group-hover:text-cyan-600 transition">
                        動画生成
                    </h2>
                    <p class="text-gray-600 mb-4">
                        AI動画生成ツール（Google Veo 3.1）
                    </p>
                    <ul class="text-sm text-gray-500 space-y-1">
                        <li>✓ 画像+プロンプトから動画生成</li>
                        <li>✓ モデル選択（Fast/Standard）</li>
                        <li>✓ 動画ダウンロード</li>
                        <li>✓ データ保存なし（単体利用）</li>
                    </ul>
                </a>
            </div>
        </main>
    </div>

    <script type="module">
        // 認証チェック + ユーザー情報表示 + ログアウト処理
        // （上記の共通認証チェックコード + 追加機能）

        const supabase = supabase.createClient(/* ... */)

        window.addEventListener('DOMContentLoaded', async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                window.location.href = '/login.html'
                return
            }

            // ホワイトリストチェック
            // ...

            // ユーザー情報表示
            document.getElementById('user-email').textContent = session.user.email

            // アプリ表示
            document.getElementById('app').style.display = 'block'
        })

        // ログアウト
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await supabase.auth.signOut()
            window.location.href = '/login.html'
        })
    </script>
</body>
</html>
```

---

### 2. 企画一覧ページ（projects.html）

#### 役割
- 絵コンテ企画の一覧表示
- 企画の作成・選択
- Supabaseと連携してデータ永続化

#### 主要機能

1. **企画一覧表示**
   - YouTube風カードレイアウト
   - サムネイル画像（グラデーション + 絵文字）
   - 企画タイトル
   - 最終更新日

2. **企画作成**
   - 新規企画作成ボタン
   - storyboard.htmlへ遷移（新規モード）

3. **企画選択**
   - カードクリックで該当企画を開く
   - URLパラメータでプロジェクトIDを渡す（`?project=1`）

#### データベース連携を前提としたモックアップ実装

**重要:** データとUIを分離し、後でSupabaseに簡単に置き換えられる設計

**モックデータ（Supabaseのprojectsテーブル構造と同じ）:**

```javascript
const mockProjects = [
    {
        id: 1,
        title: "YouTube動画企画 #1",
        channel_name: "Tech解説チャンネル",
        thumbnail_url: null,  // 後で画像URLが入る（Supabase Storage）
        thumbnail_emoji: "📋",  // モックアップ用（本番では不要）
        thumbnail_gradient: "from-blue-400 to-purple-500",  // モックアップ用（本番では不要）
        created_at: "2026-01-03T10:00:00",
        updated_at: "2026-01-03T15:30:00",
        user_id: "user123"
    },
    {
        id: 2,
        title: "製品紹介動画企画",
        channel_name: "ビジネスチャンネル",
        thumbnail_url: null,
        thumbnail_emoji: "🎬",
        thumbnail_gradient: "from-green-400 to-blue-500",
        created_at: "2026-01-02T09:00:00",
        updated_at: "2026-01-02T14:20:00",
        user_id: "user123"
    },
    {
        id: 3,
        title: "チュートリアル動画",
        channel_name: "Tech解説チャンネル",
        thumbnail_url: null,
        thumbnail_emoji: "📺",
        thumbnail_gradient: "from-orange-400 to-pink-500",
        created_at: "2026-01-01T11:00:00",
        updated_at: "2026-01-01T16:45:00",
        user_id: "user123"
    },
    {
        id: 4,
        title: "商品レビュー動画",
        channel_name: "レビューチャンネル",
        thumbnail_url: null,
        thumbnail_emoji: "🎥",
        thumbnail_gradient: "from-purple-400 to-indigo-500",
        created_at: "2025-12-31T13:00:00",
        updated_at: "2025-12-31T18:15:00",
        user_id: "user123"
    }
];
```

**NOTE:** `thumbnail_emoji`と`thumbnail_gradient`はモックアップ用の一時的なフィールドです。Supabase接続後は`thumbnail_url`のみを使用します。

**データ取得関数（後でSupabaseに置き換え）:**

```javascript
async function loadProjects() {
    // TODO: Supabase接続時は以下に置き換え
    // const { data, error } = await supabase
    //     .from('projects')
    //     .select('*')
    //     .order('updated_at', { ascending: false });
    // if (error) throw error;
    // return data;

    // 現在はモックデータを返す
    return mockProjects;
}
```

**動的レンダリング関数:**

```javascript
function renderProjects(projects) {
    const listDiv = document.getElementById('projects-list');

    const html = projects.map(project => `
        <div class="cursor-pointer group bg-white border-2 border-gray-200 rounded-xl p-3 shadow-md hover:shadow-xl hover:border-blue-400 transition-all"
             onclick="openProject(${project.id})">
            <div class="aspect-video bg-gradient-to-br ${project.thumbnail_gradient} rounded-lg mb-3 flex items-center justify-center text-white text-4xl">
                ${project.thumbnail_emoji}
            </div>
            <div>
                <h3 class="font-semibold text-gray-900 group-hover:text-blue-600 transition line-clamp-2 text-sm mb-2">
                    ${project.title}
                </h3>
                <p class="text-xs text-gray-500">${formatDate(project.updated_at)} 更新</p>
            </div>
        </div>
    `).join('');

    listDiv.innerHTML = html;
}
```

**企画選択時の処理:**

```javascript
function openProject(projectId) {
    window.location.href = `./storyboard.html?project=${projectId}`;
}
```

#### Supabase接続時の変更箇所

後でSupabaseに接続する際は、**loadProjects関数のみ変更すればOK:**

```javascript
async function loadProjects() {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
}
```

---

### 3. 絵コンテ作成アプリ（storyboard.html）

#### 役割
- 選択された企画の絵コンテ編集
- Supabaseと連携してデータ永続化
- 原稿インポート機能（YAML + AI解析）

#### URLパラメータ
- `?project=1` - 編集する企画のID
- パラメータなし - 新規企画作成モード

#### 主要機能

1. **プロジェクト情報管理**
   - プロジェクト名編集（GPSセクション上部）
   - URLパラメータからプロジェクトIDを取得
   - モックデータから該当プロジェクトを読み込み
   - GPSメモ（Goal/Plan/Status）編集

2. **シーン管理**
   - シーン追加・削除
   - ドラッグ&ドロップで並び替え
   - シーン番号自動更新

3. **セリフ管理**
   - セリフ追加・編集・削除
   - 話者とテキスト入力

4. **画像管理**
   - 画像生成（**Gemini 3 Pro Image Preview API** - api-test-image.htmlと同じ実装）
   - 生成履歴表示
   - 画像採用・削除
   - Supabase Storageに保存

5. **原稿インポート**（新機能）
   - **手動入力 → AI解析（Gemini 3 Pro） → YAML生成 → インポート**
   - **YAML直接インポート**

#### データベース連携を前提としたモックアップ実装

**URLパラメータからプロジェクトIDを取得:**

```javascript
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('project'); // "1" など
let currentProject = null;
```

**モックデータ（projects.htmlと同じ）:**

```javascript
const mockProjects = [
    {
        id: 1,
        title: "YouTube動画企画 #1",
        channel_name: "Tech解説チャンネル",
        thumbnail_url: null,
        created_at: "2026-01-03T10:00:00",
        updated_at: "2026-01-03T15:30:00",
        user_id: "user123"
    },
    {
        id: 2,
        title: "製品紹介動画企画",
        channel_name: "ビジネスチャンネル",
        thumbnail_url: null,
        created_at: "2026-01-02T09:00:00",
        updated_at: "2026-01-02T14:20:00",
        user_id: "user123"
    },
    // ...
];
```

**プロジェクトデータ取得（後でSupabaseに置き換え）:**

```javascript
async function loadProject(id) {
    // TODO: Supabase接続時は以下に置き換え
    // const { data, error } = await supabase
    //     .from('projects')
    //     .select('*')
    //     .eq('id', id)
    //     .single();
    // if (error) throw error;
    // return data;

    // 現在はモックデータから検索
    if (!id) {
        // 新規作成モード
        return {
            id: null,
            title: "新規企画",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }
    return mockProjects.find(p => p.id == id) || null;
}
```

**プロジェクト情報を画面に反映:**

```javascript
window.addEventListener('DOMContentLoaded', async function() {
    currentProject = await loadProject(projectId);
    if (currentProject) {
        document.getElementById('project-title').value = currentProject.title;
    }

    // シーンデータの読み込みなど...
});
```

**UI設計変更点:**

- ヘッダーをスリム化（`py-4` → `py-3`）
- プロジェクト名をヘッダーから削除
- プロジェクト名をGPSセクション上部に移動し、編集可能な`<input>`要素として実装
- フォントサイズ: `text-base font-bold`
- **サムネイル専用エリアを追加**（GPSセクションの下、シーン一覧の上）
  - 企画のサムネイル画像表示/アップロード
  - 企画タイトル表示
  - チャンネル名表示
  - シーンとは別軸で管理（`projects.thumbnail_url`）

#### Supabase接続時の変更箇所

後でSupabaseに接続する際は、**loadProject関数のみ変更すればOK:**

```javascript
async function loadProject(id) {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}
```

#### 原稿インポート機能詳細

##### YAMLフォーマット定義

```yaml
# 絵コンテ原稿フォーマット

title: YouTube動画企画 #1

gps:
  goal: 視聴者に製品の魅力を伝える
  plan: 3分の解説動画、5シーン構成
  status: 台本作成完了

scenes:
  - number: 1
    dialogues:
      - speaker: ナレーター
        text: こんにちは、今日はAI動画制作ツールを紹介します
      - speaker: ナレーター
        text: このツールを使えば誰でも簡単に動画が作れます

  - number: 2
    dialogues:
      - speaker: 真子さん
        text: 見た目だけを分けなかろうもんで
      - speaker: 太郎さん
        text: そうですね、中身も大事です

  - number: 3
    dialogues:
      - speaker: ナレーター
        text: 次のシーンでは具体的な使い方を見ていきましょう
```

##### AI解析機能

**使用API:**
- **API**: Google Gemini API
- **モデル**: `gemini-3-pro-preview`（推奨） / `gemini-2.0-flash-exp` / `gemini-1.5-pro-latest`
- **推奨**: `gemini-3-pro-preview`（Google史上最も強力なマルチモーダル理解モデル）

**フロー:**

```
1. ユーザーが自由形式の原稿を入力
   ↓
2. Gemini APIに投げて構造化
   ↓
3. YAML形式で返却
   ↓
4. ユーザーが確認・編集
   ↓
5. インポート実行
```

**プロンプト例:**

```javascript
const AI_CONVERSION_PROMPT = `
あなたは動画制作の絵コンテ作成アシスタントです。
以下の原稿を、絵コンテ用に構造化してYAML形式で出力してください。

# 原稿
${userScript}

# 出力形式
title: タイトル（原稿から抽出、なければ"無題の企画"）
gps:
  goal: 目標（原稿から抽出、なければ空文字）
  plan: 計画（原稿から抽出、なければ空文字）
  status: 進捗状況（原稿から抽出、なければ空文字）

scenes:
  - number: 1
    dialogues:
      - speaker: 話者名
        text: セリフ内容
      - speaker: 話者名
        text: セリフ内容
  - number: 2
    dialogues:
      - speaker: 話者名
        text: セリフ内容

# ルール
1. シーンは話題や場面が変わるタイミングで区切る
2. 話者が明記されていない場合は「ナレーター」とする
3. 1シーンは30秒〜1分程度を目安に（セリフ2〜5個程度）
4. シーン番号は1から連番
5. YAMLフォーマットを厳密に守る
6. コードブロック不要、YAMLのみを出力

# 出力例
title: サンプル動画企画
gps:
  goal: 商品の魅力を伝える
  plan: 3分動画、5シーン
  status: 構成案作成中

scenes:
  - number: 1
    dialogues:
      - speaker: ナレーター
        text: 商品紹介を始めます
`
```

**API呼び出し:**

```javascript
// Gemini APIで原稿をYAMLに変換
async function convertScriptWithAI(rawScript) {
    const apiKey = 'YOUR_GOOGLE_AI_API_KEY' // 画像・動画生成と同じAPIキー
    const modelName = 'gemini-3-pro-preview' // 推奨: Gemini 3 Pro
    // または: 'gemini-2.0-flash-exp', 'gemini-1.5-pro-latest'
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

    const prompt = AI_CONVERSION_PROMPT.replace('${userScript}', rawScript)

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    })

    const data = await response.json()
    const yamlText = data.candidates[0].content.parts[0].text

    return yamlText
}
```

**メリット:**
- **APIキー1つで全機能が動く**（画像・動画・原稿解析）
- **無料枠が大きい**（1日150万トークン）
- **既存実装と同じパターン**（api-test-image.htmlと同様）
- **コスト削減**（Claude APIより圧倒的に安い）

##### インポートモーダルUI

```html
<!-- 原稿インポートボタン（GPSメモ上部に配置） -->
<div class="mb-4">
    <button id="import-script-btn" class="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        原稿をインポート
    </button>
</div>

<!-- インポートモーダル -->
<div id="import-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <!-- ヘッダー -->
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-900">原稿をインポート</h2>
            <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>

        <!-- タブ切り替え -->
        <div class="flex border-b border-gray-200">
            <button class="tab-btn px-6 py-3 font-medium border-b-2 border-blue-600 text-blue-600" data-tab="ai">
                ✨ AI解析
            </button>
            <button class="tab-btn px-6 py-3 font-medium text-gray-600 hover:text-gray-900" data-tab="yaml">
                📄 YAML直接
            </button>
        </div>

        <!-- コンテンツエリア -->
        <div class="flex-1 overflow-y-auto p-6">
            <!-- AI解析タブ -->
            <div id="tab-ai" class="tab-content">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        原稿を入力してください（自由形式）
                    </label>
                    <textarea id="raw-script-input" rows="15" class="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="例:

タイトル: YouTube動画企画 #1
目標: 視聴者に製品の魅力を伝える

【シーン1】
ナレーター「こんにちは、今日はAI動画制作ツールを紹介します」
ナレーター「このツールを使えば誰でも簡単に動画が作れます」

【シーン2】
真子さん「見た目だけを分けなかろうもんで」
太郎さん「そうですね、中身も大事です」
"></textarea>
                </div>

                <button id="ai-convert-btn" class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    AIで構造化
                </button>

                <!-- AI変換結果プレビュー -->
                <div id="ai-result" class="hidden mt-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        変換結果（編集可能）
                    </label>
                    <textarea id="ai-yaml-output" rows="15" class="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>

                    <button id="import-ai-yaml-btn" class="mt-4 w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition font-medium">
                        インポート実行
                    </button>
                </div>
            </div>

            <!-- YAML直接タブ -->
            <div id="tab-yaml" class="tab-content hidden">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        YAML形式で入力してください
                    </label>
                    <textarea id="yaml-direct-input" rows="20" class="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="title: YouTube動画企画 #1

gps:
  goal: 視聴者に製品の魅力を伝える
  plan: 3分の解説動画、5シーン構成
  status: 台本作成完了

scenes:
  - number: 1
    dialogues:
      - speaker: ナレーター
        text: こんにちは、今日はAI動画制作ツールを紹介します
"></textarea>
                </div>

                <button id="import-yaml-btn" class="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition font-medium">
                    インポート実行
                </button>
            </div>
        </div>
    </div>
</div>
```

##### インポート処理

```javascript
// js-yaml ライブラリを使用（CDNで読み込み）
// <script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"></script>

// YAMLインポート処理
async function importFromYAML(yamlText) {
    try {
        // YAMLパース
        const data = jsyaml.load(yamlText)

        // バリデーション
        if (!data.scenes || !Array.isArray(data.scenes)) {
            throw new Error('scenes配列が見つかりません')
        }

        // 企画情報をSupabaseに保存
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .insert({
                title: data.title || '無題の企画',
                goal: data.gps?.goal || '',
                plan: data.gps?.plan || '',
                status: data.gps?.status || ''
            })
            .select()
            .single()

        if (projectError) throw projectError

        // シーンとセリフを保存
        for (const sceneData of data.scenes) {
            // シーン作成
            const { data: scene, error: sceneError } = await supabase
                .from('scenes')
                .insert({
                    project_id: project.id,
                    number: sceneData.number
                })
                .select()
                .single()

            if (sceneError) throw sceneError

            // セリフ作成
            if (sceneData.dialogues && Array.isArray(sceneData.dialogues)) {
                for (let i = 0; i < sceneData.dialogues.length; i++) {
                    const dialogue = sceneData.dialogues[i]

                    await supabase
                        .from('dialogues')
                        .insert({
                            scene_id: scene.id,
                            speaker: dialogue.speaker,
                            text: dialogue.text,
                            order_index: i
                        })
                }
            }
        }

        // 成功メッセージ
        alert('インポートが完了しました！')

        // モーダルを閉じて、作成した企画を表示
        closeImportModal()
        loadProject(project.id)

    } catch (error) {
        alert('インポートエラー: ' + error.message)
        console.error(error)
    }
}

// AI変換処理
async function convertWithAI() {
    const rawScript = document.getElementById('raw-script-input').value.trim()

    if (!rawScript) {
        alert('原稿を入力してください')
        return
    }

    // ローディング表示
    const btn = document.getElementById('ai-convert-btn')
    btn.disabled = true
    btn.innerHTML = '<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 変換中...'

    try {
        const yamlText = await convertScriptWithAI(rawScript)

        // 結果を表示
        document.getElementById('ai-yaml-output').value = yamlText
        document.getElementById('ai-result').classList.remove('hidden')

    } catch (error) {
        alert('AI変換エラー: ' + error.message)
        console.error(error)
    } finally {
        btn.disabled = false
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> AIで構造化'
    }
}

// イベントリスナー設定
document.getElementById('ai-convert-btn').addEventListener('click', convertWithAI)
document.getElementById('import-ai-yaml-btn').addEventListener('click', () => {
    const yamlText = document.getElementById('ai-yaml-output').value
    importFromYAML(yamlText)
})
document.getElementById('import-yaml-btn').addEventListener('click', () => {
    const yamlText = document.getElementById('yaml-direct-input').value
    importFromYAML(yamlText)
})
```

---

### 4. 画像生成ツール（api-test-image.html）

#### 役割
- AI画像生成（**Gemini 3 Pro Image Preview** - Nano Banana Pro）
- 単体ツールとして動作
- データ保存なし（セッション限り）

#### 使用API
- **API**: Google Gemini API
- **モデル**: `gemini-3-pro-image-preview` (Nano Banana Pro)
- **エンドポイント**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`
- **認証方法**: APIキー（クエリパラメータ `?key=YOUR_API_KEY`）
- **プロキシ**: 不要（ブラウザから直接リクエスト可能）
- **特徴**:
  - 高解像度出力（4K対応）
  - 高度なテキストレンダリング
  - 複数画像参照可能（最大14枚）
  - プロフェッショナル向けアセット作成に最適

#### 主要機能
- プロンプト入力
- 生成枚数選択（1/2/4/8枚）
- 画質選択（標準/HD/UHD）
- 画像生成（複数枚同時生成）
- 画像プレビュー表示
- 画像ダウンロード（個別）

#### 実装例

```javascript
// api-test-image.html の実装方法
async function generateImages() {
    const apiKey = document.getElementById('nanobanana-api-key').value
    const prompt = document.getElementById('nanobanana-prompt').value
    const count = parseInt(document.getElementById('nanobanana-count').value)

    const modelName = 'gemini-3-pro-image-preview' // Nano Banana Pro
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

    // 複数画像を生成するため、count回リクエスト
    const promises = []
    for (let i = 0; i < count; i++) {
        promises.push(
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        responseModalities: ["Text", "Image"]
                    }
                })
            })
        )
    }

    const responses = await Promise.all(promises)

    // 画像データを抽出（Base64）
    for (const response of responses) {
        const data = await response.json()
        const imageData = data.candidates[0].content.parts
            .find(p => p.inlineData).inlineData.data

        // 画像を表示・保存
        displayImage(imageData)
    }
}
```

#### Supabase連携
- **なし**（認証のみ使用）

---

### 5. 動画生成ツール（api-test-movie.html）

#### 役割
- AI動画生成（**Google Veo 3.1 API**）
- 単体ツールとして動作
- データ保存なし（セッション限り）

#### 使用API
- **API**: Google Veo 3.1 API
- **モデル**: `veo-3.1-fast-generate-preview` (推奨) / `veo-3.1-generate-preview`
- **エンドポイント**: `https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateVideo`
- **認証方法**: APIキー（ヘッダー `x-goog-api-key`）
- **プロキシ**: **必須**（server.js経由 - CORS回避のため）

#### 主要機能
- 画像アップロード
- プロンプト入力
- モデル選択（Veo 3.1 Fast / Standard）
- 動画の長さ（8秒固定）
- FPS選択（24fps / 30fps）
- 動画生成（非同期処理）
- 生成状況ポーリング（5秒間隔）
- 動画プレビュー表示
- 動画ダウンロード

#### 実装例

```javascript
// api-test-movie.html の実装方法（プロキシサーバー経由）
async function generateVideo() {
    const apiKey = document.getElementById('veo3-api-key').value
    const prompt = document.getElementById('veo3-prompt').value
    const imageBase64 = await fileToBase64(uploadedImageFile)
    const modelName = document.getElementById('veo3-model').value // 'veo-3.1-fast-generate-preview'

    // プロキシサーバー（server.js）にリクエスト
    const response = await fetch('http://localhost:3000/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey: apiKey,
            prompt: prompt,
            imageBase64: imageBase64,
            duration: 8,
            fps: 24,
            modelName: modelName
        })
    })

    const data = await response.json()

    if (data.operationName) {
        // 非同期処理の完了を待つ（ポーリング）
        await pollOperationStatus(data.operationName, apiKey)
    }
}

// ポーリング処理
async function pollOperationStatus(operationName, apiKey) {
    const response = await fetch('http://localhost:3000/check-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey: apiKey,
            operationName: operationName
        })
    })

    const data = await response.json()

    if (data.done) {
        const videoUri = data.response.generateVideoResponse.generatedSamples[0].video.uri
        downloadVideoFromUri(videoUri)
    } else {
        // 5秒後に再試行
        setTimeout(() => pollOperationStatus(operationName, apiKey), 5000)
    }
}
```

#### 料金情報
- **Veo 3.1 Fast**: $0.15/秒（8秒動画 = $1.20）- 推奨
- **Veo 3.1 Standard**: $0.40/秒（8秒動画 = $3.20）

#### Supabase連携
- **なし**（認証のみ使用）

---

## サーバー構成（server.js）

### 役割
1. **静的ファイル配信** - 全HTMLファイルを配信
2. **Veo 3 APIプロキシ** - CORS回避、APIキー隠蔽

### 実装

```javascript
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const VEO3_API_KEY = process.env.VEO3_API_KEY;

const server = http.createServer(async (req, res) => {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // === API エンドポイント ===

    // 動画生成
    if (req.url === '/generate-video' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            const requestData = JSON.parse(body);

            // Veo3 API呼び出し（既存実装）
            // ...
        });
    }

    // 操作確認
    else if (req.url === '/check-operation' && req.method === 'POST') {
        // 既存実装
        // ...
    }

    // === 静的ファイル配信 ===
    else {
        let filePath = '.' + req.url;
        if (filePath === './') {
            filePath = './index.html';
        }

        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 Not Found</h1>', 'utf-8');
                } else {
                    res.writeHead(500);
                    res.end('Server Error: ' + error.code);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

---

## デプロイ構成（Render）

### デプロイ方法

#### 1. Renderプロジェクト設定

- **Type**: Web Service
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

#### 2. 環境変数設定

```
PORT=3000

# Google API Key (画像生成・動画生成・原稿解析 全てで使用)
GOOGLE_AI_API_KEY=your-google-ai-studio-api-key

# Supabase (認証・データベース・ストレージ)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

**重要:**
- `GOOGLE_AI_API_KEY` **1つで全機能が動きます**
  - 画像生成（**Gemini 3 Pro Image Preview** - Nano Banana Pro）
  - 動画生成（Veo 3.1）
  - 原稿AI解析（**Gemini 3 Pro Preview**）
- Google AI Studioから取得: https://aistudio.google.com/
- **Claude APIは不要**（APIキーの管理が簡素化）

#### 3. package.json

```json
{
  "name": "ai-movie-maker",
  "version": "1.0.0",
  "description": "AI Movie Maker - 動画制作統合ツール",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {}
}
```

### アクセスURL

デプロイ後の各ページへのアクセス方法：

```
https://ai-movie-maker.onrender.com/                    # トップページ（ツール選択）
https://ai-movie-maker.onrender.com/login.html         # ログインページ
https://ai-movie-maker.onrender.com/projects.html      # 企画一覧ページ（NEW）
https://ai-movie-maker.onrender.com/storyboard.html    # 絵コンテ作成アプリ
https://ai-movie-maker.onrender.com/api-test-image.html # 画像生成ツール（Gemini）
https://ai-movie-maker.onrender.com/api-test-movie.html # 動画生成ツール（Veo3）
```

**画面遷移フロー:**
```
login.html → index.html → projects.html → storyboard.html?project=1
                       ↓
                  api-test-image.html
                       ↓
                  api-test-movie.html
```

**認証フロー:**
1. 未認証ユーザー → `/login.html` へ自動リダイレクト
2. Google認証 → ホワイトリストチェック
3. 認証成功 → `/` (トップページ) へ
4. 各ツールへアクセス可能

---

## セキュリティ設計

### 1. 認証・認可

- **認証**: Supabase Auth（Google OAuth）
- **認可**: ホワイトリスト方式（allowed_emailsテーブル）
- **セッション管理**: Supabase（自動）

### 2. APIキー管理

- **保存場所**: 環境変数（Render）
- **公開**: なし（サーバーサイドのみ使用）
- **Veo3 API**: プロキシ経由でアクセス
- **Claude API**: サーバーサイドで呼び出し

### 3. データアクセス制御

- **Row Level Security (RLS)**: 有効
- **ポリシー**: ユーザーは自分のデータのみアクセス可能
- **Storage RLS**: 有効

---

## コスト見積もり

### Supabase（無料プラン）

- データベース: 500MB
- ストレージ: 1GB
- 帯域幅: 2GB/月
- 月間アクティブユーザー: 無制限

**個人利用なら無料枠で十分**

### Render（無料プラン）

- 750時間/月（1サービス）
- 512MB RAM
- スリープあり（15分アクセスなしで休止）

**個人利用なら無料枠で十分**

### 外部API

#### 画像生成
- **Gemini 3 Pro Image Preview (Nano Banana Pro)**: 無料（プレビュー期間中）
- モデル: `gemini-3-pro-image-preview`
- エンドポイント: `generativelanguage.googleapis.com`
- 特徴: 高解像度（4K）、高度なテキストレンダリング、プロ向け

#### 動画生成
- **Google Veo 3.1 Fast**: $0.15/秒（8秒動画 = $1.20）
- **Google Veo 3.1 Standard**: $0.40/秒（8秒動画 = $3.20）
- モデル: `veo-3.1-fast-generate-preview` / `veo-3.1-generate-preview`
- エンドポイント: `generativelanguage.googleapis.com`

#### AI原稿解析
- **Google Gemini API**: 無料枠大（1日150万トークン）
- モデル: `gemini-3-pro-preview`（推奨 - Google史上最強） / `gemini-2.0-flash-exp` / `gemini-1.5-pro-latest`
- エンドポイント: `generativelanguage.googleapis.com`
- 入力: テキスト、画像、動画、音声、PDF対応
- 出力トークン上限: 65,536

**重要: 全機能でGoogle API Key 1つのみ使用**

---

## 実装フェーズ

### Phase 0: フロントエンドモックアップ（完了 ✅）

- [x] login.html 作成（Googleログイン画面）
- [x] index.html 作成（ツール選択ページ）
- [x] projects.html 作成（企画一覧ページ）
- [x] storyboard.html UI調整（ヘッダースリム化、プロジェクト名移動）
- [x] モックデータ実装（Supabaseテーブル構造と同じ形式）
- [x] データ取得関数実装（後でSupabase置き換え可能）
- [x] 動的レンダリング実装（projects.html）
- [x] URLパラメータ連携実装（projects.html ↔ storyboard.html）
- [x] 画面遷移フロー確立（login → index → projects → storyboard）

**成果物:**
- データとUIが完全に分離された実装
- Supabase接続時は関数1つの変更のみで切り替え可能
- 実際のデータフローをモックアップで再現

### Phase 1: 認証システム（優先度: 高）

- [ ] allowed_emails テーブル作成
- [ ] login.html に認証機能実装（現在はモックアップのみ）
- [ ] index.html に認証チェック追加
- [ ] projects.html に認証チェック追加
- [ ] storyboard.html に認証チェック追加
- [ ] 全HTMLに認証チェック追加

### Phase 2: Supabase データベース連携（優先度: 高）

- [ ] データベーススキーマ作成（projects, scenes, dialoguesテーブル）
- [ ] RLS設定
- [ ] Storage設定（画像・動画アップロード用）
- [ ] projects.html の loadProjects() をSupabase版に置き換え
- [ ] storyboard.html の loadProject() をSupabase版に置き換え
- [ ] CRUD処理実装（シーン・セリフの追加・編集・削除）
- [ ] 画像アップロード実装（Supabase Storage連携）

### Phase 3: 原稿インポート機能（優先度: 中）

- [ ] YAMLフォーマット定義
- [ ] インポートモーダルUI作成
- [ ] YAML直接インポート実装
- [ ] AI解析機能実装（Gemini API - **gemini-3-pro-preview**）
- [ ] インポート処理実装（Supabase連携）

### Phase 4: デプロイ（優先度: 中）

- [ ] Renderプロジェクト作成
- [ ] 環境変数設定
- [ ] デプロイ実行
- [ ] 動作確認

---

## 参考資料

### 内部ドキュメント
- [Supabase Database Design](./SUPABASE_DATABASE_DESIGN.md)
- [Veo3 API Reference](./VEO3_API_REFERENCE.md)
- [API Integration Best Practices](./API_INTEGRATION_BEST_PRACTICES.md)

### 外部ドキュメント（公式）

#### Google API
- **[Gemini API Models（最新モデル情報）](https://ai.google.dev/gemini-api/docs/models?hl=ja)** ⭐ 最新情報はここを確認
  - Gemini 3 Pro Preview（原稿解析）
  - Gemini 3 Pro Image Preview / Nano Banana Pro（画像生成）
  - Veo 3.1（動画生成）
- **[Gemini Image Generation（画像生成ガイド）](https://ai.google.dev/gemini-api/docs/image-generation?hl=ja)**
- [Google AI Studio](https://aistudio.google.com/) - APIキー取得

#### Supabase
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth - Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

#### その他
- [js-yaml](https://github.com/nodeca/js-yaml) - YAML パーサー
