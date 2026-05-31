import { scrapeAll } from '@/lib/scrapers';

// 手動更新ボタン用：キャッシュなしで最新を取得
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await scrapeAll();
  return Response.json(items);
}
