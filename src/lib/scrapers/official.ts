import * as cheerio from 'cheerio';
import { type FeedItem, parseDateTs } from './index';

const BASE = 'https://www.madoka-magica.com';

export async function scrapeOfficial(): Promise<FeedItem[]> {
  const res = await fetch(BASE + '/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MadokaHub/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`official: HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const items: FeedItem[] = [];

  $('.p-info_news__list-item').each((_, el) => {
    const $a    = $(el).find('a.p-info_news_article');
    const href  = $a.attr('href') ?? '';
    const date  = $a.find('.p-info_news_article__date').text().trim() || null;
    const title = $a.find('.p-info_news_article__title').text().trim();
    const cat   = $a.find('.p-info_news_article__category-badge').text().trim() || undefined;

    if (!title || !href) return;

    const url = href.startsWith('http') ? href : BASE + href;

    items.push({
      id:          `official:${href}`,
      source:      'official',
      sourceLabel: '公式',
      sourceUrl:   BASE,
      title,
      url,
      date,
      dateTs:      parseDateTs(date),
      category:    cat,
    });
  });

  return items;
}
