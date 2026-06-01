import * as cheerio from 'cheerio';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs } from './index';

const BASE = 'https://1kuji.com';

// 商品詳細ページの賞品名からキャラを検出
async function fetchProductCharacters(
  href: string,
  franchise: FranchiseConfig
): Promise<string[]> {
  try {
    const res = await fetch(BASE + href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const $ = cheerio.load(await res.text());
    const prizeText = $('.name').map((_, el) => $(el).text()).get().join(' ');
    return detectCharacters(prizeText, franchise.characters);
  } catch {
    return [];
  }
}

// 固定キャラページ（characters/XX 形式）のスクレイパー
export async function scrapeIchiban(
  source: SourceConfig,
  franchise: FranchiseConfig
): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ichiban: HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const basic: { href: string; img?: string; title: string; date: string | null }[] = [];

  $('#characterProducts .itemList li').each((_, el) => {
    const $el   = $(el);
    const href  = $el.find('a').attr('href') ?? '';
    const img   = $el.find('img').attr('src') ?? undefined;
    const title = $el.find('.itemName').text().trim();
    const date  = $el.find('.date').first().text().trim() || null;
    if (title && href) basic.push({ href, img, title, date });
  });

  return Promise.all(
    basic.map(async ({ href, img, title, date }) => ({
      id:          `${franchise.id}:ichiban:${href}`,
      source:      'ichiban',
      sourceLabel: source.label,
      sourceUrl:   source.url,
      title,
      url:         href.startsWith('http') ? href : BASE + href,
      date,
      dateTs:      parseDateTs(date),
      imageUrl:    img,
      characters:  await fetchProductCharacters(href, franchise),
    }))
  );
}
