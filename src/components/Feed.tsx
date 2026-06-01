'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FeedItem } from '@/lib/scrapers';
import { CHARACTERS, type Character } from '@/lib/scrapers';

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  official: { bg: '#1a2f4a', color: '#58a6ff' },
  ichiban:  { bg: '#3d1a1a', color: '#f85149' },
};
const DEFAULT_COLOR = { bg: '#1a3a2a', color: '#3fb950' };

// キャラごとのイメージカラー
const CHARA_COLORS: Record<Character, string> = {
  まどか: '#f472b6',
  ほむら: '#a78bfa',
  まみ:   '#fbbf24',
  杏子:   '#f87171',
  さやか: '#60a5fa',
};

const SEEN_KEY = 'madoka_hub_seen';

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveSeen(seen: Set<string>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

interface Props { initialItems: FeedItem[] }

export default function Feed({ initialItems }: Props) {
  const [items, setItems]           = useState<FeedItem[]>(initialItems);
  const [seen, setSeen]             = useState<Set<string>>(new Set());
  const [sourceFilter, setSource]   = useState<string>('all');
  const [charaFilter, setChara]     = useState<Character | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setSeen(loadSeen());
    setLastUpdated(new Date());
  }, []);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSeen(next);
      return next;
    });
  }, []);

  const markAllSeen = () => {
    const next = new Set(items.map((i) => i.id));
    saveSeen(next);
    setSeen(next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/scrape?t=' + Date.now());
      setItems(await res.json());
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  // フィルタリング
  const filtered = items.filter((item) => {
    if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
    if (charaFilter) {
      // キャラ未タグ（公式全体ニュースなど）はキャラフィルター時は除外
      if (item.characters.length === 0) return false;
      if (!item.characters.includes(charaFilter)) return false;
    }
    return true;
  });

  const unseenCount = filtered.filter((i) => !seen.has(i.id)).length;

  const sourceLabel: Record<string, string> = {};
  items.forEach((i) => { sourceLabel[i.source] = i.sourceLabel; });
  const sources = ['all', ...Array.from(new Set(items.map((i) => i.source)))];

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* タイトル行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', height: 52 }}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>まどマギ情報まとめ</span>
            {lastUpdated && (
              <span style={{ fontSize: '0.7rem', color: '#484f58' }}>
                {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新
              </span>
            )}
            {unseenCount > 0 && (
              <span style={{ background: '#1f6feb', color: 'white', borderRadius: 100, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
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

          {/* ソースフィルター */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {sources.map((src) => (
              <button key={src} onClick={() => setSource(src)} style={tabBtn(sourceFilter === src)}>
                {src === 'all' ? 'すべて' : (sourceLabel[src] ?? src)}
              </button>
            ))}
          </div>

          {/* キャラフィルター */}
          <div style={{ display: 'flex', gap: 4, paddingBottom: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => setChara(null)}
              style={{
                ...tabBtn(charaFilter === null),
                color: charaFilter === null ? '#e6edf3' : '#8b949e',
              }}
            >
              全員
            </button>
            {CHARACTERS.map((chara) => (
              <button
                key={chara}
                onClick={() => setChara(charaFilter === chara ? null : chara)}
                style={{
                  ...tabBtn(charaFilter === chara),
                  borderColor: charaFilter === chara ? CHARA_COLORS[chara] : 'transparent',
                  color: charaFilter === chara ? CHARA_COLORS[chara] : '#8b949e',
                }}
              >
                {chara}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Feed ── */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
        {filtered.length === 0 ? (
          <p style={{ color: '#484f58', textAlign: 'center', marginTop: '4rem' }}>
            {charaFilter ? `${charaFilter}の情報が見つかりませんでした` : '情報が見つかりませんでした'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map((item) => {
              const isNew = !seen.has(item.id);
              const col = SOURCE_COLORS[item.source] ?? DEFAULT_COLOR;
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => markSeen(item.id)}
                  style={{
                    display: 'flex', gap: '1rem',
                    background: '#161b22',
                    border: `1px solid ${isNew ? '#388bfd44' : '#30363d'}`,
                    borderRadius: 10, padding: '0.9rem 1rem',
                    textDecoration: 'none', color: 'inherit',
                    opacity: seen.has(item.id) ? 0.6 : 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1c2128')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#161b22')}
                >
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* バッジ行 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ background: col.bg, color: col.color, borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                        {item.sourceLabel}
                      </span>
                      {isNew && (
                        <span style={{ background: '#1f6feb', color: 'white', borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>NEW</span>
                      )}
                      {/* キャラバッジ */}
                      {item.characters.map((chara) => (
                        <span key={chara} style={{ borderRadius: 4, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 600,
                          border: `1px solid ${CHARA_COLORS[chara as Character] ?? '#444'}`,
                          color: CHARA_COLORS[chara as Character] ?? '#aaa' }}>
                          {chara}
                        </span>
                      ))}
                      {item.category && <span style={{ color: '#8b949e', fontSize: '0.7rem' }}>{item.category}</span>}
                      <span style={{ color: '#484f58', fontSize: '0.7rem', marginLeft: 'auto' }}>{item.date ?? ''}</span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.4,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  background: 'none', border: '1px solid #30363d', color: '#8b949e',
  borderRadius: 6, padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap',
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  background: active ? '#21262d' : 'transparent',
  color: active ? '#e6edf3' : '#8b949e',
  border: `1px solid ${active ? '#30363d' : 'transparent'}`,
  borderRadius: 6, padding: '3px 12px', fontSize: '0.78rem',
  cursor: 'pointer', fontWeight: active ? 600 : 400,
});
