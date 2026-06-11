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
  const items: FeedItem[] = [];
  const seen = new Set<string>();

  // 1件分を items に追加する共通処理
  const push = (rawTitle: string, href: string, dateText: string) => {
    const title = rawTitle.trim().replace(/\s+/g, ' ');
    if (!title || title.length < 5 || title.length > 200 || !href) return;

    // href をページURL基準で絶対URL化（相対・スラッシュ有無を吸収）
    let url: string;
    try { url = new URL(href, source.url).href; } catch { return; }

    if (seen.has(url)) return;
    seen.add(url);

    const dateMatch = dateText.match(DATE_RE);
    const date = dateMatch
      ? `${dateMatch[1]}年${dateMatch[2]}月${dateMatch[3]}日`
      : null;

    items.push({
      id:             `${franchise.id}:generic:${url}`,
      source:         source.type,
      sourceLabel:    source.label,
      sourceUrl:      source.url,
      sourceCategory: source.category,
      title,
      url,
      date,
      dateTs:      parseDateTs(date),
      characters:  detectCharacters(title, franchise.characters),
    });
  };

  // ── パターンA: li / article 系コンテナ ──
  $(NEWS_SELECTORS).each((_, el) => {
    const $el   = $(el);
    const title =
      $el.find('h1, h2, h3, h4, .title, .subject').first().text() ||
      $el.find('a').first().text();
    push(title, $el.find('a').first().attr('href') ?? '', $el.text());
  });

  // ── パターンB: dl/dt/dd 形式（日本のアニメ公式に多い） ──
  if (items.length === 0) {
    $('dl').each((_, dl) => {
      $(dl).children('dd').each((_, dd) => {
        const $dd  = $(dd);
        const $a   = $dd.find('a').first();
        const date = $dd.prevAll('dt').first().text();
        const title = ($dd.find('.title').first().text() || $a.text());
        push(title, $a.attr('href') ?? '', date + ' ' + $dd.text());
      });
    });
  }

  return items.slice(0, 30); // 最大30件
}
