/**
 * POST /api/franchise/setup
 * body: { name: string }
 *
 * Claude API でアニメ作品の公式サイト・一番くじURL・Wikipediaを探し、
 * Wikipedia からキャラ名を抽出して FranchiseConfig の雛形を返す。
 */
import Anthropic from '@anthropic-ai/sdk';
import { detectCharactersFromWikipedia } from '@/lib/wikiCharacters';
import type { FranchiseConfig, SourceConfig, CharacterDef } from '@/lib/franchise';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface FranchiseInfo {
  officialUrl: string;
  ichibanUrl: string;
  wikiUrl: string;
  characters: string[];
}

export async function POST(req: Request) {
  const { name } = await req.json() as { name: string };
  if (!name?.trim()) {
    return Response.json({ error: '作品名を入力してください' }, { status: 400 });
  }

  // ── Claude に URL とキャラクター情報を聞く ─────────────────────────────
  let info: FranchiseInfo = { officialUrl: '', ichibanUrl: '', wikiUrl: '', characters: [] };

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      tools: [
        {
          name: 'franchise_info',
          description: 'アニメ・マンガ作品の情報を返す',
          input_schema: {
            type: 'object' as const,
            properties: {
              officialUrl: {
                type: 'string',
                description: '公式アニメ・ゲームサイトの URL。不明なら空文字。',
              },
              ichibanUrl: {
                type: 'string',
                description: '1kuji.com の一番くじページ URL。不明なら空文字。',
              },
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
            required: ['officialUrl', 'ichibanUrl', 'wikiUrl', 'characters'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'franchise_info' },
      messages: [
        {
          role: 'user',
          content: `アニメ・マンガ作品「${name}」について教えてください。URLは実在するものだけを答えてください。不明・自信がないURLは空文字にしてください。`,
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (toolUse?.type === 'tool_use') {
      info = toolUse.input as FranchiseInfo;
    }
  } catch (err) {
    console.error('Claude API error:', err);
    // Claude が失敗してもフォールバックで続行
  }

  // ── sources を組み立てる ───────────────────────────────────────────────
  const sources: SourceConfig[] = [];

  if (info.officialUrl) {
    sources.push({ type: 'official', label: '公式', url: info.officialUrl });
  }

  if (info.ichibanUrl) {
    const type = info.ichibanUrl.includes('/characters/') ? 'ichiban' : 'ichiban-search';
    sources.push({ type, label: '一番くじ', url: info.ichibanUrl });
  } else {
    // 見つからない場合はキーワード検索 URL を自動生成
    const searchUrl = `https://1kuji.com/products/search?word=${encodeURIComponent(name)}`;
    sources.push({ type: 'ichiban-search', label: '一番くじ', url: searchUrl });
  }

  // ── キャラクター: Wikipedia で補強、なければ Claude の結果を使う ────────
  let characters: CharacterDef[] = [];

  if (info.wikiUrl) {
    try {
      characters = await detectCharactersFromWikipedia(info.wikiUrl);
    } catch (err) {
      console.error('Wikipedia scrape error:', err);
    }
  }

  // Wikipedia から取れなかった場合は Claude の回答をフォールバックとして使う
  if (characters.length === 0 && info.characters.length > 0) {
    characters = info.characters.map((charName) => {
      const parts = charName.trim().split(/\s+/);
      return {
        name: parts[parts.length - 1] || charName,
        keywords: [...new Set([charName, ...parts])].filter((k) => k.length >= 2),
      };
    });
  }

  const id =
    name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '') + '-' + Date.now();

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
