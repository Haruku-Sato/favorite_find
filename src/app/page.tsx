'use client';

import { useState, useEffect, useRef } from 'react';
import type { FranchiseConfig, FranchiseEntry } from '@/lib/franchise';
import { MADOKA_DEFAULT, loadFranchises, saveFranchises } from '@/lib/franchise';
import type { FeedItem } from '@/lib/scrapers';
import Feed from '@/components/Feed';
import AddFranchiseModal from '@/components/AddFranchiseModal';
import { useTheme } from '@/lib/theme-context';

/** スクレイプキー: "franchiseId" or "franchiseId__entryId" */
function scrapeKey(franchiseId: string, entryId: string | null) {
  return entryId ? `${franchiseId}__${entryId}` : franchiseId;
}

export default function Page() {
  const [franchises, setFranchises]       = useState<FranchiseConfig[]>([]);
  const [activeId, setActiveId]           = useState<string>(MADOKA_DEFAULT.id);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [itemsMap, setItemsMap]           = useState<Record<string, FeedItem[]>>({});
  const [showModal, setShowModal]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [openDropdown, setOpenDropdown]   = useState<string | null>(null); // 開いてるドロップダウンの franchiseId
  const [dropPos, setDropPos]             = useState<{ left: number; top: number } | null>(null);
  const dropdownRef                       = useRef<HTMLDivElement>(null);
  const { theme, toggle }                 = useTheme();

  // localStorage から復元
  useEffect(() => {
    const list = loadFranchises();
    setFranchises(list);
    setActiveId(list[0]?.id ?? MADOKA_DEFAULT.id);
  }, []);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // アクティブが変わったら未取得なら API 経由スクレイプ
  useEffect(() => {
    const key = scrapeKey(activeId, activeEntryId);
    if (!activeId || itemsMap[key]) return;

    const franchise = franchises.find((f) => f.id === activeId);
    if (!franchise) return;

    // entry が選択されている場合はそのソース、なければ franchise.sources
    const sources = activeEntryId
      ? franchise.entries?.find((e) => e.id === activeEntryId)?.sources ?? []
      : franchise.sources;

    if (sources.length === 0) return;

    setLoading(true);
    fetch('/api/franchise/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ franchise: { ...franchise, sources } }),
    })
      .then((r) => r.json())
      .then((items: FeedItem[]) => setItemsMap((prev) => ({ ...prev, [key]: items })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeId, activeEntryId, franchises, itemsMap]);

  const handleAdd = (f: FranchiseConfig) => {
    const next = [...franchises.filter((x) => x.id !== f.id), f];
    setFranchises(next);
    saveFranchises(next);
    setActiveId(f.id);
    setActiveEntryId(null);
  };

  const handleRemove = (id: string) => {
    const next = franchises.filter((f) => f.id !== id);
    setFranchises(next);
    saveFranchises(next);
    if (activeId === id) {
      setActiveId(next[0]?.id ?? '');
      setActiveEntryId(null);
    }
  };

  const selectFranchise = (id: string, entryId: string | null = null) => {
    setActiveId(id);
    setActiveEntryId(entryId);
    setOpenDropdown(null);
  };

  const active = franchises.find((f) => f.id === activeId);
  const activeEntry = activeEntryId
    ? active?.entries?.find((e) => e.id === activeEntryId) ?? null
    : null;
  const currentItems = itemsMap[scrapeKey(activeId, activeEntryId)];

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh', color: 'var(--c-text)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── グローバルタブバー ── */}
      {franchises.length > 0 && (
        <header style={{
          background: 'var(--c-bg2)', borderBottom: '1px solid var(--c-border)',
          padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div
            ref={dropdownRef}
            style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 4, height: 52, overflowX: 'auto', position: 'relative' }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--c-accent)', marginRight: 8, flexShrink: 0 }}>
              FavoriteFind
            </span>

            {franchises.map((f) => {
              const isActive    = activeId === f.id;
              const hasEntries  = (f.entries?.length ?? 0) > 0;
              const isDropOpen  = openDropdown === f.id;

              return (
                <div key={f.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {/* 作品名タブ */}
                  <button
                    onClick={() => selectFranchise(f.id, null)}
                    style={{
                      background: isActive && !activeEntryId ? 'var(--c-bg4)' : 'transparent',
                      color: isActive ? 'var(--c-text)' : 'var(--c-text2)',
                      border: isActive ? '1px solid var(--c-border)' : '1px solid transparent',
                      borderRadius: hasEntries ? '6px 0 0 6px' : '6px 0 0 6px',
                      padding: '4px 12px',
                      fontSize: '0.82rem', cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                      whiteSpace: 'nowrap',
                      borderRight: 'none',
                    }}
                  >
                    {f.name.length > 10 ? f.name.slice(0, 10) + '…' : f.name}
                    {/* アクティブかつエントリが選択されている場合、エントリ名を表示 */}
                    {isActive && activeEntry && (
                      <span style={{ color: 'var(--c-accent)', marginLeft: 4, fontSize: '0.72rem' }}>
                        {activeEntry.label.length > 8 ? activeEntry.label.slice(0, 8) + '…' : activeEntry.label}
                      </span>
                    )}
                  </button>

                  {/* ▾ ディレクトリ展開ボタン（エントリがある場合のみ） */}
                  {hasEntries && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDropOpen) { setOpenDropdown(null); return; }
                        const r = e.currentTarget.getBoundingClientRect();
                        setDropPos({ left: r.left, top: r.bottom + 4 });
                        setOpenDropdown(f.id);
                      }}
                      style={{
                        background: isActive ? 'var(--c-bg4)' : 'transparent',
                        border: isActive ? '1px solid var(--c-border)' : '1px solid transparent',
                        borderLeft: isActive ? '1px solid var(--c-border)' : '1px solid transparent',
                        color: isDropOpen ? 'var(--c-accent)' : 'var(--c-text3)',
                        borderRadius: '0 6px 6px 0',
                        padding: '4px 6px', fontSize: '0.7rem', cursor: 'pointer',
                        transform: isDropOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s',
                      }}
                    >
                      ▾
                    </button>
                  )}

                  {/* エントリがない場合の削除ボタン（最後の1件も削除可。全削除で初期画面へ） */}
                  {!hasEntries && (
                    <button
                      onClick={() => handleRemove(f.id)}
                      title="削除"
                      style={{
                        background: isActive ? 'var(--c-bg4)' : 'transparent',
                        border: isActive ? '1px solid var(--c-border)' : '1px solid transparent',
                        borderLeft: 'none',
                        color: 'var(--c-text3)', borderRadius: '0 6px 6px 0',
                        padding: '4px 6px', fontSize: '0.7rem', cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}

                  {/* ドロップダウンメニュー（position:fixed でタブバーの overflow を回避） */}
                  {isDropOpen && hasEntries && dropPos && (
                    <div style={{
                      position: 'fixed', top: dropPos.top, left: dropPos.left,
                      background: 'var(--c-bg2)', border: '1px solid var(--c-border)',
                      borderRadius: 8, minWidth: 200, zIndex: 50,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden',
                    }}>
                      {/* 全体 */}
                      <button
                        onClick={() => selectFranchise(f.id, null)}
                        style={dropItemStyle(isActive && activeEntryId === null)}
                      >
                        <span style={{ fontSize: '0.8rem' }}>📂</span>
                        <span>全体</span>
                      </button>
                      <div style={{ height: 1, background: 'var(--c-border)', margin: '2px 0' }} />
                      {/* 各エントリ */}
                      {(f.entries ?? []).map((entry: FranchiseEntry) => (
                        <button
                          key={entry.id}
                          onClick={() => selectFranchise(f.id, entry.id)}
                          style={dropItemStyle(isActive && activeEntryId === entry.id)}
                        >
                          <span style={{ fontSize: '0.75rem', color: 'var(--c-text3)' }}>└</span>
                          <span style={{ fontSize: '0.82rem', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.label}
                          </span>
                        </button>
                      ))}
                      {/* 削除（最後の1件も削除可） */}
                      {(
                        <>
                          <div style={{ height: 1, background: 'var(--c-border)', margin: '2px 0' }} />
                          <button
                            onClick={() => handleRemove(f.id)}
                            style={{ ...dropItemStyle(false), color: 'var(--c-red)' }}
                          >
                            <span style={{ fontSize: '0.75rem' }}>🗑</span>
                            <span>削除</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

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

            {/* テーマ切り替え */}
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'ライトモード' : 'ダークモード'}
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
        <div style={{
          maxWidth: 520, margin: '0 auto', padding: '5rem 1.5rem 3rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
        }}>
          <div style={{ position: 'fixed', top: 16, right: 16 }}>
            <button
              onClick={toggle}
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
      ) : active && currentItems ? (
        <Feed key={scrapeKey(activeId, activeEntryId)} franchise={active} initialItems={currentItems} />
      ) : active ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--c-text3)' }}>読み込み中…</div>
      ) : null}

      {showModal && (
        <AddFranchiseModal onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

const dropItemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '8px 12px',
  background: active ? 'var(--c-bg4)' : 'transparent',
  border: 'none', color: active ? 'var(--c-text)' : 'var(--c-text2)',
  cursor: 'pointer', fontSize: '0.85rem', fontWeight: active ? 600 : 400,
});
