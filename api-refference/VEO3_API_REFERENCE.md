# Veo 3 API リファレンス

このドキュメントは、Google Veo 3.1 APIを使用した動画生成の仕様とJSON構成をまとめたものです。

## 目次
- [API概要](#api概要)
- [料金・レート制限](#料金レート制限)
- [エンドポイント](#エンドポイント)
- [JSONリクエスト構成](#jsonリクエスト構成)
- [パラメータ詳細](#パラメータ詳細)
- [レスポンス構成](#レスポンス構成)
- [使用例](#使用例)

---

## API概要

**API名**: Google Veo 3.1 Video Generation API
**用途**: 画像とプロンプトから動画を生成
**認証**: Google AI Studio API Key（`x-goog-api-key`ヘッダー）

---

## 料金・レート制限

### 💰 料金体系（2025年1月時点）

#### モデル別料金（画像→動画生成）

| モデル | 料金/秒 | 8秒動画の料金 | 特徴 |
|--------|---------|--------------|------|
| **Veo 3.1 Standard** | $0.40 | **$3.20** | 高品質、標準速度 |
| **Veo 3.1 Fast** ⭐ | $0.15 | **$1.20** | 高速、コスト効率◎（現在使用中） |
| **Veo 3.1 Fast（音声なし）** | $0.10 | **$0.80** | 最安、無音動画 |

**現在のコード**: `veo-3.1-fast-generate-preview` を使用 → **$1.20/本**

#### コスト例

```
1動画（8秒）:    $1.20
10動画:          $12.00
100動画:         $120.00
1000動画:        $1,200.00
```

### 🔒 レート制限

| 項目 | 制限値 |
|------|--------|
| **リクエスト数** | 10リクエスト/分 |
| **同時生成数** | 10-20動画 |
| **1日の上限** | 明示的な制限なし（従量課金） |

⚠️ **注意**: プレビューモデル（`*-preview`）は、より厳しい制限がかかる場合があります。

### 📊 サブスクリプションプラン

#### Google AI Studio（無料枠）- 現在使用中
- レート制限: 10リクエスト/分
- 料金: 従量課金（$0.15/秒）
- 上限: なし（使った分だけ課金）

#### Google AI Pro（$19.99/月）
- 月90動画まで無料（Veo 3.1 Fast）
- 超過分: $0.15/秒

#### Google AI Ultra（$249.99/月）
- 1日5動画（1080p）
- 月最大150動画
- 超過分: $0.40/秒

### ⚡ エラー: "Lot of Requests Right Now"

短時間に大量のリクエストを送ると発生します。

**対策:**
- リクエスト間隔を5秒以上空ける
- 10リクエスト/分を超えないようにする
- エラー時は指数バックオフで再試行

### 💡 コスト削減のヒント

1. **動画を短くする**: 4秒なら$0.60/本（半額）
2. **音声を無効化**: $0.10/秒（33%削減）
3. **バッチ処理**: まとめて生成し、レート制限内で処理

---

## エンドポイント

### 1. 動画生成開始
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model-name}:predictLongRunning
```

**モデル名**:
- `veo-3.1-fast-generate-preview` (推奨)
- `veo-3.0-generate-preview`
- `veo-2-generate-preview`

### 2. 操作ステータス確認
```
GET https://generativelanguage.googleapis.com/v1beta/{operationName}?key={apiKey}
```

---

## JSONリクエスト構成

### 動画生成リクエスト

#### フロントエンド → プロキシサーバー
```json
{
  "apiKey": "YOUR_API_KEY",
  "prompt": "カメラがゆっくりと右にパンしながら、雲が流れる",
  "imageBase64": "base64エンコードされた画像データ",
  "duration": 8,
  "fps": 24
}
```

#### プロキシサーバー → Veo3 API
```json
{
  "instances": [
    {
      "prompt": "[Image] カメラがゆっくりと右にパンしながら、雲が流れる",
      "image": {
        "bytesBase64Encoded": "base64エンコードされた画像データ",
        "mimeType": "image/jpeg"
      }
    }
  ],
  "parameters": {
    "aspectRatio": "16:9",
    "resolution": "720p",
    "durationSeconds": "8"
  }
}
```

---

## パラメータ詳細

### `instances` オブジェクト

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `prompt` | string | ✅ | 動画生成のプロンプト。画像使用時は `[Image]` プレフィックスを追加 |
| `image.bytesBase64Encoded` | string | ✅ | Base64エンコードされた画像データ |
| `image.mimeType` | string | ✅ | 画像のMIMEタイプ（例: `image/jpeg`, `image/png`） |

### `parameters` オブジェクト

| パラメータ | 型 | 必須 | 指定可能な値 | デフォルト | 説明 |
|-----------|-----|------|-------------|-----------|------|
| `durationSeconds` | string | ✅ | `"4"`, `"6"`, `"8"` | `"8"` | 動画の長さ（秒）<br>**⚠️ 画像使用時は `"8"` 固定** |
| `aspectRatio` | string | ❌ | `"16:9"`, `"9:16"` | `"16:9"` | アスペクト比 |
| `resolution` | string | ❌ | `"720p"`, `"1080p"` | `"720p"` | 動画解像度（Veo 3のみ） |
| `sampleCount` | integer | ❌ | `1` ～ `4` | `1` | 生成する動画の数 |
| `seed` | integer | ❌ | `0` ～ `4294967295` | - | 決定論的な生成用シード値 |
| `negativePrompt` | string | ❌ | - | - | 除外したい要素の説明 |
| `personGeneration` | string | ❌ | - | - | 人物生成の安全設定 |
| `generateAudio` | boolean | ❌ | `true`, `false` | - | オーディオ生成の有無（Veo 3で必須） |

### `durationSeconds` の制約

| モデル | 指定可能な値 | 備考 |
|--------|-------------|------|
| Veo 3 / 3.1 | `4`, `6`, `8` 秒 | 画像使用時は `8` 秒のみ |
| Veo 2 | `5` ～ `8` 秒 | - |

**⚠️ 重要な制約**:
- **参照画像使用時**: `8` 秒のみ
- **拡張機能使用時**: `8` 秒のみ
- **フレーム補間使用時**: `8` 秒のみ

---

## レスポンス構成

### 動画生成開始のレスポンス
```json
{
  "name": "operations/abc123...",
  "metadata": {
    "@type": "type.googleapis.com/google.cloud.aiplatform.v1beta1.GenerateVideoMetadata"
  }
}
```

**重要**: `name` フィールドの値が操作名（`operationName`）として使用されます。

### ステータス確認のレスポンス

#### 処理中の場合
```json
{
  "name": "operations/abc123...",
  "done": false,
  "metadata": {
    "@type": "type.googleapis.com/google.cloud.aiplatform.v1beta1.GenerateVideoMetadata"
  }
}
```

#### 完了した場合
```json
{
  "name": "operations/abc123...",
  "done": true,
  "response": {
    "@type": "type.googleapis.com/google.cloud.aiplatform.v1beta1.GenerateVideoResponse",
    "generatedVideos": [
      {
        "video": "base64エンコードされた動画データ（MP4形式）"
      }
    ]
  }
}
```

#### エラーの場合
```json
{
  "name": "operations/abc123...",
  "done": true,
  "error": {
    "code": 400,
    "message": "エラーメッセージの詳細",
    "details": []
  }
}
```

---

## 使用例

### 1. 動画生成リクエスト

```javascript
const response = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({
      instances: [{
        prompt: '[Image] カメラがゆっくりと右にパンしながら、雲が流れる',
        image: {
          bytesBase64Encoded: imageBase64,
          mimeType: 'image/jpeg'
        }
      }],
      parameters: {
        aspectRatio: '16:9',
        resolution: '720p',
        durationSeconds: '8'
      }
    })
  }
);

const data = await response.json();
const operationName = data.name;
```

### 2. ステータス確認（ポーリング）

```javascript
async function checkStatus(operationName, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  if (data.done) {
    if (data.error) {
      console.error('エラー:', data.error);
    } else if (data.response?.generatedVideos?.length > 0) {
      const videoBase64 = data.response.generatedVideos[0].video;
      // 動画を表示またはダウンロード
    }
  } else {
    // 5秒後に再試行
    setTimeout(() => checkStatus(operationName, apiKey), 5000);
  }
}
```

### 3. 動画のダウンロード

```javascript
function downloadVideo(base64Data) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'video/mp4' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'veo3-video.mp4';
  a.click();

  URL.revokeObjectURL(url);
}
```

---

## コード実装の参照

### プロキシサーバー実装
- **動画生成リクエスト**: `server.js:67-87`
- **ステータス確認**: `server.js:123-130`

### フロントエンド実装
- **生成リクエスト送信**: `api-test-movie.html:186-198`
- **ステータスポーリング**: `api-test-movie.html:236-245`
- **動画データ取得**: `api-test-movie.html:265-267`
- **動画表示**: `api-test-movie.html:304-320`

---

## 公式ドキュメント

### API仕様
- [Generate videos with Veo 3.1 in Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/video)
- [Veo on Vertex AI video generation API | Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
- [Google AI Studio](https://aistudio.google.com/)

### 料金・プラン
- [Gemini Developer API pricing | Google AI for Developers](https://ai.google.dev/gemini-api/docs/pricing)
- [Veo 3 and Veo 3 Fast – new pricing and configurations - Google Developers Blog](https://developers.googleblog.com/veo-3-and-veo-3-fast-new-pricing-new-configurations-and-better-resolution/)
- [Veo 3.1 Pricing & Access (2025) - Skywork AI](https://skywork.ai/blog/veo-3-1-pricing-access-2025/)
- [How Much does Veo 3 Cost? - CometAPI](https://www.cometapi.com/how-much-does-veo-3-cost-all-you-need-to-know/)

---

## 注意事項

1. **APIキーの管理**: APIキーは `.env.js` ファイルに保存し、`.gitignore` に追加してください
2. **料金**: 8秒動画1本あたり**$1.20**（Veo 3.1 Fast使用時）。大量生成前にコストを確認してください
3. **レート制限**: 10リクエスト/分を超えないように注意。超過すると "Lot of Requests" エラーが発生
4. **ポーリング間隔**: 動画生成には時間がかかるため、5秒間隔でステータス確認を推奨
5. **タイムアウト**: 最大5分（60回のポーリング）まで待機
6. **画像フォーマット**: JPEG、PNG対応（Base64エンコード必須）
7. **動画サイズ**: 生成される動画は数MB～数十MBになる可能性があります

---

**最終更新**: 2026-01-02
**API バージョン**: v1beta
