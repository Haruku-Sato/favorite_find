/**
 * POST /api/franchise/setup
 * body: { name: string; malId?: number }
 *
 * malId が渡された場合は Jikan API (MyAnimeList) から
 *   - 公式サイト URL (/external)
 *   - 関連作品ディレクトリ (/relations)
 * を取得する。
 * キャラクターは Wikipedia から抽出し、取れなければ Claude にフォールバック。
 */
import Anthropic from '@anthropic-ai/sdk';
import { detectCharactersFromWikipedia } from '@/lib/wikiCharacters';
import type { FranchiseConfig, FranchiseEntry, SourceConfig, CharacterDef } from '@/lib/franchise';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Jikan レスポンスの型（使う部分だけ）
interface JikanExternal { name: string; url: string; }
interface JikanRelEntry { mal_id: number; type: string; name: string; }
interface JikanRelation { relation: string; entry: JikanRelEntry[]; }

/** MyAnimeList の type 文字列を日本語ラベルに変換 */
function typeLabel(t: string): string {
  const map: Record<string, string> = {
    TV: 'TVアニメ', Movie: '劇場版', OVA: 'OVA',
    ONA: 'ONA', Special: 'スペシャル',
  };
  return map[t] ?? t;
}

/** 関連作品の relation 文字列を含むかチェック */
const INCLUDE_RELATIONS = new Set([
  'Sequel', 'Prequel', 'Alternative version', 'Side story',
  'Summary', 'Spin-off', 'Parent story',
]);

export async function POST(req: Request) {
  const { name, malId } = await req.json() as { name: string; malId?: number };
  if (!name?.trim()) {
    return Response.json({ error: '作品名を入力してください' }, { status: 400 });
  }

  // ── Jikan / Claude / Wikipedia を並列実行 ────────────────────────────
  const [jikanMain, jikanExt, jikanRel, claudeRes] = await Promise.allSettled([
    // Jikan: メインアニメ情報（type を取るため）
    malId
      ? fetch(`https://api.jikan.moe/v4/anime/${malId}`).then((r) => r.json())
      : Promise.resolve(null),
    // Jikan: 公式サイトなど外部リンク
    malId
      ? fetch(`https://api.jikan.moe/v4/anime/${malId}/external`).then((r) => r.json())
      : Promise.resolve(null),
    // Jikan: 関連作品（ディレクトリ用）
    malId
      ? fetch(`https://api.jikan.moe/v4/anime/${malId}/relations`).then((r) => r.json())
      : Promise.resolve(null),
    // Claude: Wikipedia URL と主要キャラ（フォールバック用）
    client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      tools: [{
        name: 'franchise_info',
        description: 'アニメ・マンガ作品の情報を返す',
        input_schema: {
          type: 'object' as const,
          properties: {
            wikiUrl: {
              type: 'string',
              description: '日本語 Wikipedia ページの URL。不明なら空文字。',
            },
            characters: {
              type: 'array',
              items: { type: 'string' },
              description: '主要キャラクターの名前リスト（日本語）。最大10名。',
            },
          },
          required: ['wikiUrl', 'characters'],
        },
      }],
      tool_choice: { type: 'tool', name: 'franchise_info' },
      messages: [{
        role: 'user',
        content: `アニメ作品「${name}」の日本語Wikipediaページ URLと主要キャラクター名を教えてください。`,
      }],
    }),
  ]);

  // ── 公式URL（Jikan external から取得） ─────────────────────────────
  let officialUrl = '';
  if (jikanExt.status === 'fulfilled' && jikanExt.value) {
    const ext: JikanExternal[] = jikanExt.value.data ?? [];
    const hit = ext.find((e) =>
      /official|公式/i.test(e.name) &&
      !/twitter|x\.com|facebook|instagram|youtube|niconico/i.test(e.url)
    );
    if (hit) officialUrl = hit.url;
  }

  // ── ディレクトリエントリ（Jikan relations から生成） ─────────────────
  let entries: FranchiseEntry[] | undefined;

  if (jikanMain.status === 'fulfilled' && jikanMain.value?.data && malId) {
    const mainData = jikanMain.value.data;
    const mainLabel = typeLabel(mainData.type ?? 'TV');
    const mainTitle: string = mainData.title_japanese || mainData.title || name;

    // 関連作品を取得
    const relations: JikanRelation[] =
      jikanRel.status === 'fulfilled' ? (jikanRel.value?.data ?? []) : [];

    const relatedEntries: FranchiseEntry[] = relations
      .filter((r) => INCLUDE_RELATIONS.has(r.relation))
      .flatMap((r) =>
        r.entry
          .filter((e) => e.type === 'anime')
          .map((e): FranchiseEntry => ({
            id: `entry-${e.mal_id}`,
            label: e.name,
            malId: e.mal_id,
            sources: [
              ...(officialUrl ? [{ type: 'official' as const, label: '公式', url: officialUrl }] : []),
              {
                type: 'ichiban-search' as const,
                label: '一番くじ',
                url: `https://1kuji.com/products/search?word=${encodeURIComponent(e.name)}`,
              },
            ],
          }))
      );

    if (relatedEntries.length > 0) {
      // 本編エントリ（先頭）+ 関連作品エントリ
      const mainEntry: FranchiseEntry = {
        id: `entry-${malId}`,
        label: mainLabel,
        malId,
        sources: [
          ...(officialUrl ? [{ type: 'official' as const, label: '公式', url: officialUrl }] : []),
          {
            type: 'ichiban-search' as const,
            label: '一番くじ',
            url: `https://1kuji.com/products/search?word=${encodeURIComponent(mainTitle)}`,
          },
        ],
      };
      entries = [mainEntry, ...relatedEntries].slice(0, 8); // 最大8件
    }
  }

  // ── ソース（全体用） ──────────────────────────────────────────────
  const sources: SourceConfig[] = [];
  if (officialUrl) {
    sources.push({ type: 'official', label: '公式', url: officialUrl });
  }
  sources.push({
    type: 'ichiban-search',
    label: '一番くじ',
    url: `https://1kuji.com/products/search?word=${encodeURIComponent(name.trim())}`,
  });

  // ── キャラクター（Wikipedia → Claude フォールバック） ───────────────
  let characters: CharacterDef[] = [];
  let wikiUrl = '';

  if (claudeRes.status === 'fulfilled') {
    const toolUse = claudeRes.value.content.find((b) => b.type === 'tool_use');
    if (toolUse?.type === 'tool_use') {
      const info = toolUse.input as { wikiUrl: string; characters: string[] };
      wikiUrl = info.wikiUrl ?? '';
      if (wikiUrl) {
        try {
          characters = await detectCharactersFromWikipedia(wikiUrl);
        } catch { /* ignore */ }
      }
      // Wikipedia から取れなければ Claude のキャラリストを使う
      if (characters.length === 0 && info.characters?.length > 0) {
        characters = info.characters.map((charName) => {
          const parts = charName.trim().split(/\s+/);
          return {
            name: parts[parts.length - 1] || charName,
            keywords: [...new Set([charName, ...parts])].filter((k) => k.length >= 2),
          };
        });
      }
    }
  }

  const id =
    name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '') + '-' + Date.now();

  const config: FranchiseConfig = {
    id,
    name:       name.trim(),
    searchName: name.trim(),
    characters,
    sources,
    ...(entries ? { entries } : {}),
    createdAt:  new Date().toISOString(),
  };

  return Response.json(config);
}
