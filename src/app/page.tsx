import { scrapeAll } from '@/lib/scrapers';
import Feed from '@/components/Feed';

// 1時間ごとに再検証（ISR）
export const revalidate = 3600;

export default async function Page() {
  const items = await scrapeAll();
  return <Feed initialItems={items} />;
}
