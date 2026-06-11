// ── 型定義 ────────────────────────────────────────────────

export interface CharacterDef {
  name: string;
  keywords: string[];   // テキスト中でこのキャラを示すキーワード
  color?: string;       // UI 表示色（任意）
}

export type SourceCategory = 'official' | 'game-center' | 'ichiban' | 'collab';

export const CATEGORY_LABEL: Record<SourceCategory, string> = {
  official:     '公式',
  'game-center': 'ゲームセンター',
  ichiban:      '一番くじ',
  collab:       'コラボ',
};

export interface SourceConfig {
  type: 'official' | 'ichiban' | 'ichiban-search' | 'generic' | 'rss';
  category: SourceCategory;
  label: string;
  url: string;
  /** rss type のみ: このキーワードを含む記事だけ残す */
  keywords?: string[];
}

/** セットアップ時にユーザーが選択できる候補ソース */
export interface SourceCandidate {
  category: SourceCategory;
  type: SourceConfig['type'];
  label: string;
  url: string;
  keywords?: string[];
}

/** 同一フランチャイズ内の個別エントリ（TVシリーズ・劇場版など） */
export interface FranchiseEntry {
  id: string;
  label: string;       // "TVアニメ", "劇場版 叛逆の物語" など
  malId?: number;      // MyAnimeList ID
  sources: SourceConfig[];
}

export interface FranchiseConfig {
  id: string;
  name: string;               // 表示名
  searchName: string;         // 検索用（英語名など）
  characters: CharacterDef[];
  sources: SourceConfig[];    // 「全体」用ソース
  entries?: FranchiseEntry[]; // 複数作品ある場合のディレクトリ
  createdAt: string;
}

// ── キャラクター検出（汎用） ──────────────────────────────

export function detectCharacters(
  text: string,
  defs: CharacterDef[]
): string[] {
  return defs
    .filter((c) => c.keywords.some((kw) => text.includes(kw)))
    .map((c) => c.name);
}

// ── localStorage 操作 ────────────────────────────────────

const STORAGE_KEY = 'favorite_find_franchises';

export function loadFranchises(): FranchiseConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFranchises(list: FranchiseConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addFranchise(f: FranchiseConfig): void {
  const list = loadFranchises();
  saveFranchises([...list.filter((x) => x.id !== f.id), f]);
}

export function removeFranchise(id: string): void {
  saveFranchises(loadFranchises().filter((f) => f.id !== id));
}

// ── まどマギのデフォルト設定（初回表示用） ───────────────

export const MADOKA_DEFAULT: FranchiseConfig = {
  id: 'madoka-magica',
  name: '魔法少女まどか☆マギカ',
  searchName: '魔法少女まどか☆マギカ',
  characters: [
    { name: 'まどか',  keywords: ['まどか', '鹿目'],   color: '#f472b6' },
    { name: 'ほむら',  keywords: ['ほむら', '暁美'],   color: '#a78bfa' },
    { name: 'マミ',    keywords: ['マミ', '巴マミ', '巴マミさん'], color: '#fbbf24' },
    { name: '杏子',    keywords: ['杏子', '佐倉'],     color: '#f87171' },
    { name: 'さやか',  keywords: ['さやか', '美樹'],   color: '#60a5fa' },
  ],
  sources: [
    { type: 'official',       category: 'official', label: '公式',       url: 'https://www.madoka-magica.com' },
    { type: 'ichiban',        category: 'ichiban',  label: '一番くじ',    url: 'https://1kuji.com/characters/85' },
  ],
  createdAt: new Date().toISOString(),
};
