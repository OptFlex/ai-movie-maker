// Veo API（動画生成）を呼び出すEdge Function
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("generate-video Function started")

Deno.serve(async (req) => {
  // CORSヘッダー設定（ブラウザからのアクセス許可）
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // OPTIONSリクエスト（CORS preflight）への対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // リクエストボディから必要な情報を取得
    const { prompt, modelType, imageBase64, mimeType } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'プロンプトが必要です' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 環境変数からAPIキーを取得（安全に管理）
    const VEO3_API_KEY = Deno.env.get('VEO3_API_KEY')

    if (!VEO3_API_KEY) {
      console.error('VEO3_API_KEY が設定されていません')
      return new Response(
        JSON.stringify({ error: 'サーバー設定エラー' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // モデル選択（現在はveo-3.1-generate-previewのみ利用可能）
    // TODO: veo-3.1-fast-generate-previewが利用可能になったら戻す
    const model = 'veo-3.1-generate-preview'

    console.log('Veo API呼び出し開始:', model, prompt.substring(0, 50))

    // Veo API呼び出し（predictLongRunningを使用）
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`

    // リクエストボディの構築
    const requestBody: any = {
      instances: [{
        prompt: prompt
      }],
      parameters: {
        aspectRatio: '16:9'
      }
    }

    // 画像がある場合は追加（空文字列でない場合のみ）
    if (imageBase64 && imageBase64.trim() !== '') {
      requestBody.instances[0].image = {
        bytesBase64Encoded: imageBase64
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': VEO3_API_KEY
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Veo APIエラー:', response.status, errorText)
      console.error('リクエストURL:', apiUrl)
      console.error('リクエストボディ:', JSON.stringify(requestBody, null, 2))
      return new Response(
        JSON.stringify({
          error: 'Veo API呼び出しに失敗しました',
          details: errorText,
          status: response.status
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result = await response.json()
    console.log('Veo API呼び出し成功:', result)

    // predictLongRunningはoperationオブジェクトを返す
    // フロントエンドではoperation.nameを使ってポーリングする
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge Function エラー:', error)
    return new Response(
      JSON.stringify({
        error: 'サーバーエラーが発生しました',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
