import * as cheerio from 'cheerio';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs } from './index';

const BASE = 'https://1kuji.com';

// 1件分の検索URLを叩いて商品リストを返す
async function fetchSearch(
  word: string,
  source: SourceConfig,
  franchise: FranchiseConfig,
): Promise<FeedItem[]> {
  const url = `${BASE}/products/search?word=${encodeURIComponent(word)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const $ = cheerio.load(await res.text());
  const items: FeedItem[] = [];

  $('.productList li, .itemList li').each((_, el) => {
    const $el   = $(el);
    const href  = $el.find('a').attr('href') ?? '';
    const img   = $el.find('img').attr('src') ?? undefined;
    const title = $el.find('.itemName, .productName, h3, h4').first().text().trim();
    const date  = $el.find('.date').first().text().trim() || null;

    if (!title || !href) return;

    items.push({
      id:             `${franchise.id}:ichiban-search:${href}`,
      source:         'ichiban',
      sourceLabel:    source.label,
      sourceUrl:      source.url,
      sourceCategory: source.category,
      title,
      url:            href.startsWith('http') ? href : BASE + href,
      date,
      dateTs:         parseDateTs(date),
      imageUrl:       img,
      characters:     detectCharacters(title, franchise.characters),
    });
  });

  return items;
}

// 元URLの word から、ヒットしやすい候補クエリを順に生成
function candidateWords(rawWord: string): string[] {
  const cands: string[] = [];
  const add = (w: string) => { const t = w.trim(); if (t && !cands.includes(t)) cands.push(t); };

  add(rawWord);
  add(rawWord.replace(/★/g, '☆'));               // 黒星→白星（商品名は☆が多い）
  add(rawWord.replace(/[★☆].*$/, ''));            // 星以降を切り落とし（例: 魔法少女まどか）
  add(rawWord.replace(/[★☆\s　]/g, ''));          // 星・空白を除去
  return cands;
}

// キーワード検索結果ページ（0件なら正規化ワードで再検索）
export async function scrapeIchibanSearch(
  source: SourceConfig,
  franchise: FranchiseConfig
): Promise<FeedItem[]> {
  // 元URLから word パラメータを取り出す
  let rawWord = franchise.searchName ?? franchise.name ?? '';
  try { rawWord = new URL(source.url).searchParams.get('word') || rawWord; } catch { /* keep */ }

  for (const word of candidateWords(rawWord)) {
    const items = await fetchSearch(word, source, franchise);
    if (items.length > 0) return items;
  }
  return [];
}
