'use client';

import { useState, useEffect } from 'react';
import type { FranchiseConfig } from '@/lib/franchise';
import { MADOKA_DEFAULT, loadFranchises, saveFranchises } from '@/lib/franchise';
import { scrapeAll } from '@/lib/scrapers';
import type { FeedItem } from '@/lib/scrapers';
import Feed from '@/components/Feed';
import AddFranchiseModal from '@/components/AddFranchiseModal';

export default function Page() {
  const [franchises, setFranchises]   = useState<FranchiseConfig[]>([MADOKA_DEFAULT]);
  const [activeId, setActiveId]       = useState<string>(MADOKA_DEFAULT.id);
  const [itemsMap, setItemsMap]       = useState<Record<string, FeedItem[]>>({});
  const [showModal, setShowModal]     = useState(false);
  const [loading, setLoading]         = useState(false);

  // localStorage から復元
  useEffect(() => {
    const list = loadFranchises();
    setFranchises(list);
    setActiveId(list[0]?.id ?? MADOKA_DEFAULT.id);
  }, []);

  // アクティブフランチャイズが変わったら未取得ならスクレイプ
  useEffect(() => {
    if (!activeId || itemsMap[activeId]) return;
    const franchise = franchises.find((f) => f.id === activeId);
    if (!franchise) return;

    setLoading(true);
    scrapeAll(franchise)
      .then((items) => setItemsMap((prev) => ({ ...prev, [activeId]: items })))
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
    <div style={{ background: '#0d1117', minHeight: '100vh', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── グローバルタブバー ── */}
      <header style={{
        background: '#161b22', borderBottom: '1px solid #30363d',
        padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 4, height: 52, overflowX: 'auto' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#58a6ff', marginRight: 8, flexShrink: 0 }}>
            FavoriteFind
          </span>

          {franchises.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => setActiveId(f.id)}
                style={{
                  background: activeId === f.id ? '#21262d' : 'transparent',
                  color: activeId === f.id ? '#e6edf3' : '#8b949e',
                  border: activeId === f.id ? '1px solid #30363d' : '1px solid transparent',
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
                    background: activeId === f.id ? '#21262d' : 'transparent',
                    border: activeId === f.id ? '1px solid #30363d' : '1px solid transparent',
                    borderLeft: 'none',
                    color: '#484f58', borderRadius: '0 6px 6px 0',
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
              background: 'none', border: '1px dashed #30363d', color: '#8b949e',
              borderRadius: 6, padding: '4px 10px', fontSize: '0.82rem',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            ＋ 追加
          </button>
        </div>
      </header>

      {/* ── コンテンツ ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#484f58' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔄</div>
          情報を取得中…
        </div>
      ) : active && itemsMap[active.id] ? (
        <Feed franchise={active} initialItems={itemsMap[active.id]} />
      ) : active ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#484f58' }}>読み込み中…</div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#484f58' }}>
          ＋ 追加 から作品を登録してください
        </div>
      )}

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
