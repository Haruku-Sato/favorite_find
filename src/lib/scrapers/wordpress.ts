import * as cheerio from 'cheerio';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs } from './index';

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' };

// WordPress REST API のベースURL（.../wp-json/）を探す
async function findWpJsonBase(html: string, pageUrl: string): Promise<string | null> {
  const $ = cheerio.load(html);

  // 1) <link rel="https://api.w.org/" href=".../wp-json/">
  const apiLink = $('link[rel="https://api.w.org/"]').attr('href');
  if (apiLink) return new URL(apiLink, pageUrl).href;

  // 2) HTML 本文中の wp-json URL
  const inline = html.match(/https?:\/\/[\w.\-]+\/wp-json\//);
  if (inline) return inline[0];

  // 3) リンクされた JS ファイルを走査（config/common 系に埋まっていることが多い）
  const scripts = $('script[src]')
    .map((_, el) => $(el).attr('src') ?? '')
    .get()
    .filter(Boolean)
    .map((src) => { try { return new URL(src, pageUrl).href; } catch { return ''; } })
    .filter((u) => u && new URL(u).hostname === new URL(pageUrl).hostname) // 同一ホストのみ
    .slice(0, 8);

  for (const js of scripts) {
    try {
      const text = await fetch(js, { headers: UA, next: { revalidate: 3600 } }).then((r) => r.text());
      const m = text.match(/https?:\/\/[\w.\-]+\/wp-json\//);
      if (m) return m[0];
    } catch { /* skip */ }
  }

  return null;
}

interface WpPost {
  id: number;
  date: string;
  link: string;
  title?: { rendered?: string };
}

/** WordPress REST API から記事を取得。検出できなければ null を返す */
export async function scrapeWordpress(
  source: SourceConfig,
  franchise: FranchiseConfig,
  html: string,
): Promise<FeedItem[] | null> {
  const base = await findWpJsonBase(html, source.url);
  if (!base) return null;

  const endpoint = `${base}wp/v2/posts?per_page=20&_fields=id,date,title,link`;
  let posts: WpPost[];
  try {
    const res = await fetch(endpoint, { headers: UA, next: { revalidate: 3600 } });
    if (!res.ok) return null;
    posts = await res.json();
  } catch {
    return null;
  }
  if (!Array.isArray(posts) || posts.length === 0) return null;

  return posts.map((p) => {
    const title = cheerio.load(p.title?.rendered ?? '').text().trim();
    const date = p.date
      ? new Date(p.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;
    return {
      id:             `${franchise.id}:wp:${p.id}`,
      source:         'official',
      sourceLabel:    source.label,
      sourceUrl:      source.url,
      sourceCategory: source.category,
      title,
      url:            p.link,
      date,
      dateTs:         p.date ? new Date(p.date).getTime() : parseDateTs(date),
      characters:     detectCharacters(title, franchise.characters),
    } satisfies FeedItem;
  }).filter((item) => item.title.length > 0);
}
