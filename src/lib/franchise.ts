// ── 型定義 ────────────────────────────────────────────────

export interface CharacterDef {
  name: string;
  keywords: string[];   // テキスト中でこのキャラを示すキーワード
  color?: string;       // UI 表示色（任意）
}

export interface SourceConfig {
  type: 'official' | 'ichiban' | 'ichiban-search' | 'generic';
  label: string;
  url: string;
}

export interface FranchiseConfig {
  id: string;
  name: string;               // 表示名
  searchName: string;         // 検索用（英語名など）
  characters: CharacterDef[];
  sources: SourceConfig[];
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
    { type: 'official',       label: '公式',     url: 'https://www.madoka-magica.com' },
    { type: 'ichiban',        label: '一番くじ',  url: 'https://1kuji.com/characters/85' },
  ],
  createdAt: new Date().toISOString(),
};
