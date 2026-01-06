# AI動画生成アプリ

AI画像・動画生成を活用したYouTubeチャンネル運営支援アプリ

## セットアップ

### 1. APIキーの設定

1. `.env.example.js` を `.env.js` にコピー
   ```bash
   cp .env.example.js .env.js
   ```

2. [Google AI Studio](https://aistudio.google.com/) でAPIキーを取得

3. `.env.js` を開いて、APIキーを設定
   ```javascript
   const ENV = {
       NANOBANANA_API_KEY: 'ここにAPIキーを貼り付け',
       VEO3_API_KEY: 'ここにAPIキーを貼り付け'  // 同じキーでOK
   };
   ```

### 2. 使い方

#### 画像生成テスト（nanobanana Pro）
```bash
open api-test-image.html
```

#### 動画生成テスト（Veo3）
1. プロキシサーバーを起動
   ```bash
   node server.js
   ```

2. 別のターミナルで、HTMLファイルを開く
   ```bash
   open api-test-movie.html
   ```

#### メインアプリ
```bash
open index.html
```

## ファイル構成

```
ai-movie-maker/
├── index.html          # メインアプリUI（6カラムレイアウト）
├── api-test-image.html # 画像生成テスト用UI（nanobanana Pro）
├── api-test-movie.html # 動画生成テスト用UI（Veo3）
├── server.js           # 動画生成用プロキシサーバー
├── package.json        # Node.js設定ファイル
├── requirements.md     # 要件定義書
├── .env.js            # APIキー設定（Git管理外）
├── .env.example.js    # APIキー設定のサンプル
├── .gitignore         # Git除外設定
└── README.md          # このファイル
```

## セキュリティ

- `.env.js` は `.gitignore` に含まれており、Gitにコミットされません
- APIキーは絶対に公開リポジトリにプッシュしないでください
- チーム共有時は `.env.example.js` を参考に各自で `.env.js` を作成してください

## API料金

- **nanobanana Pro（画像生成）**: 約21円/枚
- **Veo3（動画生成）**: 約100円/秒（8秒動画で約800円）

詳細: [Google AI Studio](https://aistudio.google.com/)

## 開発ロードマップ

- [x] 要件定義
- [x] UIモックアップ作成
- [x] APIテスト環境構築
- [x] 画像生成API連携（nanobanana Pro）
- [x] 動画生成プロキシサーバー構築（Veo3）
- [ ] 動画生成API連携テスト
- [ ] データベース接続（Supabase）
- [ ] DaVinci Resolve連携
