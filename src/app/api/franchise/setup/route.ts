/**
 * POST /api/franchise/setup
 * body: { name: string }
 *
 * Brave Search で公式サイト・一番くじページを探し、
 * Wikipedia からキャラ名を抽出して FranchiseConfig の雛形を返す。
 */
import { braveSearch } from '@/lib/brave';
import { detectCharactersFromWikipedia } from '@/lib/wikiCharacters';
import type { FranchiseConfig, SourceConfig, CharacterDef } from '@/lib/franchise';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { name } = await req.json() as { name: string };
  if (!name?.trim()) {
    return Response.json({ error: '作品名を入力してください' }, { status: 400 });
  }

  const [officialResults, ichibanResults, wikiResults] = await Promise.allSettled([
    braveSearch(`${name} 公式サイト アニメ OR ゲーム`, 3),
    braveSearch(`${name} site:1kuji.com`, 3),
    braveSearch(`${name} site:ja.wikipedia.org`, 2),
  ]);

  const sources: SourceConfig[] = [];

  // ── 公式サイト ─────────────────────────────────────────
  if (officialResults.status === 'fulfilled') {
    const official = officialResults.value.find((r) =>
      // CDN・SNS・Wikipedia・wikia を除外して最初の結果を使う
      !/(twitter|x\.com|wikipedia|wikia|fandom|amazon|youtube|niconico)/i.test(r.url)
    );
    if (official) {
      sources.push({ type: 'official', label: '公式', url: official.url });
    }
  }

  // ── 一番くじ ────────────────────────────────────────────
  if (ichibanResults.status === 'fulfilled') {
    const kuji = ichibanResults.value.find((r) => r.url.includes('1kuji.com'));
    if (kuji) {
      // characters/ ページなら ichiban、それ以外は ichiban-search
      const type = kuji.url.includes('/characters/') ? 'ichiban' : 'ichiban-search';
      sources.push({ type, label: '一番くじ', url: kuji.url });
    } else {
      // キーワード検索 URL を自動生成
      const searchUrl = `https://1kuji.com/products/search?word=${encodeURIComponent(name)}`;
      sources.push({ type: 'ichiban-search', label: '一番くじ', url: searchUrl });
    }
  }

  // ── キャラクター（Wikipedia から抽出） ───────────────────
  let characters: CharacterDef[] = [];
  if (wikiResults.status === 'fulfilled') {
    const wikiUrl = wikiResults.value.find((r) => r.url.includes('ja.wikipedia.org'))?.url;
    if (wikiUrl) {
      characters = await detectCharactersFromWikipedia(wikiUrl);
    }
  }

  const id = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '') + '-' + Date.now();

  const config: FranchiseConfig = {
    id,
    name:       name.trim(),
    searchName: name.trim(),
    characters,
    sources,
    createdAt:  new Date().toISOString(),
  };

  return Response.json(config);
}
