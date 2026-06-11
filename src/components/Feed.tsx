'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FeedItem } from '@/lib/scrapers';
import type { FranchiseConfig, SourceCategory } from '@/lib/franchise';
import { CATEGORY_LABEL } from '@/lib/franchise';

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  official:         { bg: '#1a2f4a', color: '#58a6ff' },
  ichiban:          { bg: '#3d1a1a', color: '#f85149' },
  'ichiban-search': { bg: '#3d1a1a', color: '#f85149' },
  generic:          { bg: '#1a3a2a', color: '#3fb950' },
};
const DEFAULT_COLOR = { bg: '#1a3a2a', color: '#3fb950' };

const PALETTE = ['#f472b6','#a78bfa','#fbbf24','#f87171','#60a5fa','#34d399','#fb923c','#e879f9'];

function getCharColor(chars: FranchiseConfig['characters'], name: string, idx: number): string {
  return chars.find((c) => c.name === name)?.color ?? PALETTE[idx % PALETTE.length];
}

const SEEN_KEY_PREFIX = 'favorite_find_seen_';
function loadSeen(franchiseId: string): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY_PREFIX + franchiseId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveSeen(franchiseId: string, seen: Set<string>) {
  localStorage.setItem(SEEN_KEY_PREFIX + franchiseId, JSON.stringify([...seen]));
}

interface Props {
  franchise: FranchiseConfig;
  initialItems: FeedItem[];
}

