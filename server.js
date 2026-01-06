/**
 * Veo3 API プロキシサーバー
 * CORS制限を回避するために、フロントエンドからのリクエストを受け取り、
 * Google Veo3 APIに転送するプロキシサーバー
 */

const http = require('http');
const PORT = 3000;

// リクエストボディをパース
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

// CORSヘッダーを設定
function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// サーバー作成
const server = http.createServer(async (req, res) => {
    setCORSHeaders(res);

    // プリフライトリクエスト対応
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 動画生成エンドポイント
    if (req.url === '/generate-video' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { apiKey, prompt, imageBase64, duration, fps, modelName, generateAudio } = body;

            if (!apiKey || !prompt || !imageBase64) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required parameters' }));
                return;
            }

            // モデル名を処理（"-no-audio"サフィックスを削除）
            const actualModelName = modelName.replace('-no-audio', '');
            const audioEnabled = generateAudio !== false;

            console.log('動画生成リクエスト受信:', { prompt, duration, fps, modelName: actualModelName, audioEnabled });

            // Veo3 APIにリクエスト（predictLongRunningエンドポイント）
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${actualModelName}:predictLongRunning`;

            // 画像付きプロンプトを作成
            const fullPrompt = `[Image] ${prompt}`;

            // パラメータを構築
            const parameters = {
                aspectRatio: "16:9",
                resolution: "720p",
                durationSeconds: duration
            };

            // 注意: generateAudioパラメータはプレビューモデルではサポートされていない
            // 音声の有無は現在制御できないため、常に音声付きで生成される

            const apiResponse = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    instances: [{
                        prompt: fullPrompt,
                        image: {
                            bytesBase64Encoded: imageBase64,
                            mimeType: "image/jpeg"
                        }
                    }],
                    parameters: parameters
                })
            });

            const responseData = await apiResponse.json();
            console.log('Veo3 API レスポンス:', JSON.stringify(responseData, null, 2));

            if (!apiResponse.ok) {
                res.writeHead(apiResponse.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API Error', details: responseData }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ operationName: responseData.name }));

        } catch (error) {
            console.error('エラー:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    // 操作ステータス確認エンドポイント
    else if (req.url === '/check-operation' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { apiKey, operationName } = body;

            if (!apiKey || !operationName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required parameters' }));
                return;
            }

            console.log('操作ステータス確認:', operationName);

            // 操作ステータスをチェック
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;

            const apiResponse = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const responseData = await apiResponse.json();
            console.log('操作ステータス:', responseData.done ? '完了' : '処理中');
            if (responseData.done) {
                console.log('完了レスポンス:', JSON.stringify(responseData, null, 2));
            }

            if (!apiResponse.ok) {
                res.writeHead(apiResponse.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API Error', details: responseData }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));

        } catch (error) {
            console.error('エラー:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    // 404
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`\n🚀 プロキシサーバー起動`);
    console.log(`📡 ポート: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`\n利用可能なエンドポイント:`);
    console.log(`  POST /generate-video - 動画生成を開始`);
    console.log(`  POST /check-operation - 操作ステータスを確認\n`);
});
