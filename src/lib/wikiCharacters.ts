import * as cheerio from 'cheerio';
import type { CharacterDef } from './franchise';

/**
 * Wikipedia の「登場人物」セクションからキャラクター名を抽出する。
 * 名前 + よみがな（ひらがな）をキーワードとして CharacterDef を生成。
 */
export async function detectCharactersFromWikipedia(
  wikiUrl: string
): Promise<CharacterDef[]> {
  const res = await fetch(wikiUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FavoriteFind/1.0)' },
  });
  if (!res.ok) return [];

  const $ = cheerio.load(await res.text());
  const chars: CharacterDef[] = [];
  const seen = new Set<string>();

  // 登場人物セクションを探す
  let inCharSection = false;
  $('h2, h3, dt, .mw-headline').each((_, el) => {
    const heading = $(el).text().replace(/\[.*?\]/g, '').trim();

    // 登場人物セクション開始
    if (/登場人物|キャラクター|主要キャラ|登場キャラ/.test(heading)) {
      inCharSection = true;
      return;
    }
    // 別の h2 で終了
    if (inCharSection && el.tagName === 'h2') {
      inCharSection = false;
    }
  });

  // h3/dt でキャラ名を収集（登場人物セクション内の見出し）
  let capturing = false;
  $('h2, h3, h4, dt').each((_, el) => {
    const text = $(el).text().replace(/\[.*?\]/g, '').trim();

    if (/登場人物|キャラクター|主要キャラ/.test(text)) {
      capturing = true;
      return;
    }
    if (capturing && el.tagName === 'h2') {
      capturing = false;
      return;
    }
    if (!capturing) return;

    // 名前部分を抽出: "鹿目 まどか（かなめ まどか）" の形式
    const nameMatch = text.match(/^([^\s（(【\[、,]+(?:\s+[^\s（(【\[、,]+)?)/);
    if (!nameMatch) return;

    const fullName = nameMatch[1].trim();
    if (fullName.length < 2 || fullName.length > 15) return;
    if (seen.has(fullName)) return;
    seen.add(fullName);

    // よみがな抽出
    const readingMatch = text.match(/[（(]([ぁ-んァ-ン\s]+)[）)]/);
    const reading = readingMatch ? readingMatch[1].trim() : null;

    // キーワード生成（姓・名・よみがな）
    const parts = fullName.split(/\s+/);
    const keywords = [...new Set([
      fullName,
      ...parts,
      ...(reading ? reading.split(/\s+/) : []),
    ])].filter((k) => k.length >= 2);

    if (keywords.length === 0) return;

    chars.push({
      name:     parts[parts.length - 1] || fullName, // 名（下の名前）
      keywords,
    });
  });

  // 10人以上は多すぎるので主要キャラのみ（上位10件）
  return chars.slice(0, 10);
}
