# API連携のベストプラクティス - Veo3実装から学んだこと

このドキュメントは、Veo3 API実装時に遭遇したエラーと解決策をまとめたものです。今後の自作アプリとの連携に活用してください。

## 目次
- [発生したエラーと解決策](#発生したエラーと解決策)
- [API連携の設計原則](#api連携の設計原則)
- [実装チェックリスト](#実装チェックリスト)
- [デバッグ手法](#デバッグ手法)

---

## 発生したエラーと解決策

### ❌ エラー1: データ型の不一致

**エラーメッセージ:**
```json
{
  "error": {
    "code": 400,
    "message": "The value type for `durationSeconds` needs to be a number.",
    "status": "INVALID_ARGUMENT"
  }
}
```

**原因:**
```javascript
// ❌ 間違い
parameters: {
    durationSeconds: duration.toString()  // 文字列として送信
}
```

**解決策:**
```javascript
// ✅ 正しい
parameters: {
    durationSeconds: duration  // 数値として送信
}
```

**教訓:**
- APIドキュメントで**データ型を必ず確認**する（string, number, boolean, object）
- JavaScriptは暗黙の型変換があるため、型を明示的に確認
- `toString()` や `parseInt()` の使用前に、APIが期待する型を確認

**コード例（型チェック）:**
```javascript
// 型を確実にするヘルパー関数
function ensureNumber(value) {
    const num = Number(value);
    if (isNaN(num)) {
        throw new Error(`Invalid number: ${value}`);
    }
    return num;
}

// 使用例
parameters: {
    durationSeconds: ensureNumber(duration)
}
```

---

### ❌ エラー2: レスポンス構造の不一致

**問題:**
```javascript
// フロントエンドが期待していた構造
if (data.operationName) {
    // ...
}
```

**実際のAPIレスポンス:**
```json
{
  "name": "models/veo-3.1-fast-generate-preview/operations/7jzvgptr3smw"
}
```

**解決策:**
```javascript
// サーバー側で構造を変換
res.end(JSON.stringify({
    operationName: responseData.name
}));
```

**教訓:**
- APIレスポンスを**必ずログ出力**して構造を確認
- フロントエンドとバックエンドで**データ構造を統一**
- プロキシサーバーで構造を変換し、フロントエンドを簡潔に保つ

**設計パターン:**
```javascript
// プロキシサーバーでレスポンスを正規化
function normalizeApiResponse(apiResponse) {
    return {
        operationId: apiResponse.name || apiResponse.id,
        status: apiResponse.done ? 'completed' : 'pending',
        data: apiResponse.response || null,
        error: apiResponse.error || null
    };
}
```

---

### ❌ エラー3: ネストされたレスポンス構造の誤解

**期待していた構造:**
```javascript
// ❌ 間違い
if (data.response.generatedVideos) {
    const video = data.response.generatedVideos[0].video;
}
```

**実際のAPIレスポンス:**
```json
{
  "response": {
    "generateVideoResponse": {
      "generatedSamples": [
        {
          "video": {
            "uri": "https://..."
          }
        }
      ]
    }
  }
}
```

**解決策:**
```javascript
// ✅ 正しい
if (data.response?.generateVideoResponse?.generatedSamples) {
    const videoUri = data.response.generateVideoResponse.generatedSamples[0].video.uri;
}
```

**教訓:**
- ドキュメントだけでなく、**実際のレスポンスを確認**する
- Optional Chaining (`?.`) を使って安全にアクセス
- レスポンス全体をログ出力してデバッグ

**安全なデータアクセスパターン:**
```javascript
// ヘルパー関数でネストされたデータを安全に取得
function getNestedValue(obj, path, defaultValue = null) {
    return path.split('.').reduce((current, key) =>
        current?.[key], obj) ?? defaultValue;
}

// 使用例
const videoUri = getNestedValue(
    data,
    'response.generateVideoResponse.generatedSamples.0.video.uri'
);
```

---

### ❌ エラー4: Base64データ vs URIの混同

**期待:**
APIが動画をBase64で直接返す

**実際:**
APIが動画のダウンロードURIを返す

**解決策:**
```javascript
// URIから動画をダウンロードしてBase64に変換
async function downloadVideoFromUri(videoUri) {
    const apiKey = document.getElementById('veo3-api-key').value;
    const response = await fetch(`${videoUri}&key=${apiKey}`);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    return base64;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
```

**教訓:**
- APIが返すデータ形式を**事前に確認**（Base64, URI, Blob, etc.）
- 必要に応じて形式を変換する処理を実装
- 大きなファイルの場合、URIを使う方が効率的

---

## API連携の設計原則

### 1. **ドキュメント駆動開発**

#### ステップ1: APIドキュメントを熟読
```markdown
□ エンドポイントURL
□ HTTPメソッド（GET, POST, etc.）
□ 認証方法（API Key, OAuth, etc.）
□ リクエストパラメータ（必須/任意、型、デフォルト値）
□ レスポンス構造
□ エラーコード一覧
□ レート制限
```

#### ステップ2: サンプルレスポンスを取得
```javascript
// まず小さなテストスクリプトを作成
async function testApi() {
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
    });

    const data = await response.json();
    console.log('Full Response:', JSON.stringify(data, null, 2));

    // レスポンス構造を確認してから実装
}
```

---

### 2. **段階的実装アプローチ**

#### Phase 1: 基本的なAPI呼び出し
```javascript
// 1. 最小限のパラメータで動作確認
const minimalRequest = {
    prompt: "test"
};

// 2. ログを詳細に出力
console.log('Request:', minimalRequest);
const response = await callApi(minimalRequest);
console.log('Response:', response);
```

#### Phase 2: エラーハンドリング追加
```javascript
try {
    const response = await callApi(request);

    if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.message);
    }

    return await response.json();
} catch (error) {
    console.error('Request failed:', error);
    throw error;
}
```

#### Phase 3: 完全な実装
```javascript
// パラメータバリデーション
// リトライロジック
// タイムアウト処理
// キャッシング
```

---

### 3. **プロキシサーバーパターン**

#### メリット
- ✅ CORS問題の回避
- ✅ APIキーの秘匿化
- ✅ レスポンス構造の正規化
- ✅ エラーハンドリングの一元化
- ✅ レート制限の実装

#### 実装例
```javascript
// server.js - プロキシサーバー
app.post('/api/generate-video', async (req, res) => {
    try {
        // 1. リクエストをバリデーション
        const { prompt, imageBase64, duration } = req.body;
        if (!prompt || !imageBase64) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // 2. データ型を確認・変換
        const validatedDuration = ensureNumber(duration);

        // 3. 外部APIにリクエスト
        const apiResponse = await fetch(EXTERNAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': process.env.API_KEY  // 環境変数から取得
            },
            body: JSON.stringify({
                instances: [{
                    prompt: prompt,
                    image: { bytesBase64Encoded: imageBase64 }
                }],
                parameters: {
                    durationSeconds: validatedDuration
                }
            })
        });

        const data = await apiResponse.json();

        // 4. レスポンスを正規化
        const normalizedResponse = {
            operationId: data.name,
            status: 'initiated'
        };

        // 5. ログ出力
        console.log('API Request:', { prompt, duration: validatedDuration });
        console.log('API Response:', JSON.stringify(data, null, 2));

        res.json(normalizedResponse);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});
```

---

### 4. **ポーリング実装のベストプラクティス**

#### 指数バックオフ戦略
```javascript
async function pollWithBackoff(operationId, maxAttempts = 60) {
    let attempts = 0;
    let delay = 1000; // 初期遅延: 1秒

    const poll = async () => {
        attempts++;

        const status = await checkStatus(operationId);

        if (status.done) {
            return status;
        }

        if (attempts >= maxAttempts) {
            throw new Error('Timeout');
        }

        // 指数バックオフ: 1秒 → 2秒 → 4秒 → ... 最大30秒
        delay = Math.min(delay * 2, 30000);

        await sleep(delay);
        return poll();
    };

    return poll();
}
```

#### 固定間隔ポーリング（Veo3の実装）
```javascript
async function pollFixedInterval(operationId, interval = 5000, maxAttempts = 60) {
    let attempts = 0;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            attempts++;
            updateUI(`処理中... (${attempts}/${maxAttempts})`);

            try {
                const status = await checkStatus(operationId);

                if (status.done) {
                    if (status.error) {
                        reject(new Error(status.error));
                    } else {
                        resolve(status.response);
                    }
                } else if (attempts < maxAttempts) {
                    setTimeout(poll, interval);
                } else {
                    reject(new Error('Timeout'));
                }
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
}
```

---

## 実装チェックリスト

### 開発前
- [ ] APIドキュメントを読む
- [ ] サンプルコードを確認
- [ ] レート制限を確認
- [ ] 料金体系を確認
- [ ] 認証方法を理解

### 実装中
- [ ] 最小限のテストケースで動作確認
- [ ] データ型を明示的に確認
- [ ] エラーレスポンスの構造を確認
- [ ] ログを詳細に出力
- [ ] エラーハンドリングを実装

### テスト
- [ ] 正常系のテスト
- [ ] エラー系のテスト（不正なパラメータ、認証エラー等）
- [ ] タイムアウトのテスト
- [ ] 大量データのテスト
- [ ] ネットワークエラーのテスト

### 本番前
- [ ] APIキーを環境変数に移動
- [ ] エラーメッセージをユーザーフレンドリーに
- [ ] レート制限の対策
- [ ] ログレベルの調整
- [ ] セキュリティチェック

---

## デバッグ手法

### 1. **段階的ログ出力**

```javascript
// リクエスト送信前
console.log('=== API Request ===');
console.log('Endpoint:', endpoint);
console.log('Method:', method);
console.log('Headers:', headers);
console.log('Body:', JSON.stringify(body, null, 2));

// レスポンス受信後
console.log('=== API Response ===');
console.log('Status:', response.status);
console.log('Headers:', response.headers);
const data = await response.json();
console.log('Body:', JSON.stringify(data, null, 2));

// データ処理後
console.log('=== Processed Data ===');
console.log('Extracted Value:', extractedValue);
```

### 2. **型チェック**

```javascript
function debugTypes(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`${prefix}${key}: ${type}`);

        if (type === 'object' && value !== null) {
            debugTypes(value, `${prefix}${key}.`);
        }
    }
}

// 使用例
debugTypes(apiResponse);
// 出力:
// name: string
// done: boolean
// response: object
// response.generateVideoResponse: object
// response.generateVideoResponse.generatedSamples: array
```

### 3. **レスポンス構造の可視化**

```javascript
function visualizeStructure(obj, indent = 0) {
    const spaces = '  '.repeat(indent);

    if (Array.isArray(obj)) {
        console.log(`${spaces}[`);
        obj.forEach((item, i) => {
            console.log(`${spaces}  [${i}]:`);
            visualizeStructure(item, indent + 2);
        });
        console.log(`${spaces}]`);
    } else if (typeof obj === 'object' && obj !== null) {
        console.log(`${spaces}{`);
        for (const [key, value] of Object.entries(obj)) {
            console.log(`${spaces}  ${key}:`);
            visualizeStructure(value, indent + 2);
        }
        console.log(`${spaces}}`);
    } else {
        console.log(`${spaces}${typeof obj}: ${obj}`);
    }
}
```

### 4. **cURLコマンドでのテスト**

JavaScriptコードをデバッグする前に、cURLで直接APIをテスト：

```bash
# 動画生成リクエスト
curl -X POST \
  'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning' \
  -H 'Content-Type: application/json' \
  -H 'x-goog-api-key: YOUR_API_KEY' \
  -d '{
    "instances": [{
      "prompt": "test",
      "image": {
        "bytesBase64Encoded": "...",
        "mimeType": "image/jpeg"
      }
    }],
    "parameters": {
      "durationSeconds": 8
    }
  }' | jq '.'

# ステータス確認
curl -X GET \
  'https://generativelanguage.googleapis.com/v1beta/OPERATION_NAME?key=YOUR_API_KEY' \
  | jq '.'
```

---

## プロジェクト構造の推奨

```
project/
├── .env.example          # 環境変数のテンプレート
├── .env                  # 実際のAPIキー（.gitignoreに追加）
├── .gitignore            # .env, node_modules等を除外
├── server.js             # プロキシサーバー
├── index.html            # フロントエンド
├── docs/
│   ├── API_REFERENCE.md       # APIリファレンス
│   ├── BEST_PRACTICES.md      # このドキュメント
│   └── TROUBLESHOOTING.md     # トラブルシューティング
└── tests/
    ├── api-test.js       # APIテスト
    └── integration-test.js
```

---

## まとめ

### 今回の実装で学んだ重要ポイント

1. **ドキュメントと実装の乖離を前提にする**
   - ドキュメントを信じるが、実際のレスポンスで検証する

2. **型を明示的に扱う**
   - JavaScriptの暗黙の型変換に頼らない

3. **段階的に実装する**
   - 一度に全てを実装せず、小さく動作確認

4. **ログを詳細に出力する**
   - デバッグ時間を大幅に短縮できる

5. **プロキシパターンを活用する**
   - セキュリティ、保守性、拡張性が向上

### 次のプロジェクトで最初にやること

```javascript
// 1. 最小限のテストスクリプトを作成
async function testNewApi() {
    console.log('=== Testing New API ===');

    // 最小限のパラメータ
    const request = {
        // ...
    };

    console.log('Request:', JSON.stringify(request, null, 2));

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(request)
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));

        // 型チェック
        debugTypes(data);

    } catch (error) {
        console.error('Error:', error);
    }
}

// 2. 動作確認後、本格実装を開始
```

---

**最終更新**: 2026-01-02
**対象API**: Google Veo 3.1 API
**作成理由**: API連携時の試行錯誤を今後の開発に活かすため
