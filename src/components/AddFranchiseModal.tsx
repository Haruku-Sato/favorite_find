'use client';

import { useState } from 'react';
import type { FranchiseConfig, CharacterDef, SourceConfig } from '@/lib/franchise';

interface Props {
  onAdd: (f: FranchiseConfig) => void;
  onClose: () => void;
}

type Step = 'input' | 'searching' | 'confirm' | 'error';

export default function AddFranchiseModal({ onAdd, onClose }: Props) {
  const [name, setName]         = useState('');
  const [step, setStep]         = useState<Step>('input');
  const [draft, setDraft]       = useState<FranchiseConfig | null>(null);
  const [errMsg, setErrMsg]     = useState('');

  // 編集用ローカル state
  const [editChars, setEditChars]     = useState<CharacterDef[]>([]);
  const [editSources, setEditSources] = useState<SourceConfig[]>([]);

  const handleSearch = async () => {
    if (!name.trim()) return;
    setStep('searching');
    try {
      const res = await fetch('/api/franchise/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const config: FranchiseConfig = await res.json();
      setDraft(config);
      setEditChars(config.characters);
      setEditSources(config.sources);
      setStep('confirm');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : '検索に失敗しました');
      setStep('error');
    }
  };

  const handleAdd = () => {
    if (!draft) return;
    onAdd({ ...draft, characters: editChars, sources: editSources });
    onClose();
  };

  const removeChar = (i: number) =>
    setEditChars((prev) => prev.filter((_, idx) => idx !== i));

  const removeSource = (i: number) =>
    setEditSources((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '1.5rem', width: 480, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#e6edf3' }}>作品を追加</h2>

        {/* ── 検索入力 ── */}
        {(step === 'input' || step === 'error') && (
          <>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="例: ヒロアカ、鬼滅の刃、推しの子"
              style={{ ...inputStyle, marginBottom: '0.75rem' }}
            />
            {step === 'error' && (
              <p style={{ color: '#f85149', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{errMsg}</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={ghostBtn}>キャンセル</button>
              <button onClick={handleSearch} disabled={!name.trim()} style={primaryBtn(!name.trim())}>
                検索
              </button>
            </div>
          </>
        )}

        {/* ── 検索中 ── */}
        {step === 'searching' && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#8b949e', fontSize: '0.88rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
            「{name}」を検索中…<br />
            <small style={{ color: '#484f58' }}>公式サイト・くじページ・キャラクターを探しています</small>
          </div>
        )}

        {/* ── 確認・編集 ── */}
        {step === 'confirm' && draft && (
          <>
            <p style={{ color: '#58a6ff', fontWeight: 600, marginBottom: '1rem', fontSize: '0.9rem' }}>
              {draft.name}
            </p>

            {/* ソース */}
            <section style={{ marginBottom: '1rem' }}>
              <label style={sectionLabel}>情報ソース</label>
              {editSources.length === 0 && (
                <p style={{ color: '#484f58', fontSize: '0.82rem' }}>見つかりませんでした</p>
              )}
              {editSources.map((src, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ ...badge('#1a2f4a', '#58a6ff') }}>{src.label}</span>
                  <a href={src.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#8b949e', fontSize: '0.78rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {src.url}
                  </a>
                  <button onClick={() => removeSource(i)} style={xBtn}>✕</button>
                </div>
              ))}
            </section>

            {/* キャラクター */}
            <section style={{ marginBottom: '1.25rem' }}>
              <label style={sectionLabel}>検出されたキャラクター</label>
              {editChars.length === 0 && (
                <p style={{ color: '#484f58', fontSize: '0.82rem' }}>キャラクターを検出できませんでした（後から編集可）</p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {editChars.map((c, i) => (
                  <span key={i} style={{ ...badge('#21262d', '#e6edf3'), display: 'flex', alignItems: 'center', gap: 4 }}>
                    {c.name}
                    <button onClick={() => removeChar(i)} style={{ ...xBtn, fontSize: '0.6rem' }}>✕</button>
                  </span>
                ))}
              </div>
            </section>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep('input')} style={ghostBtn}>戻る</button>
              <button onClick={handleAdd} style={primaryBtn(false)}>追加</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── スタイル定数 ─────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0d1117', border: '1px solid #30363d',
  borderRadius: 6, padding: '8px 12px', color: '#e6edf3', fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box',
};
const ghostBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #30363d', color: '#8b949e',
  borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', cursor: 'pointer',
};
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? '#21262d' : '#1f6feb', color: disabled ? '#484f58' : 'white',
  border: 'none', borderRadius: 6, padding: '6px 16px',
  fontSize: '0.82rem', cursor: disabled ? 'default' : 'pointer', fontWeight: 600,
});
const xBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#484f58',
  cursor: 'pointer', fontSize: '0.72rem', padding: '0 2px', lineHeight: 1,
};
const sectionLabel: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: '#8b949e',
  fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const badge = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600,
});
