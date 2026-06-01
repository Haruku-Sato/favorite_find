'use client';

import { useState, useEffect } from 'react';
import type { FranchiseConfig } from '@/lib/franchise';
import { MADOKA_DEFAULT, loadFranchises, saveFranchises } from '@/lib/franchise';
import type { FeedItem } from '@/lib/scrapers';
import Feed from '@/components/Feed';
import AddFranchiseModal from '@/components/AddFranchiseModal';
import { useTheme } from '@/lib/theme-context';

export default function Page() {
  const [franchises, setFranchises]   = useState<FranchiseConfig[]>([]);
  const [activeId, setActiveId]       = useState<string>(MADOKA_DEFAULT.id);
  const [itemsMap, setItemsMap]       = useState<Record<string, FeedItem[]>>({});
  const [showModal, setShowModal]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const { theme, toggle }             = useTheme();

  // localStorage から復元
  useEffect(() => {
    const list = loadFranchises();
    setFranchises(list);
    setActiveId(list[0]?.id ?? MADOKA_DEFAULT.id);
  }, []);

  // アクティブフランチャイズが変わったら未取得ならサーバー側スクレイプ（CORS回避）
  useEffect(() => {
    if (!activeId || itemsMap[activeId]) return;
    const franchise = franchises.find((f) => f.id === activeId);
    if (!franchise) return;

    setLoading(true);
    fetch('/api/franchise/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ franchise }),
    })
      .then((r) => r.json())
      .then((items: FeedItem[]) => setItemsMap((prev) => ({ ...prev, [activeId]: items })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeId, franchises, itemsMap]);

  const handleAdd = (f: FranchiseConfig) => {
    const next = [...franchises.filter((x) => x.id !== f.id), f];
    setFranchises(next);
    saveFranchises(next);
    setActiveId(f.id);
  };

  const handleRemove = (id: string) => {
    const next = franchises.filter((f) => f.id !== id);
    setFranchises(next);
    saveFranchises(next);
    if (activeId === id) setActiveId(next[0]?.id ?? '');
  };

  const active = franchises.find((f) => f.id === activeId);

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh', color: 'var(--c-text)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── グローバルタブバー ── */}
      {franchises.length > 0 && (
        <header style={{
          background: 'var(--c-bg2)', borderBottom: '1px solid var(--c-border)',
          padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 4, height: 52, overflowX: 'auto' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--c-accent)', marginRight: 8, flexShrink: 0 }}>
              FavoriteFind
            </span>

            {franchises.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => setActiveId(f.id)}
                  style={{
                    background: activeId === f.id ? 'var(--c-bg4)' : 'transparent',
                    color: activeId === f.id ? 'var(--c-text)' : 'var(--c-text2)',
                    border: activeId === f.id ? '1px solid var(--c-border)' : '1px solid transparent',
                    borderRadius: '6px 0 0 6px', padding: '4px 12px',
                    fontSize: '0.82rem', cursor: 'pointer', fontWeight: activeId === f.id ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.name.length > 10 ? f.name.slice(0, 10) + '…' : f.name}
                </button>
                {franchises.length > 1 && (
                  <button
                    onClick={() => handleRemove(f.id)}
                    title="削除"
                    style={{
                      background: activeId === f.id ? 'var(--c-bg4)' : 'transparent',
                      border: activeId === f.id ? '1px solid var(--c-border)' : '1px solid transparent',
                      borderLeft: 'none',
                      color: 'var(--c-text3)', borderRadius: '0 6px 6px 0',
                      padding: '4px 6px', fontSize: '0.7rem', cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {/* 追加ボタン */}
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: 'none', border: '1px dashed var(--c-border)', color: 'var(--c-text2)',
                borderRadius: 6, padding: '4px 10px', fontSize: '0.82rem',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              ＋ 追加
            </button>

            {/* テーマ切り替えボタン */}
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              style={{
                marginLeft: 'auto', background: 'none', border: '1px solid var(--c-border)',
                color: 'var(--c-text2)', borderRadius: 6, padding: '4px 8px',
                fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>
      )}

      {/* ── コンテンツ ── */}
      {franchises.length === 0 ? (
        /* ── オンボーディング ── */
        <div style={{
          maxWidth: 520, margin: '0 auto', padding: '5rem 1.5rem 3rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
        }}>
          {/* テーマトグル（オンボーディング時） */}
          <div style={{ position: 'fixed', top: 16, right: 16 }}>
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              style={{
                background: 'var(--c-bg2)', border: '1px solid var(--c-border)',
                color: 'var(--c-text2)', borderRadius: 8, padding: '6px 10px',
                fontSize: '1rem', cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>

          <div style={{ fontSize: '2.8rem' }}>🔍</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--c-text)', margin: 0, textAlign: 'center' }}>
            好きな作品を追加しよう
          </h1>
          <p style={{ color: 'var(--c-text2)', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
            公式サイト・一番くじなどから最新情報をまとめて表示します。<br />
            まずは気になる作品名を入力してください。
          </p>

          <button
            onClick={() => setShowModal(true)}
            style={{
              background: 'var(--c-green)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '0.75rem 2rem',
              fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--c-green-h)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--c-green)')}
          >
            ＋ 作品を追加する
          </button>

          {/* サジェスト例 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: '0.5rem' }}>
            {['魔法少女まどか☆マギカ', '僕のヒーローアカデミア', '推しの子', 'ブルーロック'].map((ex) => (
              <button
                key={ex}
                onClick={() => setShowModal(true)}
                style={{
                  background: 'var(--c-bg2)', border: '1px solid var(--c-border)', color: 'var(--c-text2)',
                  borderRadius: 20, padding: '4px 14px', fontSize: '0.8rem', cursor: 'pointer',
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--c-text3)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔄</div>
          情報を取得中…
        </div>
      ) : active && itemsMap[active.id] ? (
        <Feed franchise={active} initialItems={itemsMap[active.id]} />
      ) : active ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--c-text3)' }}>読み込み中…</div>
      ) : null}

      {/* ── モーダル ── */}
      {showModal && (
        <AddFranchiseModal
          onAdd={handleAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
