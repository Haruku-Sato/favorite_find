/**
 * POST /api/franchise/scrape
 * body: { franchise: FranchiseConfig }
 * → FeedItem[]
 */
import { scrapeAll } from '@/lib/scrapers';
import type { FranchiseConfig } from '@/lib/franchise';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { franchise } = await req.json() as { franchise: FranchiseConfig };
  if (!franchise) {
    return Response.json({ error: 'franchise が必要です' }, { status: 400 });
  }
  const items = await scrapeAll(franchise);
  return Response.json(items);
}
