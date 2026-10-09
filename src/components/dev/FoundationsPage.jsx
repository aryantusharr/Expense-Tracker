import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { CATEGORY_ICONS, resolveCategoryIcon } from '../../design/categoryIcons';
import { haptic, prefersReducedMotion } from '../../utils/haptics';
import Button, { IconButton } from '../ui/Button';
import Chip, { ChipDot } from '../ui/Chip';
import CategoryIcon, { LineIcon } from '../ui/CategoryIcon';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';

// Dev/test-only preview of the redesign foundations (never in the production build).
// Open /foundations on the phone to check colours, type, icons and motion against the canvas.

const SWATCHES = [
  ['bg', '--se-bg'], ['surface', '--se-surface'], ['sheet', '--se-sheet'], ['text', '--se-text'],
  ['text-2', '--se-text-2'], ['text-3', '--se-text-3'], ['violet', '--se-violet'], ['violet-2', '--se-violet-2'],
  ['teal', '--se-teal'], ['teal-2', '--se-teal-2'], ['pink', '--se-pink'], ['pink-2', '--se-pink-2'],
];

// The real category names in use today (from the live data shape).
const REAL_CATEGORIES = [
  ['Groceries', '🛒'], ['Rent', '🏡'], ['Utilities', '⚡'], ['Food & Dining', '🍽️'], ['Transport', '🚕'],
  ['Entertainment', '🎭'], ['Shopping', '🛍️'], ['Health', '💊'], ['Drinks & Alcohol', '🍻'], ['Smoking', '🚬'],
  ['Subscriptions', '📱'], ['Coffee & Tea', '☕'], ['Party & Nightlife', '🪩'], ['Others', '📦'], ['Snacks', '☕'],
  ['Home Needs', '🧹'], ['Weed', '🌿'], ['Medical', '💊'], ['gym', '🏋️'], ['Saving', '💰'], ['Apple watch', '📱'],
];

const MOVES = ['pop', 'print', 'stamp', 'tear', 'shake'];

