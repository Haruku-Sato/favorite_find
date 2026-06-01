// 旧エンドポイント → /api/franchise/scrape に移行済み
// まどマギ固定で後方互換のために残す
import { scrapeAll } from '@/lib/scrapers';
import { MADOKA_DEFAULT } from '@/lib/franchise';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await scrapeAll(MADOKA_DEFAULT);
  return Response.json(items);
}
