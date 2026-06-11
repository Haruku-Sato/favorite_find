import type { FranchiseConfig, SourceConfig, SourceCategory } from '@/lib/franchise';
import { detectCharacters } from '@/lib/franchise';

// ── FeedItem（汎用） ─────────────────────────────────────

export interface FeedItem {
  id: string;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceCategory: SourceCategory;
  title: string;
  url: string;
  date: string | null;
  dateTs: number;
  category?: string;
  imageUrl?: string;
  characters: string[];  // 該当キャラ名のリスト（[] = 全体共通）
}

// ── 日付パース ────────────────────────────────────────────

export function parseDateTs(raw: string | null): number {
  if (!raw) return 0;
  const dot = raw.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (dot) return new Date(`${dot[1]}-${dot[2]}-${dot[3]}`).getTime();
  const jp = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (jp) return new Date(`${jp[1]}-${jp[2].padStart(2,'0')}-${jp[3].padStart(2,'0')}`).getTime();
  const jpMon = raw.match(/(\d{4})年(\d{1,2})月/);
  if (jpMon) return new Date(`${jpMon[1]}-${jpMon[2].padStart(2,'0')}-01`).getTime();
  return 0;
}

// ── スクレイパー選択 ──────────────────────────────────────

import { scrapeOfficial }     from './official';
import { scrapeIchiban }      from './ichiban';
import { scrapeIchibanSearch } from './ichibanSearch';
import { scrapeGeneric }      from './generic';
import { scrapeRss }          from './rss';

async function scrapeSource(
  source: SourceConfig,
  franchise: FranchiseConfig
): Promise<FeedItem[]> {
  switch (source.type) {
    case 'official':
      return scrapeOfficial(source, franchise);
    case 'ichiban':
      return scrapeIchiban(source, franchise);
    case 'ichiban-search':
      return scrapeIchibanSearch(source, franchise);
    case 'rss':
      return scrapeRss(source, franchise);
    case 'generic':
    default:
      return scrapeGeneric(source, franchise);
  }
}

export async function scrapeAll(franchise: FranchiseConfig): Promise<FeedItem[]> {
  const results = await Promise.allSettled(
    franchise.sources.map((src) => scrapeSource(src, franchise))
  );

  const seen = new Set<string>();
  const items = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

  return items.sort((a, b) => b.dateTs - a.dateTs);
}

// detectCharacters を再エクスポート（後方互換）
export { detectCharacters };
