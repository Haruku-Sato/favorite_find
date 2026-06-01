'use client';

import { useState, useEffect, useRef } from 'react';
import type { FranchiseConfig, CharacterDef, SourceConfig } from '@/lib/franchise';

interface Props {
  onAdd: (f: FranchiseConfig) => void;
  onClose: () => void;
}

type Step = 'input' | 'searching' | 'confirm' | 'error';

interface Suggestion {
  title: string;
  thumb: string;
}

export default function AddFranchiseModal({ onAdd, onClose }: Props) {
  const [name, setName]         = useState('');
  const [step, setStep]         = useState<Step>('input');
  const [draft, setDraft]       = useState<FranchiseConfig | null>(null);
  const [errMsg, setErrMsg]     = useState('');

  // 編集用ローカル state
  const [editChars, setEditChars]     = useState<CharacterDef[]>([]);
  const [editSources, setEditSources] = useState<SourceConfig[]>([]);

  // サジェスト
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggFocus, setSuggFocus]     = useState(-1);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef                      = useRef<HTMLInputElement>(null);

  // 入力変化 → Jikan API でサジェスト取得（400ms デバウンス）
  useEffect(() => {
    if (step !== 'input' && step !== 'error') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(trimmed)}&limit=6&sfw=true`,
        );
        const json = await res.json();
        const items: Suggestion[] = (json.data ?? []).map((a: Record<string, unknown>) => ({
          title: (a.title_japanese as string) || (a.title as string) || '',
          thumb: (a.images as Record<string, Record<string, string>>)?.jpg?.small_image_url ?? '',
        })).filter((s: Suggestion) => s.title);
        setSuggestions(items);
        setSuggFocus(-1);
      } catch {
        // ネットワークエラーは無視
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, step]);

  const selectSuggestion = (title: string) => {
    setName(title);
    setSuggestions([]);
    setSuggFocus(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME変換中（かな→漢字など）はすべて無視
    if (e.nativeEvent.isComposing) return;

    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggFocus((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggFocus((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Escape') {
        setSuggestions([]);
        return;
      }
      if (e.key === 'Enter' && suggFocus >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[suggFocus].title);
        return;
      }
    }
    if (e.key === 'Enter') handleSearch();
  };

  const handleSearch = async () => {
    if (!name.trim()) return;
    setSuggestions([]);
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

  const removeChar   = (i: number) => setEditChars((prev) => prev.filter((_, idx) => idx !== i));
  const removeSource = (i: number) => setEditSources((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--c-bg2)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '1.5rem', width: 480, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--c-text)' }}>作品を追加</h2>

        {/* ── 検索入力 ── */}
        {(step === 'input' || step === 'error') && (
          <>
            {/* 入力 + サジェストをまとめるラッパー */}
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <input
                ref={inputRef}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                placeholder="例: ヒロアカ、鬼滅の刃、推しの子"
                style={inputStyle}
              />

              {/* サジェストドロップダウン */}
              {suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
                  background: 'var(--c-bg3)', border: '1px solid var(--c-border)', borderRadius: 6,
                  zIndex: 20, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={() => selectSuggestion(s.title)}
                      onMouseEnter={() => setSuggFocus(i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '7px 12px',
                        background: i === suggFocus ? 'var(--c-bg4)' : 'transparent',
                        border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--c-bg4)' : 'none',
                        color: 'var(--c-text)', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left',
                      }}
                    >
                      {s.thumb && (
                        <img
                          src={s.thumb}
                          alt=""
                          style={{ width: 24, height: 34, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
                        />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {step === 'error' && (
              <p style={{ color: 'var(--c-red)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{errMsg}</p>
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
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--c-text2)', fontSize: '0.88rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
            「{name}」を検索中…<br />
            <small style={{ color: 'var(--c-text3)' }}>公式サイト・くじページ・キャラクターを探しています</small>
          </div>
        )}

        {/* ── 確認・編集 ── */}
        {step === 'confirm' && draft && (
          <>
            <p style={{ color: 'var(--c-accent)', fontWeight: 600, marginBottom: '1rem', fontSize: '0.9rem' }}>
              {draft.name}
            </p>

            {/* ソース */}
            <section style={{ marginBottom: '1rem' }}>
              <label style={sectionLabel}>情報ソース</label>
              {editSources.length === 0 && (
                <p style={{ color: 'var(--c-text3)', fontSize: '0.82rem' }}>見つかりませんでした</p>
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
                <p style={{ color: 'var(--c-text3)', fontSize: '0.82rem' }}>キャラクターを検出できませんでした（後から編集可）</p>
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
  width: '100%', background: 'var(--c-bg)', border: '1px solid var(--c-border)',
  borderRadius: 6, padding: '8px 12px', color: 'var(--c-text)', fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box',
};
const ghostBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--c-border)', color: 'var(--c-text2)',
  borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', cursor: 'pointer',
};
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? 'var(--c-bg4)' : 'var(--c-blue)', color: disabled ? 'var(--c-text3)' : 'white',
  border: 'none', borderRadius: 6, padding: '6px 16px',
  fontSize: '0.82rem', cursor: disabled ? 'default' : 'pointer', fontWeight: 600,
});
const xBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--c-text3)',
  cursor: 'pointer', fontSize: '0.72rem', padding: '0 2px', lineHeight: 1,
};
const sectionLabel: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: 'var(--c-text2)',
  fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const badge = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600,
});
