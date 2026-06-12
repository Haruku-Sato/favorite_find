import * as cheerio from 'cheerio';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs, isBotBlock, noticeItem } from './index';

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

  const html = await res.text();

  // botブロック（Cloudflare等）はここで打ち切って通知を返す
  if (isBotBlock(res.status, html)) return [noticeItem(source, franchise, 'bot-blocked')];
  if (!res.ok) throw new Error(`official: HTTP ${res.status}`);

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

  if (items.length > 0) return items;

  // ── A) RSS 自動検出 ─────────────────────────────────────
  // <link rel="alternate" type="application/rss+xml"> 等があれば RSS を使う
  const feedHref =
    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').first().attr('href');
  if (feedHref) {
    try {
      const feedUrl = new URL(feedHref, source.url).href;
      const { scrapeRss } = await import('./rss');
      const rssItems = await scrapeRss({ ...source, type: 'rss', url: feedUrl }, franchise);
      if (rssItems.length > 0) return rssItems;
    } catch { /* RSS 失敗時は generic へ */ }
  }

  // ── B) WordPress REST API 自動検出（JSで動的に記事を読むサイト向け） ──
  try {
    const { scrapeWordpress } = await import('./wordpress');
    const wpItems = await scrapeWordpress(source, franchise, html);
    if (wpItems && wpItems.length > 0) return wpItems;
  } catch { /* 失敗時は generic へ */ }

  // ── 汎用スクレイパー（トップページ） ──
  const { scrapeGeneric } = await import('./generic');
  const homeItems = await scrapeGeneric(source, franchise);
  if (homeItems.length > 0) return homeItems;

  // ── C) NEWS ページを辿る（トップにニュースが無いサイト向け） ──
  // 例: チェンソーマン公式はトップに記事が無く /news/ に分かれている
  for (const newsUrl of findNewsPages($, source.url)) {
    try {
      const it = await scrapeGeneric({ ...source, url: newsUrl }, franchise);
      if (it.length > 0) return it;
    } catch { /* 次の候補へ */ }
  }

  return homeItems; // 空
}

// トップページから「ニュース一覧ページ」候補URLを集める
function findNewsPages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const NEWS_RE = /news|topics|お知らせ|新着|information|infomation/i;
  const urls = new Set<string>();
  const origin = (() => { try { return new URL(baseUrl).origin; } catch { return ''; } })();

  // 1) href か リンクテキストが news 系のアンカー（javascript:/# は除外）
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text();
    if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) return;
    if (!NEWS_RE.test(href) && !NEWS_RE.test(text)) return;
    try {
      const u = new URL(href, baseUrl).href;
      if (u.replace(/#.*$/, '') !== baseUrl.replace(/#.*$/, '')) urls.add(u);
    } catch { /* skip */ }
  });

  // 2) よくあるパスを推測で追加（NEWSリンクが javascript: の場合の保険）
  for (const p of ['news/', 'topics/', 'information/']) {
    try { urls.add(new URL(p, baseUrl).href); } catch { /* skip */ }
    if (origin) urls.add(`${origin}/${p}`);
  }

  return [...urls].slice(0, 5);
}
