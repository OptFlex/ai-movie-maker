// Veo API操作ステータスをチェックするEdge Function
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("check-video-status Function started")

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
    // リクエストボディから操作名を取得
    const { operationName } = await req.json()

    if (!operationName) {
      return new Response(
        JSON.stringify({ error: '操作名が必要です' }),
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

    console.log('操作ステータス確認:', operationName)

    // Veo Operations API呼び出し
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${VEO3_API_KEY}`

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Veo Operations APIエラー:', response.status, errorText)
      return new Response(
        JSON.stringify({
          error: 'Veo Operations API呼び出しに失敗しました',
          details: errorText
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result = await response.json()
    console.log('操作ステータス取得成功:', result.done ? '完了' : '処理中')

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
