// Gemini API（画像生成）を呼び出すEdge Function
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("generate-image Function started")

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
    const { prompt, previousImageUrl } = await req.json()

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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY が設定されていません')
      return new Response(
        JSON.stringify({ error: 'サーバー設定エラー' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Gemini API呼び出し開始:', prompt.substring(0, 50))
    console.log('前回画像URL:', previousImageUrl || 'なし')

    // 前回画像がある場合、画像をダウンロードしてbase64に変換
    let previousImageBase64: string | null = null
    if (previousImageUrl) {
      try {
        console.log('前回画像をダウンロード中...')
        const imageResponse = await fetch(previousImageUrl)
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer()
          const uint8Array = new Uint8Array(imageBuffer)

          // 大きな配列をbtoa()で変換するため、チャンクに分割して処理
          let binary = ''
          const chunkSize = 8192
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length))
            const chunkArray = Array.from(chunk) as number[]
            binary += String.fromCharCode(...chunkArray)
          }
          previousImageBase64 = btoa(binary)
          console.log('前回画像のダウンロード成功')
        } else {
          console.warn('前回画像のダウンロード失敗:', imageResponse.status)
        }
      } catch (error) {
        console.warn('前回画像の取得エラー:', error)
        // エラーでも処理は継続（前回画像なしで生成）
      }
    }

    // Gemini APIリクエストのparts配列を構築
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

    // 前回画像がある場合は先に追加
    if (previousImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: previousImageBase64
        }
      })
    }

    // プロンプトを追加
    parts.push({ text: prompt })

    // Gemini API呼び出し
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`

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
          maxOutputTokens: 8192,
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini APIエラー:', response.status, errorText)
      return new Response(
        JSON.stringify({
          error: 'Gemini API呼び出しに失敗しました',
          details: errorText
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result = await response.json()
    console.log('Gemini API呼び出し成功')

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
