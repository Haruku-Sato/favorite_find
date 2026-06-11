import Parser from 'rss-parser';
import type { FranchiseConfig, SourceConfig } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';
import { type FeedItem, parseDateTs } from './index';

const parser = new Parser({ timeout: 10000 });

export async function scrapeRss(
  source: SourceConfig,
  franchise: FranchiseConfig
): Promise<FeedItem[]> {
  const feed = await parser.parseURL(source.url);

  const kws = source.keywords?.map((k) => k.toLowerCase()) ?? [];

  return (feed.items ?? [])
    .filter((item) => {
      if (kws.length === 0) return true;
      const text = ((item.title ?? '') + ' ' + (item.contentSnippet ?? '')).toLowerCase();
      return kws.every((kw) => text.includes(kw));
    })
    .slice(0, 30).map((item) => {
    const title = item.title?.trim() ?? '';
    const url   = item.link  ?? source.url;
    const raw   = item.pubDate ?? item.isoDate ?? null;
    const date  = raw ? new Date(raw).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
    }) : null;
    const text  = title + ' ' + (item.contentSnippet ?? '');

    return {
      id:          `${franchise.id}:rss:${url}`,
      source:         'rss',
      sourceLabel:    source.label,
      sourceUrl:      source.url,
      sourceCategory: source.category,
      title,
      url,
      date,
      dateTs:      raw ? new Date(raw).getTime() : parseDateTs(date),
      characters:  detectCharacters(text, franchise.characters),
    } satisfies FeedItem;
  }).filter((item) => item.title.length >= 5);
}
