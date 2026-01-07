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

    // コンテンツ部分を構築（画像がある場合は含める）
    const parts: any[] = []

    // 画像がある場合は先に追加
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64
        }
      })
    }

    // プロンプトを追加
    parts.push({ text: prompt })

    // Veo API呼び出し
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${VEO3_API_KEY}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        generationConfig: {
          temperature: 1.0,
          topK: 40,
          topP: 0.95,
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Veo APIエラー:', response.status, errorText)
      return new Response(
        JSON.stringify({
          error: 'Veo API呼び出しに失敗しました',
          details: errorText
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result = await response.json()
    console.log('Veo API呼び出し成功')

    // 結果を返す
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
