import * as cheerio from 'cheerio';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs, isBotBlock, noticeItem } from './index';

// 日付パターン（区切り . - / 年月 と前後空白を許容）
const DATE_RE = /(\d{4})\s*[.\-/年]\s*(\d{1,2})\s*[.\-/月]\s*(\d{1,2})/;

// ニュース系コンテナによく使われるクラス名
const NEWS_SELECTORS = [
  '.news-list li', '.news_list li', '.newsList li',
  '.topics-list li', '.topics_list li', '.topicsList li',
  '.info-list li', '.info_list li', '.infoList li',
  '.article-list li', '.articleList li',
  'article', '.news-item', '.news_item', '.newsItem',
  '.information li', '.update li',
].join(', ');

// ヒューリスティック用: タイトル／日付らしき要素
const TITLE_SEL = 'h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="ttl" i],[class*="subject" i]';
const DATE_SEL  = 'time,[class*="date" i]';

export async function scrapeGeneric(
  source: SourceConfig,
  franchise: FranchiseConfig
): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
    next: { revalidate: 3600 },
  });
  const rawHtml = await res.text();
  if (isBotBlock(res.status, rawHtml)) return [noticeItem(source, franchise, 'bot-blocked')];
  if (!res.ok) throw new Error(`generic: HTTP ${res.status}`);

  const $ = cheerio.load(rawHtml);
  const items: FeedItem[] = [];
  const seen = new Set<string>();

  // 要素内の最初の画像URL（src / data-src 等のlazy属性も拾う）を絶対URL化
  const imgOf = ($el: ReturnType<typeof $>): string | undefined => {
    const $img = $el.find('img').first();
    const raw = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src');
    if (!raw || raw.startsWith('data:')) return undefined;
    try { return new URL(raw, source.url).href; } catch { return undefined; }
  };

  // 1件分を items に追加する共通処理
  const push = (rawTitle: string, href: string, dateText: string, img?: string) => {
    const title = rawTitle.trim().replace(/\s+/g, ' ');
    if (!title || title.length < 5 || title.length > 200 || !href) return;

    // href をページURL基準で絶対URL化（相対・スラッシュ有無を吸収）
    let url: string;
    try { url = new URL(href, source.url).href; } catch { return; }

    if (seen.has(url)) return;
    seen.add(url);

    const dateMatch = dateText.match(DATE_RE);
    const date = dateMatch
      ? `${dateMatch[1]}年${Number(dateMatch[2])}月${Number(dateMatch[3])}日`
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
      imageUrl:    img,
      characters:  detectCharacters(title, franchise.characters),
    });
  };

  // ── パターンA: li / article 系コンテナ ──
  $(NEWS_SELECTORS).each((_, el) => {
    const $el   = $(el);
    const title =
      $el.find('h1, h2, h3, h4, .title, .subject').first().text() ||
      $el.find('a').first().text();
    push(title, $el.find('a').first().attr('href') ?? '', $el.text(), imgOf($el));
  });

  // ── パターンB: dl/dt/dd 形式（日本のアニメ公式に多い） ──
  if (items.length === 0) {
    $('dl').each((_, dl) => {
      $(dl).children('dd').each((_, dd) => {
        const $dd  = $(dd);
        const $a   = $dd.find('a').first();
        const date = $dd.prevAll('dt').first().text();
        const title = ($dd.find('.title').first().text() || $a.text());
        push(title, $a.attr('href') ?? '', date + ' ' + $dd.text(), imgOf($dd));
      });
    });
  }

  // ── パターンC: ヒューリスティック（リンク＋日付を含む繰り返し要素） ──
  // サイト固有クラスに依存せず、「日付を持つリンク項目」をニュースとみなす。
  // ナビ等の誤検出を避けるため日付の存在を必須にする。
  if (items.length === 0) {
    $('li, article, dd, tr').each((_, el) => {
      const $el = $(el);
      const $a  = $el.find('a[href]').first();
      if (!$a.length) return;

      // 日付: <time datetime> / .date 系 / 本文中の日付パターン
      const $date = $el.find(DATE_SEL).first();
      const dateText = $date.attr('datetime') || $date.text() || ($el.text().match(DATE_RE)?.[0] ?? '');
      if (!DATE_RE.test(dateText) && !/\d{4}-\d{2}-\d{2}/.test(dateText)) return;

      // タイトル: title/ttl/見出し系 → リンクテキスト → 日付を除いた本文
      let title = $el.find(TITLE_SEL).first().text().trim();
      if (!title) title = $a.text().trim();
      if (!title) title = $el.clone().find(DATE_SEL).remove().end().text().trim();

      push(title, $a.attr('href') ?? '', dateText, imgOf($el));
    });
  }

  return items.slice(0, 30); // 最大30件
}
