export interface FeedItem {
  id: string;
  source: string;        // 'official' | 'ichiban' | ...
  sourceLabel: string;   // 表示名
  sourceUrl: string;     // ソースのトップURL
  title: string;
  url: string;
  date: string | null;   // "2026.04.30" など生の文字列
  dateTs: number;        // ソート用タイムスタンプ (ms)
  category?: string;
  imageUrl?: string;
}

// 日付文字列 → タイムスタンプ（ソート用）
export function parseDateTs(raw: string | null): number {
  if (!raw) return 0;
  // "2026.04.30"
  const dot = raw.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (dot) return new Date(`${dot[1]}-${dot[2]}-${dot[3]}`).getTime();
  // "2023年10月07日"
  const jp = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (jp) return new Date(`${jp[1]}-${jp[2].padStart(2,'0')}-${jp[3].padStart(2,'0')}`).getTime();
  // "2023年10月" (月だけ)
  const jpMon = raw.match(/(\d{4})年(\d{1,2})月/);
  if (jpMon) return new Date(`${jpMon[1]}-${jpMon[2].padStart(2,'0')}-01`).getTime();
  return 0;
}

// ── ソース定義（新ソースはここに追加） ─────────────────
import { scrapeOfficial } from './official';
import { scrapeIchiban } from './ichiban';

type Scraper = () => Promise<FeedItem[]>;

export const SCRAPERS: Record<string, Scraper> = {
  official: scrapeOfficial,
  ichiban:  scrapeIchiban,
};

export async function scrapeAll(): Promise<FeedItem[]> {
  const results = await Promise.allSettled(
    Object.values(SCRAPERS).map((fn) => fn())
  );

  const items: FeedItem[] = results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : []
  );

  // 日付降順ソート
  return items.sort((a, b) => b.dateTs - a.dateTs);
}