export default function Feed({ franchise, initialItems }: Props) {
  const [items, setItems]             = useState<FeedItem[]>(initialItems);
  const [seen, setSeen]               = useState<Set<string>>(new Set());
  const [categoryFilter, setCategory] = useState<SourceCategory | 'all'>('all');
  const [charaFilter, setChara]       = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setSeen(loadSeen(franchise.id));
    setLastUpdated(new Date());
    setCategory('all');
    setChara(null);
  }, [franchise.id]);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSeen(franchise.id, next);
      return next;
    });
  }, [franchise.id]);

  const markAllSeen = () => {
    const next = new Set(items.map((i) => i.id));
    saveSeen(franchise.id, next);
    setSeen(next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/franchise/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ franchise }),
      });
      setItems(await res.json());
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  // 通知（botブロック等）と実記事を分離
  const realItems   = items.filter((i) => !i.notice);
  const noticeItems = items.filter((i) => i.notice);
  const blockedCategories = new Set(
    noticeItems.filter((i) => i.notice === 'bot-blocked').map((i) => i.sourceCategory),
  );

  const filtered = realItems.filter((item) => {
    if (categoryFilter !== 'all' && item.sourceCategory !== categoryFilter) return false;
    if (charaFilter) {
      if (item.characters.length === 0) return false;
      if (!item.characters.includes(charaFilter)) return false;
    }
    return true;
  });

  const unseenCount = filtered.filter((i) => !seen.has(i.id)).length;
  // カテゴリは「登録ソース」基準で常設（記事0件でもタブを出す）。記事のみのカテゴリも一応含める
  const categories = ['all', ...Array.from(new Set([
    ...franchise.sources.map((s) => s.category),
    ...realItems.map((i) => i.sourceCategory),
  ]))] as ('all' | SourceCategory)[];

  // 選択中カテゴリに紐づく登録ソース（フォールバック表示用）
  const categorySources = categoryFilter === 'all'
    ? []
    : franchise.sources.filter((s) => s.category === categoryFilter);
  // 選択中カテゴリが botブロックされているか
  const categoryBlocked = categoryFilter !== 'all' && blockedCategories.has(categoryFilter);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── フィードヘッダー ── */}
      <div style={{ background: 'var(--c-bg2)', borderBottom: '1px solid var(--c-border)', padding: '0 1.5rem', position: 'sticky', top: 52, zIndex: 9 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', height: 48, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{franchise.name}</span>
            {lastUpdated && (
              <span style={{ fontSize: '0.7rem', color: 'var(--c-text3)' }}>
                {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新
              </span>
            )}
            {unseenCount > 0 && (
              <span style={{ background: 'var(--c-blue)', color: 'white', borderRadius: 100, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                NEW {unseenCount}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {unseenCount > 0 && <button onClick={markAllSeen} style={ghostBtn}>すべて既読</button>}
              <button onClick={handleRefresh} disabled={refreshing} style={{ ...ghostBtn, opacity: refreshing ? 0.5 : 1 }}>
                {refreshing ? '更新中…' : '↺ 更新'}
              </button>
            </div>
          </div>

          {/* カテゴリフィルター */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)} style={tabBtn(categoryFilter === cat)}>
                {cat === 'all' ? 'すべて' : CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>

          {/* キャラフィルター */}
          {franchise.characters.length > 0 && (
            <div style={{ display: 'flex', gap: 4, paddingBottom: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setChara(null)} style={tabBtn(charaFilter === null)}>全員</button>
              {franchise.characters.map((c, i) => {
                const col = getCharColor(franchise.characters, c.name, i);
                const active = charaFilter === c.name;
                return (
                  <button key={c.name} onClick={() => setChara(active ? null : c.name)}
                    style={{ ...tabBtn(active), borderColor: active ? col : 'transparent', color: active ? col : 'var(--c-text2)' }}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── フィード本体 ── */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
        {filtered.length === 0 ? (
          // 記事0件: 登録ソースがあれば導線カードを出す（公式タブ常設のフォールバック）
          categorySources.length > 0 && !charaFilter ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <p style={{ color: 'var(--c-text3)', fontSize: '0.85rem', margin: 0 }}>
                {categoryBlocked
                  ? '🤖 botブロックです、ごめんなさい！このサイトは自動アクセスを拒否しているため記事を取得できません。サイトを直接確認できます：'
                  : '自動取得できる記事が見つかりませんでした。サイトを直接確認できます：'}
              </p>
              {categorySources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, background: 'var(--c-bg2)',
                    border: '1px solid var(--c-border)', borderRadius: 10, padding: '0.9rem 1rem',
                    textDecoration: 'none', color: 'inherit',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-bg3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--c-bg2)')}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.label}</span>
                  <span style={{ color: 'var(--c-text3)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.url}
                  </span>
                  <span style={{ marginLeft: 'auto', color: 'var(--c-text3)' }}>↗</span>
                </a>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--c-text3)', textAlign: 'center', marginTop: '4rem' }}>
              {charaFilter ? `${charaFilter}の情報が見つかりませんでした` : '情報が見つかりませんでした'}
            </p>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map((item) => {
              const isNew = !seen.has(item.id);
              const col = SOURCE_COLORS[item.source] ?? DEFAULT_COLOR;
              return (
                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                  onClick={() => markSeen(item.id)}
                  style={{
                    display: 'flex', gap: '1rem', background: 'var(--c-bg2)',
                    border: `1px solid ${isNew ? 'var(--c-new-border)' : 'var(--c-border)'}`,
                    borderRadius: 10, padding: '0.9rem 1rem',
                    textDecoration: 'none', color: 'inherit',
                    opacity: seen.has(item.id) ? 0.6 : 1, transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-bg3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--c-bg2)')}
                >
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ background: col.bg, color: col.color, borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                        {item.sourceLabel}
                      </span>
                      {isNew && (
                        <span style={{ background: 'var(--c-blue)', color: 'white', borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>NEW</span>
                      )}
                      {item.characters.map((chara, i) => {
                        const idx = franchise.characters.findIndex((c) => c.name === chara);
                        const color = getCharColor(franchise.characters, chara, idx >= 0 ? idx : i);
                        return (
                          <span key={chara} style={{ color, fontSize: '0.7rem', fontWeight: 600 }}>{chara}</span>
                        );
                      })}
                      {item.category && <span style={{ color: 'var(--c-text2)', fontSize: '0.7rem' }}>{item.category}</span>}
                      <span style={{ color: 'var(--c-text3)', fontSize: '0.7rem', marginLeft: 'auto' }}>{item.date ?? ''}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--c-border)', color: 'var(--c-text2)',
  borderRadius: 6, padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap',
};
const tabBtn = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--c-bg4)' : 'transparent',
  color: active ? 'var(--c-text)' : 'var(--c-text2)',
  border: `1px solid ${active ? 'var(--c-border)' : 'transparent'}`,
  borderRadius: 6, padding: '3px 10px', fontSize: '0.76rem',
  cursor: 'pointer', fontWeight: active ? 600 : 400,
});