function Section({ title, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="se-mono" style={{ margin: 0, fontSize: 11, letterSpacing: '.14em', color: 'var(--se-text-3)', fontWeight: 500 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function MoveDemo({ move, run }) {
  const box = { height: 56, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 };
  if (move === 'tear') {
    return (
      <div key={run} style={{ display: 'flex', gap: 2 }}>
        <div className={run ? 'se-tear-l' : ''} style={{ ...box, flex: 1, background: 'var(--se-surface-2)' }}>Din</div>
        <div className={run ? 'se-tear-r' : ''} style={{ ...box, flex: 1, background: 'var(--se-surface-2)' }}>ner</div>
      </div>
    );
  }
  if (move === 'stamp') {
    return (
      <div style={{ ...box, background: 'var(--se-surface-2)' }}>
        <span key={run} className="se-stamp se-mono" style={{ border: '2px solid var(--se-teal)', color: 'var(--se-teal)', padding: '2px 8px', borderRadius: 4, letterSpacing: '.12em' }}>
          COPIED
        </span>
      </div>
    );
  }
  if (move === 'print') {
    return (
      <div key={run} className="se-print se-mono" style={{ ...box, background: '#FBFAFF', color: '#15142B', borderRadius: 6 }}>
        RECEIPT · Dinner · ₹640
      </div>
    );
  }
  return (
    <div key={run} className={`se-${move}`} style={{ ...box, background: 'var(--se-grad-primary)', color: 'var(--se-on-accent)' }}>
      {move}
    </div>
  );
}

export default function FoundationsPage() {
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [payer, setPayer] = useState('A');
  const [runs, setRuns] = useState({});
  const [picked, setPicked] = useState('food');
  const reduced = prefersReducedMotion();

  const replay = m => { haptic(m === 'shake' ? 'error' : 'tap'); setRuns(r => ({ ...r, [m]: (r[m] || 0) + 1 })); };

  return (
    <div className="se-page" style={{ padding: '24px 16px 140px' }}>
      <span className="se-orb se-orb-1" style={{ width: 300, height: 300, left: -120, top: -60, background: 'rgba(139,124,255,0.35)' }} />
      <span className="se-orb se-orb-2" style={{ width: 280, height: 280, right: -140, top: 360, background: 'rgba(95,212,196,0.28)' }} />
      <span className="se-orb se-orb-3" style={{ width: 220, height: 220, left: 40, bottom: -80, background: 'rgba(255,143,181,0.22)' }} />

      <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="se-mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--se-text-3)' }}>REDESIGN · PHASE 2</div>
            <h1 className="se-display" style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>Foundations</h1>
          </div>
          <Button variant="secondary" size="sm" onClick={toggleTheme}>{theme === 'dark' ? 'Light' : 'Dark'} mode</Button>
        </header>

        <Section title="TYPE">
          <div className="se-glass" style={{ borderRadius: 'var(--se-r-2xl)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="se-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'var(--se-text-3)' }}>TOTAL EXPENSES</span>
            <span className="se-display se-grad-text" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>₹3,81,791</span>
            <span style={{ fontSize: 15 }}>Sora — body &amp; UI. What was it for?</span>
            <span className="se-mono" style={{ fontSize: 14, fontWeight: 700 }}>JetBrains Mono — ₹1,32,725 · K7M2QX</span>
            <span style={{ display: 'flex', gap: 16 }}>
              <span className="se-display se-grad-text-r" style={{ fontSize: 22, fontWeight: 800 }}>+₹5,116</span>
              <span className="se-display se-grad-text-neg" style={{ fontSize: 22, fontWeight: 800 }}>−₹3,295</span>
            </span>
          </div>
        </Section>

        <Section title="COLOUR">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {SWATCHES.map(([name, v]) => (
              <div key={v} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ height: 44, borderRadius: 12, background: `var(${v})`, border: '1px solid var(--se-line)' }} />
                <span className="se-mono" style={{ fontSize: 9.5, color: 'var(--se-text-3)' }}>{name}</span>
              </div>
            ))}
          </div>
          <span style={{ height: 44, borderRadius: 999, background: 'var(--se-grad-primary)' }} />
        </Section>

        <Section title="BUTTONS">
          <Button size="lg" block onClick={() => toast({ message: <><b>Saved</b> · ₹640 Dinner</>, kind: 'success' })}>Slide to add · primary</Button>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" style={{ flex: 1 }}>Cancel</Button>
            <Button style={{ flex: 1.5 }}>Save changes</Button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="ghost">Ghost</Button>
            <Button variant="soft" size="sm">Undo</Button>
            <Button variant="danger" size="sm">Delete</Button>
            <Button disabled>Disabled</Button>
            <IconButton label="Close"><LineIcon path="M6 6l12 12M18 6 6 18" size={20} strokeWidth={2} /></IconButton>
          </div>
        </Section>

        <Section title="CHIPS">
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {['All', 'Food & Dining', 'Groceries', 'Rent', 'Transport'].map(c => (
              <Chip key={c} selected={filter === c} onClick={() => setFilter(c)}>{c}</Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['A', '#8B7CFF'], ['B', '#5FD4C4'], ['C', '#FF8FB5']].map(([n, c]) => (
              <Chip key={n} selected={payer === n} onClick={() => setPayer(n)} leading={<ChipDot color={c}>{n}</ChipDot>}>
                Test {n}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={`CATEGORY ICONS · A LINE (${CATEGORY_ICONS.length})`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px 6px' }}>
            {CATEGORY_ICONS.map(i => (
              <button
                key={i.key}
                type="button"
                className="se-press"
                onClick={() => { haptic('choose'); setPicked(i.key); }}
                aria-pressed={picked === i.key}
                style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
              >
                <span style={{ borderRadius: 18, boxShadow: picked === i.key ? `0 0 0 2px var(--se-bg), 0 0 0 4px ${i.color}, 0 0 20px ${i.color}` : 'none', transform: picked === i.key ? 'scale(1.08)' : 'none', transition: 'transform .35s var(--se-ease-strong), box-shadow .3s' }}>
                  <CategoryIcon iconKey={i.key} />
                </span>
                <span style={{ fontSize: 9.5, color: 'var(--se-text-2)', whiteSpace: 'nowrap' }}>{i.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="YOUR CATEGORIES → ICON">
          <div className="se-glass" style={{ borderRadius: 'var(--se-r-xl)', padding: 8, display: 'flex', flexDirection: 'column' }}>
            {REAL_CATEGORIES.map(([name, emoji]) => {
              const icon = resolveCategoryIcon({ name, icon: emoji });
              const fallback = icon.key === 'other' && !/other/i.test(name);
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px' }}>
                  <CategoryIcon category={{ name, icon: emoji }} size={36} />
                  <span style={{ flex: 1, fontSize: 14 }}>{name}</span>
                  <span className="se-mono" style={{ fontSize: 10, color: fallback ? 'var(--se-pink-2)' : 'var(--se-text-3)' }}>
                    {fallback ? 'NO ICON YET' : icon.label.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title={`MOTION · CORE MOVES${reduced ? ' · REDUCE MOTION ON' : ''}`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {MOVES.map(m => (
              <button key={m} type="button" onClick={() => replay(m)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}>
                <MoveDemo move={m} run={runs[m] || 0} />
                <span className="se-mono" style={{ fontSize: 10, color: 'var(--se-text-3)' }}>TAP TO REPLAY · {m.toUpperCase()}</span>
              </button>
            ))}
            <button type="button" onClick={() => setSheetOpen(true)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}>
              <div style={{ height: 56, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, border: '1px dashed var(--se-line-2)' }}>open sheet</div>
              <span className="se-mono" style={{ fontSize: 10, color: 'var(--se-text-3)' }}>TAP · SHEET</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => toast({ message: <><b>Dinner</b> torn off · ₹640</>, sub: 'Also removed from Test J’s room', action: { label: 'Undo', onClick: () => toast({ message: 'Restored', kind: 'success', duration: 2000 }) } })}
            >
              Toast + Undo
            </Button>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => toast({ message: <><b>NO ROOM</b> with that code</>, sub: 'Check the 6 letters and try again', kind: 'error' })}
            >
              Error toast
            </Button>
          </div>
        </Section>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters">
        <span style={{ fontSize: 13, color: 'var(--se-text-2)' }}>Drag the handle down, tap outside, or press a button to close.</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['This month', 'Test A paid', 'Food & Dining', 'Over ₹500'].map(c => <Chip key={c}>{c}</Chip>)}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={() => setSheetOpen(false)}>Cancel</Button>
          <Button style={{ flex: 1.5 }} onClick={() => setSheetOpen(false)}>Apply</Button>
        </div>
      </Sheet>
    </div>
  );
}
