'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FeedItem } from '@/lib/scrapers';

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  official: { bg: '#1a2f4a', color: '#58a6ff' },
  ichiban:  { bg: '#3d1a1a', color: '#f85149' },
};

const DEFAULT_COLOR = { bg: '#1a3a2a', color: '#3fb950' };

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

interface Props {
  initialItems: FeedItem[];
}

export default function Feed({ initialItems }: Props) {
  const [items, setItems]       = useState<FeedItem[]>(initialItems);
  const [seen, setSeen]         = useState<Set<string>>(new Set());
  const [filter, setFilter]     = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load seen IDs from localStorage
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
      const res = await fetch('/api/scrape?nocache=' + Date.now());
      const fresh: FeedItem[] = await res.json();
      setItems(fresh);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  // Sources present in current items
  const sources = ['all', ...Array.from(new Set(items.map((i) => i.source)))];

  const filtered = filter === 'all' ? items : items.filter((i) => i.source === filter);
  const unseenCount = filtered.filter((i) => !seen.has(i.id)).length;

  const sourceLabel: Record<string, string> = {};
  items.forEach((i) => { sourceLabel[i.source] = i.sourceLabel; });

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem', height: 56 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#e6edf3' }}>まどマギ情報まとめ</span>
            {lastUpdated && (
              <span style={{ fontSize: '0.72rem', color: '#484f58', marginLeft: 10 }}>
                更新: {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {unseenCount > 0 && (
            <span style={{ background: '#1f6feb', color: 'white', borderRadius: 100, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
              NEW {unseenCount}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {unseenCount > 0 && (
              <button onClick={markAllSeen} style={ghostBtn}>すべて既読</button>
            )}
            <button onClick={handleRefresh} disabled={refreshing} style={{ ...ghostBtn, opacity: refreshing ? 0.5 : 1 }}>
              {refreshing ? '更新中…' : '↺ 更新'}
            </button>
          </div>
        </div>

        {/* Source filter tabs */}
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 4, paddingBottom: 10 }}>
          {sources.map((src) => (
            <button
              key={src}
              onClick={() => setFilter(src)}
              style={{
                background: filter === src ? '#21262d' : 'transparent',
                color: filter === src ? '#e6edf3' : '#8b949e',
                border: filter === src ? '1px solid #30363d' : '1px solid transparent',
                borderRadius: 6,
                padding: '3px 12px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: filter === src ? 600 : 400,
              }}
            >
              {src === 'all' ? 'すべて' : (sourceLabel[src] ?? src)}
            </button>
          ))}
        </div>
      </header>

      {/* Feed */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
        {filtered.length === 0 ? (
          <p style={{ color: '#484f58', textAlign: 'center', marginTop: '4rem' }}>情報が見つかりませんでした</p>
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
                    display: 'flex',
                    gap: '1rem',
                    background: '#161b22',
                    border: `1px solid ${isNew ? '#388bfd44' : '#30363d'}`,
                    borderRadius: 10,
                    padding: '0.9rem 1rem',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'border-color 0.15s, background 0.15s',
                    opacity: seen.has(item.id) ? 0.65 : 1,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1c2128')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#161b22')}
                >
                  {/* Thumbnail */}
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: '#0d1117' }}
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Top row: source badge + NEW badge + date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ background: col.bg, color: col.color, borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                        {item.sourceLabel}
                      </span>
                      {isNew && (
                        <span style={{ background: '#1f6feb', color: 'white', borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                          NEW
                        </span>
                      )}
                      {item.category && (
                        <span style={{ color: '#8b949e', fontSize: '0.72rem' }}>{item.category}</span>
                      )}
                      <span style={{ color: '#484f58', fontSize: '0.72rem', marginLeft: 'auto' }}>{item.date ?? ''}</span>
                    </div>

                    {/* Title */}
                    <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 500, lineHeight: 1.4, color: '#e6edf3',
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
  background: 'none',
  border: '1px solid #30363d',
  color: '#8b949e',
  borderRadius: 6,
  padding: '4px 12px',
  fontSize: '0.78rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
