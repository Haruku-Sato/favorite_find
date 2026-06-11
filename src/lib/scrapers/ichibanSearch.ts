import * as cheerio from 'cheerio';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs } from './index';

const BASE = 'https://1kuji.com';

// キーワード検索結果ページ（新規フランチャイズ用）
export async function scrapeIchibanSearch(
  source: SourceConfig,
  franchise: FranchiseConfig
): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ichiban-search: HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const items: FeedItem[] = [];

  // 検索結果の商品リスト（一番くじ検索ページの構造）
  $('.productList li, .itemList li').each((_, el) => {
    const $el   = $(el);
    const href  = $el.find('a').attr('href') ?? '';
    const img   = $el.find('img').attr('src') ?? undefined;
    const title = $el.find('.itemName, .productName, h3, h4').first().text().trim();
    const date  = $el.find('.date').first().text().trim() || null;

    if (!title || !href) return;

    const url = href.startsWith('http') ? href : BASE + href;
    items.push({
      id:          `${franchise.id}:ichiban-search:${href}`,
      source:         'ichiban',
      sourceLabel:    source.label,
      sourceUrl:      source.url,
      sourceCategory: source.category,
      title,
      url,
      date,
      dateTs:      parseDateTs(date),
      imageUrl:    img,
      characters:  detectCharacters(title, franchise.characters),
    });
  });

  return items;
}
