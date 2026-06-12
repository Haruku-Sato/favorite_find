/**
 * GET /api/ogimage?url=...
 * → { image: string | null }
 *
 * 記事ページの og:image を取得する軽量エンドポイント（Claude は呼ばない）。
 * カードに最初から画像を出すための補完用。
 */
import * as cheerio from 'cheerio';
import { isBotBlock } from '@/lib/scrapers';

export const dynamic = 'force-dynamic';

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' };
const cache = new Map<string, string | null>();

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return Response.json({ image: null });

  if (cache.has(url)) return Response.json({ image: cache.get(url) });

  let image: string | null = null;
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } });
    const html = await res.text();
    if (!isBotBlock(res.status, html)) {
      const $ = cheerio.load(html);
      const raw =
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content');
      if (raw) {
        try { image = new URL(raw, url).href; } catch { image = null; }
      }
    }
  } catch { /* ignore */ }

  cache.set(url, image);
  return Response.json({ image });
}
