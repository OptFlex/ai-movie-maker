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
    const { prompt, previousImageUrl, referenceImageUrls } = await req.json()

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
    console.log('参照画像URL:', referenceImageUrls || [])

    // 画像をダウンロードしてbase64に変換するヘルパー関数
    async function downloadAndConvertToBase64(url: string): Promise<string | null> {
      try {
        const imageResponse = await fetch(url)
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
          return btoa(binary)
        } else {
          console.warn('画像ダウンロード失敗:', imageResponse.status)
          return null
        }
      } catch (error) {
        console.warn('画像取得エラー:', error)
        return null
      }
    }

    // 前回画像がある場合、画像をダウンロードしてbase64に変換
    let previousImageBase64: string | null = null
    if (previousImageUrl) {
      console.log('前回画像をダウンロード中...')
      previousImageBase64 = await downloadAndConvertToBase64(previousImageUrl)
      if (previousImageBase64) {
        console.log('前回画像のダウンロード成功')
      }
    }

    // 参照画像をダウンロード（前回画像がない場合のみ）
    const referenceImagesBase64: string[] = []
    if (!previousImageUrl && referenceImageUrls && Array.isArray(referenceImageUrls) && referenceImageUrls.length > 0) {
      console.log(`参照画像をダウンロード中... (${referenceImageUrls.length}枚)`)
      for (const refUrl of referenceImageUrls) {
        const base64 = await downloadAndConvertToBase64(refUrl)
        if (base64) {
          referenceImagesBase64.push(base64)
        }
      }
      console.log(`参照画像のダウンロード成功: ${referenceImagesBase64.length}枚`)
    }

    // Gemini APIリクエストのparts配列を構築
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

    // 前回画像がある場合は先に追加（2回目以降の修正指示）
    if (previousImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: previousImageBase64
        }
      })
      console.log('前回画像をGeminiに送信')
    }

    // 参照画像がある場合は追加（1回目の生成）
    if (referenceImagesBase64.length > 0) {
      for (const refBase64 of referenceImagesBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: refBase64
          }
        })
      }
      console.log(`参照画像${referenceImagesBase64.length}枚をGeminiに送信`)
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
