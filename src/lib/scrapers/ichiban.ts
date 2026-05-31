import * as cheerio from 'cheerio';
import { type FeedItem, parseDateTs } from './index';

const BASE  = 'https://1kuji.com';
const PAGE  = `${BASE}/characters/85`;

export async function scrapeIchiban(): Promise<FeedItem[]> {
  const res = await fetch(PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MadokaHub/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ichiban: HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const items: FeedItem[] = [];

  $('#characterProducts .itemList li').each((_, el) => {
    const $el   = $(el);
    const href  = $el.find('a').attr('href') ?? '';
    const img   = $el.find('img').attr('src') ?? undefined;
    const title = $el.find('.itemName').text().trim();
    // 発売日は最初の <p class="date"> を使う
    const date  = $el.find('.date').first().text().trim() || null;

    if (!title || !href) return;

    const url = href.startsWith('http') ? href : BASE + href;

    items.push({
      id:          `ichiban:${href}`,
      source:      'ichiban',
      sourceLabel: '一番くじ',
      sourceUrl:   PAGE,
      title,
      url,
      date,
      dateTs:      parseDateTs(date),
      imageUrl:    img,
    });
  });

  return items;
}
