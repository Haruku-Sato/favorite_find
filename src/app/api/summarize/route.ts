/**
 * POST /api/summarize
 * body: { url: string; title: string }
 * → { summary, body, ogImage, fields: { price, releaseDate, importance, keywords } }
 *
 * 記事ページを取得して本文を抽出し、Claude で3行要約＋構造化フィールドを生成する。
 * 構造化フィールド（日付・値段・重要度など）は将来の重み付けモデル(NN)の入力に使う。
 */
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { isBotBlock } from '@/lib/scrapers';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' };

export interface SummarizeResult {
  summary: string;          // 3行要約
  body: string;             // 抽出した本文（表示用）
  ogImage?: string;
  blocked?: boolean;        // botブロックで本文取得不可
  summaryError?: boolean;   // Claude 要約に失敗（APIキー未設定など）
  fields: {
    price: string;          // 例「1回800円」/ 空文字
    releaseDate: string;    // 発売日・開催日 / 空文字
    importance: number;     // 0〜1
    keywords: string[];
  };
}

// 簡易キャッシュ（同一URLの再要約を避ける。ウォームインスタンス内で有効）
const cache = new Map<string, SummarizeResult>();

// 記事ページから本文らしきテキストを抽出
function extractBody(html: string): { body: string; ogImage?: string } {
  const $ = cheerio.load(html);
  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    undefined;

  // ノイズ除去
  $('script, style, nav, header, footer, aside, form, iframe').remove();

  // 本文候補：article / main / 記事系コンテナ → なければ body
  const container =
    $('article').first().text() ||
    $('main').first().text() ||
    $('[class*="article" i], [class*="entry" i], [class*="post" i], [class*="news" i], [class*="detail" i]').first().text() ||
    $('body').text();

  const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

  const body = (container || ogDesc)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);

  return { body: body || ogDesc, ogImage };
}

export async function POST(req: Request) {
  const { url, title } = (await req.json()) as { url: string; title: string };
  if (!url) return Response.json({ error: 'url が必要です' }, { status: 400 });

  const cached = cache.get(url);
  if (cached) return Response.json(cached);

  // ── 記事ページ取得 ────────────────────────────────
  let body = '';
  let ogImage: string | undefined;
  let blocked = false;
  try {
    const res = await fetch(url, { headers: UA, next: { revalidate: 86400 } });
    const html = await res.text();
    if (isBotBlock(res.status, html)) {
      blocked = true;
    } else {
      const ex = extractBody(html);
      body = ex.body;
      ogImage = ex.ogImage;
    }
  } catch {
    blocked = true;
  }

  // ── Claude で要約＋構造化抽出 ──────────────────────
  const sourceText = (body || title).slice(0, 4000);
  let result: SummarizeResult = {
    summary: '', body, ogImage, blocked,
    fields: { price: '', releaseDate: '', importance: 0.5, keywords: [] },
  };

  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      tools: [{
        name: 'article_summary',
        description: 'ニュース記事の要約と構造化情報を返す',
        input_schema: {
          type: 'object' as const,
          properties: {
            summary:    { type: 'string', description: '日本語で3行の要約。各行は改行(\\n)で区切り、1行は短めに。' },
            price:      { type: 'string', description: '価格情報があれば（例「1回800円」）。なければ空文字。' },
            releaseDate:{ type: 'string', description: '発売日・開催日など重要な日付があれば（例「2026年6月27日」）。なければ空文字。' },
            importance: { type: 'number', description: 'ファンにとっての重要度を0〜1で。新商品・重要発表ほど高い。' },
            keywords:   { type: 'array', items: { type: 'string' }, description: '重要キーワード最大5個。' },
          },
          required: ['summary', 'price', 'releaseDate', 'importance', 'keywords'],
        },
      }],
      tool_choice: { type: 'tool', name: 'article_summary' },
      messages: [{
        role: 'user',
        content: `次のニュース記事を日本語で要約してください。\n\nタイトル: ${title}\n\n本文:\n${sourceText}`,
      }],
    });

    const toolUse = res.content.find((b) => b.type === 'tool_use');
    if (toolUse?.type === 'tool_use') {
      const o = toolUse.input as Partial<SummarizeResult['fields']> & { summary?: string };
      result = {
        // Claude がリテラルの "\n" を返すことがあるので実際の改行に変換
        summary: (o.summary ?? '').replace(/\\n/g, '\n').trim(),
        body,
        ogImage,
        blocked,
        fields: {
          price:      o.price ?? '',
          releaseDate:o.releaseDate ?? '',
          importance: typeof o.importance === 'number' ? o.importance : 0.5,
          keywords:   Array.isArray(o.keywords) ? o.keywords : [],
        },
      };
    }
  } catch {
    // Claude 失敗（APIキー未設定・レート制限など）→ 本文のみ返しつつフラグを立てる
    result.summaryError = true;
  }

  // ツールは成功したが要約が空、のケースもエラー扱い
  if (!result.summary) result.summaryError = true;

  cache.set(url, result);
  return Response.json(result);
}
