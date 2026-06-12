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
import { braveSearch } from '@/lib/brave';
import type { FranchiseConfig, FranchiseEntry, SourceConfig, SourceCandidate, CharacterDef } from '@/lib/franchise';

// ── コラボ監視用 RSS フィード（固定） ────────────────────
const COLLAB_RSS: SourceCandidate[] = [
  { category: 'collab', type: 'rss', label: 'アニメイトタイムズ', url: 'https://www.animatetimes.com/rss/news.xml' },
  { category: 'collab', type: 'rss', label: 'アニメ!アニメ!',     url: 'https://animeanime.jp/rss/index.rdf' },
  { category: 'collab', type: 'rss', label: 'ナタリー',           url: 'https://natalie.mu/comic/feed/news' },
];

// ── Brave 検索結果をソース候補に変換 ─────────────────────
const EXCLUDE_DOMAINS = /twitter|x\.com|facebook|instagram|youtube|wikipedia|amazon|rakuten|mercari|yahoo/i;

function braveToCandidate(
  results: Awaited<ReturnType<typeof braveSearch>>,
  category: SourceCandidate['category'],
): SourceCandidate[] {
  const seen = new Set<string>();
  return results
    .filter((r) => !EXCLUDE_DOMAINS.test(r.url))
    .map((r) => {
      try {
        const u = new URL(r.url);
        // ドメイン＋第1パスセグメントまでに丸める（サブページを除去）
        const segments = u.pathname.split('/').filter(Boolean);
        const path = segments.length > 0 ? `/${segments[0]}/` : '/';
        return { url: u.origin + path, label: r.title.split(/[|｜\-–]/)[0].trim() || u.hostname };
      } catch { return null; }
    })
    .filter((r): r is { url: string; label: string } => r !== null && !seen.has(r.url) && seen.add(r.url) !== undefined)
    .map((r) => ({ category, type: 'generic' as const, label: r.label, url: r.url }));
}

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

/** 複数の公式サイト候補から日本語サイトを選ぶ（英語版を避ける） */
async function pickJapaneseOfficial(urls: string[]): Promise<string> {
  const list = [...new Set(urls)];
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];

  // 各候補を取得して日本語文字数でスコアリング（最大3件、タイムアウト付き）
  const scored = await Promise.all(
    list.slice(0, 3).map(async (url) => {
      try {
        const ac = AbortSignal.timeout(6000);
        const html = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
          signal: ac,
          next: { revalidate: 86400 },
        }).then((r) => r.text());
        const ja = (html.match(/[ぁ-んァ-ヶ一-龠]/g) ?? []).length;
        const isJpDomain = /\.jp(\/|$|:)/.test(url) ? 500 : 0;
        return { url, score: ja + isJpDomain };
      } catch {
        return { url, score: 0 };
      }
    })
  );

  scored.sort((a, b) => b.score - a.score);
  // 最高スコアが日本語をほぼ含まない場合でも先頭候補を返す
  return scored[0].score > 0 ? scored[0].url : list[0];
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

  // ── Jikan / Claude / Brave を並列実行 ──────────────────────────────
  const [jikanMain, jikanExt, jikanRel, claudeRes, braveGC] = await Promise.allSettled([
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
    // Brave: ゲームセンター景品ページを検索
    braveSearch(`${name} ゲームセンター 景品`, 6),
  ]);

  // ── 公式URL（Jikan external から取得。複数あれば日本語サイトを優先） ─────
  let officialUrl = '';
  if (jikanExt.status === 'fulfilled' && jikanExt.value) {
    const ext: JikanExternal[] = jikanExt.value.data ?? [];
    const candidates = ext
      .filter((e) =>
        /official|公式/i.test(e.name) &&
        !/twitter|x\.com|facebook|instagram|youtube|niconico/i.test(e.url)
      )
      .map((e) => e.url);
    officialUrl = await pickJapaneseOfficial(candidates);
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
              ...(officialUrl ? [{ type: 'official' as const, category: 'official' as const, label: '公式', url: officialUrl }] : []),
              {
                type: 'ichiban-search' as const,
                category: 'ichiban' as const,
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
          ...(officialUrl ? [{ type: 'official' as const, category: 'official' as const, label: '公式', url: officialUrl }] : []),
          {
            type: 'ichiban-search' as const,
            category: 'ichiban' as const,
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
    sources.push({ type: 'official', category: 'official', label: '公式', url: officialUrl });
  }
  sources.push({
    type: 'ichiban-search',
    category: 'ichiban',
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

  // ── candidates（ユーザーが選択可能な追加候補） ─────────────────
  const gcCandidates: SourceCandidate[] =
    braveGC.status === 'fulfilled'
      ? braveToCandidate(braveGC.value, 'game-center')
      : [];

  // コラボ RSS にフランチャイズ名をキーワードとして付与
  const collabCandidates: SourceCandidate[] = COLLAB_RSS.map((c) => ({
    ...c,
    keywords: [name.trim(), 'コラボ'],
  }));

  const candidates: SourceCandidate[] = [...gcCandidates, ...collabCandidates];

  return Response.json({ ...config, candidates });
}
