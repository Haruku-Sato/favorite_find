'use client';

import { useState } from 'react';
import type { FeedItem } from '@/lib/scrapers';
import type { SummarizeResult } from '@/app/api/summarize/route';

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  official: { bg: '#1a2f4a', color: '#58a6ff' },
  ichiban:  { bg: '#3d1a1a', color: '#f85149' },
  rss:      { bg: '#2d2440', color: '#a78bfa' },
  generic:  { bg: '#1a3a2a', color: '#3fb950' },
};
const DEFAULT_COLOR = { bg: '#1a3a2a', color: '#3fb950' };

interface Props {
  item: FeedItem;
  isNew: boolean;
  onOpen: () => void;          // 既読化
  charColors: { name: string; color: string }[];
}

export default function ArticleCard({ item, isNew, onOpen, charColors }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [data, setData]         = useState<SummarizeResult | null>(null);

  const col = SOURCE_COLORS[item.source] ?? DEFAULT_COLOR;
  const image = item.imageUrl || data?.ogImage;

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      onOpen();
      if (!data && !loading) {
        setLoading(true);
        try {
          const res = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url, title: item.title }),
          });
          setData(await res.json());
        } catch { /* ignore */ }
        finally { setLoading(false); }
      }
    }
  };

  return (
    <div
      onClick={toggle}
      style={{
        background: 'var(--c-bg2)',
        border: `1px solid ${isNew ? 'var(--c-new-border)' : 'var(--c-border)'}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s',
      }}
    >
      {/* 画像 */}
      <div style={{ width: '100%', aspectRatio: '16 / 9', background: 'var(--c-bg3)', flexShrink: 0, position: 'relative' }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: col.color, fontWeight: 700, fontSize: '1.1rem', opacity: 0.5 }}>
            {item.sourceLabel}
          </div>
        )}
      </div>

      {/* 本体 */}
      <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {/* バッジ行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ background: col.bg, color: col.color, borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
            {item.sourceLabel}
          </span>
          {isNew && (
            <span style={{ background: 'var(--c-blue)', color: 'white', borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>NEW</span>
          )}
          {charColors.map((c) => (
            <span key={c.name} style={{ color: c.color, fontSize: '0.7rem', fontWeight: 600 }}>{c.name}</span>
          ))}
          <span style={{ color: 'var(--c-text3)', fontSize: '0.7rem', marginLeft: 'auto' }}>{item.date ?? ''}</span>
        </div>

        {/* 見出し */}
        <p style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, lineHeight: 1.45 }}>
          {item.title}
        </p>

        {/* 展開エリア */}
        {expanded && (
          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.25rem', cursor: 'default' }}>
            {loading && (
              <p style={{ color: 'var(--c-text3)', fontSize: '0.82rem', margin: '0.5rem 0' }}>✨ 要約を生成中…</p>
            )}

            {!loading && data && (
              <>
                {/* 値段・日付チップ */}
                {(data.fields.price || data.fields.releaseDate) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                    {data.fields.releaseDate && <span style={chip}>📅 {data.fields.releaseDate}</span>}
                    {data.fields.price && <span style={chip}>💰 {data.fields.price}</span>}
                  </div>
                )}

                {/* Claude 3行要約 */}
                {data.summary && (
                  <div style={{ background: 'var(--c-bg3)', borderRadius: 8, padding: '0.7rem 0.85rem', marginBottom: '0.6rem' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--c-accent)', fontWeight: 700, marginBottom: 4 }}>✨ AI要約</div>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{data.summary}</p>
                  </div>
                )}

                {/* 本文プレビュー（有料記事風フェード） */}
                {data.blocked ? (
                  <p style={{ color: 'var(--c-text3)', fontSize: '0.8rem' }}>🤖 このサイトは自動アクセスを拒否しているため本文を取得できませんでした。</p>
                ) : data.body ? (
                  <div style={{ position: 'relative', maxHeight: 120, overflow: 'hidden' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--c-text2)' }}>{data.body}</p>
                    <div style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0, height: 70,
                      background: 'linear-gradient(to bottom, transparent, var(--c-bg2))',
                    }} />
                  </div>
                ) : null}

                {/* サイト先ボタン */}
                <a
                  href={item.url} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'block', textAlign: 'center', marginTop: '0.7rem',
                    background: 'var(--c-blue)', color: '#fff', borderRadius: 8,
                    padding: '0.55rem', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  続きをサイトで読む ↗
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  background: 'var(--c-bg4)', color: 'var(--c-text)', borderRadius: 100,
  padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600,
};
