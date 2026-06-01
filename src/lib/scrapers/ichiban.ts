import * as cheerio from 'cheerio';
import { type FeedItem, parseDateTs, detectCharacters } from './index';

const BASE  = 'https://1kuji.com';
const PAGE  = `${BASE}/characters/85`;

// 商品詳細ページから登場キャラを取得（賞品名で判定）
async function fetchCharacters(href: string): Promise<string[]> {
  try {
    const res = await fetch(BASE + href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MadokaHub/1.0)' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const $ = cheerio.load(await res.text());

    // 賞品名（.name クラス）をすべて結合してキャラ検出
    const prizeText = $('.name').map((_, el) => $(el).text()).get().join(' ');
    return detectCharacters(prizeText);
  } catch {
    return [];
  }
}

export async function scrapeIchiban(): Promise<FeedItem[]> {
  const res = await fetch(PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MadokaHub/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ichiban: HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());

  // まず一覧ページの基本情報を収集
  const basic: { href: string; img?: string; title: string; date: string | null }[] = [];
  $('#characterProducts .itemList li').each((_, el) => {
    const $el   = $(el);
    const href  = $el.find('a').attr('href') ?? '';
    const img   = $el.find('img').attr('src') ?? undefined;
    const title = $el.find('.itemName').text().trim();
    const date  = $el.find('.date').first().text().trim() || null;
    if (title && href) basic.push({ href, img, title, date });
  });

  // 各商品の詳細ページを並列取得してキャラ情報を付与
  const items: FeedItem[] = await Promise.all(
    basic.map(async ({ href, img, title, date }) => {
      const characters = await fetchCharacters(href);
      return {
        id:          `ichiban:${href}`,
        source:      'ichiban',
        sourceLabel: '一番くじ',
        sourceUrl:   PAGE,
        title,
        url:         href.startsWith('http') ? href : BASE + href,
        date,
        dateTs:      parseDateTs(date),
        imageUrl:    img,
        characters,
      };
    })
  );

  return items;
}
