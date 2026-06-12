'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { FeedItem } from '@/lib/scrapers';

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
  const [ogImage, setOgImage] = useState<string | undefined>();
  const [imgOk, setImgOk]     = useState(true);

  const col = SOURCE_COLORS[item.source] ?? DEFAULT_COLOR;
  const image = item.imageUrl || ogImage;
  const showImage = Boolean(image) && imgOk;

  // 一覧サムネが無い場合、og:image を取得して画像を出す
  useEffect(() => {
    if (item.imageUrl) return;
    let alive = true;
    fetch(`/api/ogimage?url=${encodeURIComponent(item.url)}`)
      .then((r) => r.json())
      .then((d) => { if (alive && d.image) setOgImage(d.image); })
      .catch(() => {});
    return () => { alive = false; };
  }, [item.url, item.imageUrl]);

  const href = `/article?${new URLSearchParams({
    url: item.url,
    title: item.title,
    label: item.sourceLabel,
    date: item.date ?? '',
    image: showImage && image ? image : '',
  }).toString()}`;

  return (
    <Link
      href={href}
      onClick={onOpen}
      style={{
        background: 'var(--c-bg2)',
        border: `1px solid ${isNew ? 'var(--c-new-border)' : 'var(--c-border)'}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit',
      }}
    >
      {/* 画像（取得できた時だけ表示。失敗時はテキストのみ） */}
      {showImage && image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          onError={() => setImgOk(false)}
          style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', background: 'var(--c-bg3)' }}
        />
      )}

      {/* 本体 */}
      <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
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

        <p style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, lineHeight: 1.45 }}>
          {item.title}
        </p>
      </div>
    </Link>
  );
}
