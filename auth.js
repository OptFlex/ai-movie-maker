// ========================================
// 共通認証チェック機能
// ========================================

// Supabase設定
const SUPABASE_URL = 'https://sdrpysyhoqnrpixwnhfy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcnB5c3lob3FucnBpeHduaGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2ODYwMDMsImV4cCI6MjA4MzI2MjAwM30.UK9f1aP_49c49KlIHRekvb3nmK5pInR3kMW-mwILzkI'

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * 認証チェックとホワイトリスト確認
 * @returns {Promise<Object|null>} セッション情報または null
 */
async function checkAuthAndWhitelist() {
    console.log('🔵 認証チェック開始...')

    // 1. セッションチェック
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession()

    if (sessionError) {
        console.error('❌ セッション取得エラー:', sessionError)
        return null
    }

    if (!session) {
        console.log('⚠️ 未ログイン - login.htmlへリダイレクト')
        window.location.href = './login.html'
        return null
    }

    console.log('✅ セッション確認OK:', session.user.email)

    // 2. ホワイトリストチェック
    const userEmail = session.user.email
    console.log('🔵 ホワイトリストチェック:', userEmail)

    const { data: allowedEmail, error: whitelistError } = await supabaseClient
        .from('allowed_emails')
        .select('email, name')
        .eq('email', userEmail)
        .maybeSingle()

    if (whitelistError) {
        console.error('❌ ホワイトリストチェックエラー:', whitelistError)
        alert('認証エラーが発生しました。もう一度お試しください。')
        await supabaseClient.auth.signOut()
        window.location.href = './login.html'
        return null
    }

    if (!allowedEmail) {
        console.warn('⚠️ ホワイトリストに未登録:', userEmail)
        alert('このアプリへのアクセス権限がありません。\n管理者に連絡してアクセス権を取得してください。')
        await supabaseClient.auth.signOut()
        window.location.href = './login.html'
        return null
    }

    console.log('✅ ホワイトリスト確認OK:', allowedEmail)
    return session
}

/**
 * ログアウト処理
 */
async function logout() {
    const { error } = await supabaseClient.auth.signOut()

    if (error) {
        console.error('❌ ログアウトエラー:', error)
        alert('ログアウトに失敗しました')
    } else {
        window.location.href = './login.html'
    }
}

// 認証状態の変化を監視
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('🔵 Auth state changed:', event)

    if (event === 'SIGNED_OUT' || !session) {
        // ログアウト時または未ログイン時
        if (!window.location.pathname.includes('login.html')) {
            console.log('⚠️ セッション切れ - login.htmlへリダイレクト')
            window.location.href = './login.html'
        }
    }
})
