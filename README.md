# FavoriteFind

好きなアニメ作品の **最新情報（公式ニュース・一番くじ・コラボなど）をまとめて表示** する Web アプリです。
作品名を入力するだけで、公式サイト・一番くじ・コラボ情報などを自動収集してフィード表示します。

🔗 デモ: https://favorite-find.vercel.app

## 主な機能

- **作品検索 & 追加** — MyAnimeList（Jikan API）で作品をサジェスト。シーズン・劇場版は1作品に集約して表示
- **情報の自動収集** — 登録した作品の最新情報を複数ソースから取得
- **カードUI** — 2列のカードグリッドで一覧表示（画像・見出し付き）
- **Claude による要約** — カードを開くと記事を取得して Claude が3行に要約。本文は有料記事風にフェード表示し、「続きをサイトで読む」で元記事へ
- **構造化抽出** — 要約と同時に日付・価格・重要度などを抽出（将来の重み付けモデルの入力に利用予定）
- **カテゴリ別表示** — 公式 / ゲームセンター / 一番くじ / コラボ のタブで絞り込み
- **キャラクター別フィルター** — Wikipedia から抽出したキャラ名で記事を絞り込み
- **未読管理** — 新着に NEW バッジ、既読管理
- **ダーク / ライトモード**

## 情報の取得方式

サイトごとに最適な方法を、確実な順にフォールバックして取得します。

1. **専用セレクタ**（既知サイト）
2. **RSS 自動検出** — `<link rel="alternate" type="application/rss+xml">` を検出
3. **WordPress REST API** — ページ内/外部JSから `wp-json` エンドポイントを検出（動的サイト対応）
4. **汎用ヒューリスティック** — 「日付＋リンクを含む繰り返し要素」（`li` / `article` / `dl` / `table` 等）をニュースとみなして抽出

- bot ブロック（Cloudflare 等）を検出した場合は、その旨を表示してサイトへの導線を提示します。
- 一番くじ検索は記号（★/☆）ゆらぎを正規化して再検索します。

## 技術スタック

- **Next.js 16** (App Router) / React 19 / TypeScript
- **cheerio** — HTML スクレイピング
- **rss-parser** — RSS/Atom パース
- **Anthropic Claude API** — キャラクター/Wikipedia 情報の補完
- 外部 API: Jikan (MyAnimeList), Brave Search

## セットアップ

```bash
npm install
npm run dev
```

http://localhost:3000 で起動します。

### 環境変数

`.env.local` に以下を設定してください（作品追加時の情報補完・検索に使用）:

```
ANTHROPIC_API_KEY=...
BRAVE_SEARCH_API_KEY=...
```

> スクレイピング（記事取得）自体は API キー不要で動作します。作品追加時のキャラ抽出・ゲームセンター候補検索で上記キーを使用します。

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                  # メイン画面（タブ・状態管理）
│   └── api/
│       ├── franchise/
│       │   ├── setup/route.ts    # 作品セットアップ（Jikan/Claude/Brave）
│       │   └── scrape/route.ts   # 情報取得
│       └── summarize/route.ts    # 記事要約＋構造化抽出（Claude）
├── components/
│   ├── Feed.tsx                  # フィード表示（カードグリッド）
│   ├── ArticleCard.tsx           # 記事カード（クリックで要約展開）
│   └── AddFranchiseModal.tsx     # 作品追加モーダル
└── lib/
    ├── franchise.ts              # 型定義・localStorage 操作
    ├── theme-context.tsx         # テーマ
    └── scrapers/                 # 各種スクレイパー
        ├── index.ts              # スクレイパー選択・集約・日付処理
        ├── official.ts           # 公式（RSS/WordPress/generic にフォールバック）
        ├── rss.ts                # RSS/Atom
        ├── wordpress.ts          # WordPress REST API
        ├── ichiban.ts / ichibanSearch.ts  # 一番くじ
        └── generic.ts            # 汎用ヒューリスティック
```

## 今後の構想（重要度の重み付け）

要約・抽出は Claude が担当し、その出力（日付・価格・カテゴリ・重要度など）を入力として、
**軽量な重み付けモデルでフィードの優先順位を学習する**ことを構想しています。

```
Claude（要約・構造化抽出） → 特徴量 → 重み付けモデル → 重要度スコア → 並び替え/ハイライト
                                              ↑ ユーザーのクリック等を教師信号に学習
```

ルールベース → 線形モデル → 小さなニューラルネット、と段階的に育てる方針です。

## デプロイ

[Vercel](https://vercel.com) にデプロイしています（https://favorite-find.vercel.app）。
環境変数を設定すれば任意の Vercel プロジェクトでも動作します。
