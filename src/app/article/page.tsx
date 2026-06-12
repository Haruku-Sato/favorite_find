'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { SummarizeResult } from '@/app/api/summarize/route';

function ArticleDetail() {
  const sp = useSearchParams();
  const router = useRouter();

  const url   = sp.get('url') ?? '';
  const title = sp.get('title') ?? '';
  const label = sp.get('label') ?? '';
  const date  = sp.get('date') ?? '';
  const image = sp.get('image') ?? '';

  const [data, setData]       = useState<SummarizeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgOk, setImgOk]     = useState(Boolean(image));

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url, title]);

  const heroImage = image || data?.ogImage;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'system-ui, sans-serif' }}>
      {/* ヘッダー */}
      <div style={{ background: 'var(--c-bg2)', borderBottom: '1px solid var(--c-border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid var(--c-border)', color: 'var(--c-text2)', borderRadius: 6, padding: '5px 12px', fontSize: '0.82rem', cursor: 'pointer' }}>
            ← 戻る
          </button>
        </div>
      </div>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem' }}>
        {/* メタ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem', fontSize: '0.75rem', color: 'var(--c-text3)' }}>
          {label && <span style={{ background: 'var(--c-bg4)', color: 'var(--c-text2)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>{label}</span>}
          {date && <span>{date}</span>}
        </div>

        {/* タイトル */}
        <h1 style={{ margin: '0 0 1rem', fontSize: '1.3rem', lineHeight: 1.5 }}>{title}</h1>

        {/* 画像（取得できた時だけ） */}
        {heroImage && imgOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt="" onError={() => setImgOk(false)}
            style={{ width: '100%', borderRadius: 12, marginBottom: '1.25rem', display: 'block' }} />
        )}

        {loading && <p style={{ color: 'var(--c-text3)' }}>✨ 要約を生成中…</p>}

        {!loading && data && (
          <>
            {/* 値段・日付チップ */}
            {(data.fields.price || data.fields.releaseDate) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
                {data.fields.releaseDate && <span style={chip}>📅 {data.fields.releaseDate}</span>}
                {data.fields.price && <span style={chip}>💰 {data.fields.price}</span>}
              </div>
            )}

            {/* AI要約 */}
            {data.summary && (
              <div style={{ background: 'var(--c-bg2)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '1rem 1.1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--c-accent)', fontWeight: 700, marginBottom: 6 }}>✨ AI要約</div>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{data.summary}</p>
              </div>
            )}

            {/* 本文（軽く） */}
            {data.blocked ? (
              <p style={{ color: 'var(--c-text3)', fontSize: '0.85rem' }}>🤖 このサイトは自動アクセスを拒否しているため本文を取得できませんでした。</p>
            ) : data.body ? (
              <div style={{ position: 'relative', maxHeight: 200, overflow: 'hidden', marginBottom: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--c-text2)' }}>{data.body}</p>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, background: 'linear-gradient(to bottom, transparent, var(--c-bg))' }} />
              </div>
            ) : null}

            {/* サイトへ */}
            <a href={url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', textAlign: 'center', marginTop: '1rem', background: 'var(--c-blue)', color: '#fff', borderRadius: 10, padding: '0.8rem', fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none' }}>
              元記事をサイトで読む ↗
            </a>
          </>
        )}
      </main>
    </div>
  );
}

export default function ArticlePage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--c-text3)' }}>読み込み中…</div>}>
      <ArticleDetail />
    </Suspense>
  );
}

const chip: React.CSSProperties = {
  background: 'var(--c-bg4)', color: 'var(--c-text)', borderRadius: 100,
  padding: '3px 12px', fontSize: '0.8rem', fontWeight: 600,
};
