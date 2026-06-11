import * as cheerio from 'cheerio';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs } from './index';

// madoka-magica.com の固有セレクタ（他の公式サイトは generic.ts にフォールバック）
const MADOKA_BASE = 'https://www.madoka-magica.com';

export async function scrapeOfficial(
  source: SourceConfig,
  franchise: FranchiseConfig
): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`official: HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // まどマギ公式専用セレクタ
  const items: FeedItem[] = [];
  $('.p-info_news__list-item').each((_, el) => {
    const $a    = $(el).find('a.p-info_news_article');
    const href  = $a.attr('href') ?? '';
    const date  = $a.find('.p-info_news_article__date').text().trim() || null;
    const title = $a.find('.p-info_news_article__title').text().trim();
    const cat   = $a.find('.p-info_news_article__category-badge').text().trim() || undefined;

    if (!title || !href) return;

    const base = new URL(source.url).origin;
    const url  = href.startsWith('http') ? href : base + href;
    const text = title + ' ' + (cat ?? '');

    items.push({
      id:             `${franchise.id}:official:${href}`,
      source:         'official',
      sourceLabel:    source.label,
      sourceUrl:      source.url,
      sourceCategory: source.category,
      title, url, date,
      dateTs:      parseDateTs(date),
      category:    cat,
      characters:  detectCharacters(text, franchise.characters),
    });
  });

  // セレクタがマッチしなかった場合は generic にフォールバック
  if (items.length === 0) {
    const { scrapeGeneric } = await import('./generic');
    return scrapeGeneric(source, franchise);
  }

  return items;
}
