import * as cheerio from 'cheerio';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs } from './index';

// 日付パターン（日本語サイトで一般的なもの）
const DATE_RE = /(\d{4})[.\-年](\d{1,2})[.\-月](\d{1,2})/;

// ニュース系コンテナによく使われるクラス名
const NEWS_SELECTORS = [
  '.news-list li', '.news_list li', '.newsList li',
  '.topics-list li', '.topics_list li', '.topicsList li',
  '.info-list li', '.info_list li', '.infoList li',
  '.article-list li', '.articleList li',
  'article', '.news-item', '.news_item', '.newsItem',
  '.information li', '.update li',
].join(', ');

export async function scrapeGeneric(
  source: SourceConfig,
  franchise: FranchiseConfig
): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`generic: HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const base = new URL(source.url).origin;
  const items: FeedItem[] = [];
  const seen = new Set<string>();

  $(NEWS_SELECTORS).each((_, el) => {
    const $el = $(el);

    // タイトル候補
    const title = (
      $el.find('h1, h2, h3, h4, .title, .subject').first().text() ||
      $el.find('a').first().text()
    ).trim().replace(/\s+/g, ' ');

    if (!title || title.length < 5 || title.length > 200) return;

    // URL
    const href = $el.find('a').first().attr('href') ?? '';
    if (!href) return;
    const url = href.startsWith('http') ? href : (href.startsWith('/') ? base + href : source.url);

    if (seen.has(url)) return;
    seen.add(url);

    // 日付
    const text = $el.text();
    const dateMatch = text.match(DATE_RE);
    const date = dateMatch
      ? `${dateMatch[1]}年${dateMatch[2]}月${dateMatch[3]}日`
      : null;

    const id = `${franchise.id}:generic:${url}`;
    items.push({
      id,
      source:      source.type,
      sourceLabel: source.label,
      sourceUrl:   source.url,
      title,
      url,
      date,
      dateTs:      parseDateTs(date),
      characters:  detectCharacters(title, franchise.characters),
    });
  });

  return items.slice(0, 30); // 最大30件
}
