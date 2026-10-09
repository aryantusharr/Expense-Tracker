import { useEffect, useMemo, useState } from 'react';
import { haptic } from '../../../utils/haptics';
import { TextField } from '../../ui/Keyboard';
import CategoryIcon from '../../ui/CategoryIcon';
import { evalExpr } from '../../add/amountExpr';
import { cleanName } from '../../../aai/common.js';
import { billTotals, syncRest, liveItems, dayLabel, uid } from '../../../aai/chatModel.js';
import { billMismatch } from '../../../aai/billParse.js';
import { Mg, IcTag } from './parts';
import { LineIcon } from '../../ui/CategoryIcon';
import { resolveCategoryIcon } from '../../../design/categoryIcons';
import { toDateStr, addDays, MONTH_NAMES, fromDateStr } from '../../../aai/common.js';

/**
 * AAI chat cards (boards AAI-Chat-4 / -6 / -09 / -10B). Every value on a card is its own tap target —
 * no row taps, no chevrons — and only the tapped one opens (numpad, keypad on the word, name chips,
 * category picker, date strip). The dotted underline marks the first card in a chat and anything AAI is unsure about.
 * When saved: a big ADDED stamp over the left label column, SAVED TO <ROOM> + Undo with a 5s shrinking bar, then it locks.
 */

export const UNDO_MS = 5000;

const fmtAmt = n => (n > 0 ? (Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '—');
const each = (amount, n) => (n ? fmtAmt(Math.round((amount / n) * 100) / 100) : '—');
const upDay = (d, now) => dayLabel(d, now).toUpperCase();

/** A tappable value. locked (saved) → plain text. */
function Val({ id, dots, locked, on, onClick, label, children, className = '' }) {
  if (locked) return <span className={`ch-val is-locked ${className}`}><span>{children}</span></span>;
  const dotted = dots.includes('all') || dots.includes(id);
  return (
    <button type="button" className={`ch-val ${on ? 'is-on' : ''} ${className}`} aria-label={label} aria-expanded={on}
      onClick={() => { haptic('tap'); onClick(); }}>
      <span className={dotted ? 'ch-ed' : ''}>{children}</span>
    </button>
  );
}

function Row({ k, children, editor }) {
  return (
    <>
      <div className="ch-fr"><span className="ch-k">{k}</span><span className="ch-v">{children}</span></div>
      {editor}
    </>
  );
}

// ── option grids: equal columns, 40px tall, 44px hit area ──
const cols = n => ({ gridTemplateColumns: `repeat(${Math.min(n, 4)}, 1fr)` });

function PersonGrid({ members, meId, selected, multi, onToggle, onAll, label }) {
  const opts = members.length + (multi ? 1 : 0);
  return (
    <div className="ch-edit" role="group" aria-label={label}>
      <div className="ch-og" style={cols(opts)}>
        {members.map(m => {
          const on = selected.includes(m.id);
          return (
            <button key={m.id} type="button" className={`ch-pchip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => { haptic('choose'); onToggle(m.id); }}>
              <Mg m={m} dim={!on && multi} /><span>{m.id === meId ? 'You' : cleanName(m.name)}</span>
            </button>
          );
        })}
        {multi && <button type="button" className={`ch-pchip ${selected.length === members.length ? 'on' : ''}`} aria-pressed={selected.length === members.length} onClick={() => { haptic('choose'); onAll(); }}>All</button>}
      </div>
    </div>
  );
}

function CatGrid({ categories, value, onPick }) {
  return (
    <div className="ch-edit" role="radiogroup" aria-label="Category">
      <div className="ch-og ch-og--cat" style={cols(2)}>
        {categories.map(c => (
          <button key={c.id} type="button" role="radio" aria-checked={value === c.id} className={`ch-pchip ${value === c.id ? 'on' : ''}`}
            onClick={() => { haptic('choose'); onPick(c.id); }}>
            <CategoryIcon category={c} size={22} /><span>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DateGrid({ value, now, onPick }) {
  const days = useMemo(() => [0, 1, 2].map(n => toDateStr(addDays(now, -n))), [now]);
  const custom = !days.includes(value);
  const short = d => { const x = fromDateStr(d); return `${x.getDate()} ${MONTH_NAMES[x.getMonth()]}`; };
  return (
    <div className="ch-edit" role="radiogroup" aria-label="Date">
      <div className="ch-og" style={cols(4)}>
        {days.map((d, i) => (
          <button key={d} type="button" role="radio" aria-checked={value === d} className={`ch-pchip ${value === d ? 'on' : ''}`} onClick={() => { haptic('choose'); onPick(d); }}>
            {i === 0 ? 'Today' : i === 1 ? 'Yday' : short(d)}
          </button>
        ))}
        <label className={`ch-pchip ch-datepick ${custom ? 'on' : ''}`}>
          {custom ? short(value) : 'Pick'}
          <input type="date" value={value} max={toDateStr(now)} aria-label="Pick a date" onChange={e => e.target.value && onPick(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

const STEPS = [-50, -10, 10, 50];

/** Amount shown as a big number; while editing it becomes a numpad field (with +/− chips above the keys). */
function AmountEdit({ value, onChange, onClose, small }) {
  const [s, setS] = useState(() => (value > 0 ? String(Math.round(value * 100) / 100) : ''));
  const set = str => { setS(str); onChange(evalExpr(str)); };
  const bump = d => { haptic('tap'); const next = Math.max(0, Math.round(((evalExpr(s) || 0) + d) * 100) / 100); setS(next ? String(next) : ''); onChange(next); };
  return (
    <TextField kind="amount" value={s} onChange={set} autoFocus className={`ch-inl ch-inl--amt ${small ? 'is-small' : ''}`} placeholder="0"
      prefix={<span className="ch-r">₹</span>} onDone={onClose} aria-label="Amount"
      slotContent={(
        <div className="ch-bumps" role="group" aria-label="Adjust amount">
          {STEPS.map(d => <button key={d} type="button" className="ch-bump" onClick={() => bump(d)}>{d > 0 ? `+${d}` : `−${-d}`}</button>)}
        </div>
      )} />
  );
}

export function TextEdit({ value, onChange, onClose, label, caps = 'sentences', className = '' }) {
  return <TextField value={value} onChange={onChange} autoFocus caps={caps} maxLength={60} className={`ch-inl ${className}`} onDone={onClose} aria-label={label} slotContent={null} />;
}

// ── saved state ──
function Stamp({ card, roomName, date, top, bill }) {
  const onPhone = card.status === 'onphone';
  const d = fromDateStr(date);
  return (
    <div className={`ch-stamp ${onPhone ? 'is-amber' : ''} ${bill ? 'ch-stamp--bill' : ''}`} style={{ '--st-top': `${top}px` }} aria-hidden="true">
      <span className="ch-stamp__s">{onPhone ? 'ON PHONE' : `${roomName} · ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`.toUpperCase()}</span>
      <span className="ch-stamp__b">{onPhone ? 'SAVED' : 'ADDED'}</span>
      <span className="ch-stamp__s">★ SPLITEASE ★</span>
    </div>
  );
}

function SavedFooter({ card, roomName, onUndo, onOpen, readOnly }) {
  const [left, setLeft] = useState(() => Math.max(0, UNDO_MS - (Date.now() - (card.savedAt || 0))));
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft(0), left);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPhone = card.status === 'onphone';
  const can = !onPhone && !readOnly && card.ids?.length > 0 && left > 0;
  const canOpen = !onPhone && !can && !!onOpen;
  const at = new Date(card.savedAt || 0).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toUpperCase();
  return (
    <div className="ch-saved">
      <span className="ch-mono ch-saved__t">{onPhone ? 'WILL SYNC WHEN ONLINE' : `SAVED TO ${(roomName || '').toUpperCase()} · ${left > 0 ? 'JUST NOW' : at}`}</span>
      {can && <button type="button" className="ch-undo" onClick={() => { haptic('tap'); onUndo(); }}>Undo</button>}
      {canOpen && <button type="button" className="ch-open" onClick={() => { haptic('tap'); onOpen(); }}>Open in History<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
      {can && <span className="ch-saved__bar" aria-hidden="true" style={{ '--f': left / UNDO_MS, animationDuration: `${left}ms` }} />}
    </div>
  );
}

const isSaved = c => c.status === 'saved' || c.status === 'onphone';

/** An old chat's card that was never added: it can't be confirmed any more. */
function NotAdded() {
  return <div className="ch-notadded ch-mono">NOT ADDED · THIS CHAT IS READ ONLY</div>;
}

// ── quick card ──
export function QuickCard({ card, onChange, members, categories, meId, isPersonal, roomName, now, onConfirm, onUndo, readOnly = false, onOpen }) {
  const [ed, setEd] = useState(null);
  const { draft, dots } = card;
  const locked = isSaved(card) || readOnly;
  const saving = card.status === 'saving';
  const set = patch => onChange({ ...card, draft: { ...draft, ...patch } });
  const open = k => setEd(e => (e === k ? null : k));
  const cat = categories.find(c => c.id === draft.categoryId);
  const payer = members.find(m => m.id === draft.paidBy);
  const split = draft.splitAmong || [];
  const inSplit = members.filter(m => split.includes(m.id));
  const ok = draft.amount > 0 && (isPersonal || (draft.paidBy && split.length > 0));
  const common = { dots, locked };

  return (
    <div className={`ch-card ch-quick ${locked ? 'is-saved' : ''}`}>
      <div className="ch-amt">
        <span className="ch-lab">AMOUNT</span>
        {ed === 'amount' && !locked ? (
          <AmountEdit value={draft.amount} onChange={a => set({ amount: a })} onClose={() => setEd(null)} />
        ) : (
          <Val {...common} id="amount" label="Change amount" onClick={() => open('amount')}><span className="ch-un ch-amt__v"><span className="ch-r">₹</span>{fmtAmt(draft.amount)}</span></Val>
        )}
      </div>
      <Row k="DESCRIPTION">
        {ed === 'desc' && !locked
          ? <TextEdit value={draft.description} onChange={v => set({ description: v })} onClose={() => setEd(null)} label="Description" />
          : <Val {...common} id="description" label="Change description" onClick={() => open('desc')}>{draft.description || 'Add a name'}</Val>}
      </Row>
      {!isPersonal && (
        <>
          <Row k="PAID BY" editor={ed === 'paid' && !locked && (
            <PersonGrid label="Who paid" members={members} meId={meId} selected={draft.paidBy ? [draft.paidBy] : []} onToggle={id => { set({ paidBy: id }); setEd(null); }} />
          )}>
            <Val {...common} id="paidBy" on={ed === 'paid'} label="Change who paid" onClick={() => open('paid')}>
              {payer ? <><Mg m={payer} /><span>{payer.id === meId ? 'You' : cleanName(payer.name)}</span></> : 'Who paid?'}
            </Val>
          </Row>
          <Row k="SPLIT" editor={ed === 'split' && !locked && (
            <PersonGrid multi label="Who is in the split" members={members} meId={meId} selected={split}
              onToggle={id => set({ splitAmong: split.includes(id) ? (split.length > 1 ? split.filter(x => x !== id) : split) : members.map(m => m.id).filter(x => x === id || split.includes(x)) })}
              onAll={() => set({ splitAmong: members.map(m => m.id) })} />
          )}>
            <Val {...common} id="split" on={ed === 'split'} label="Change who is in the split" onClick={() => open('split')}>
              {inSplit.map(m => <Mg key={m.id} m={m} />)}<span>{split.length ? `₹${each(draft.amount, split.length)} each` : 'Pick'}</span>
            </Val>
          </Row>
        </>
      )}
      <Row k="DATE" editor={ed === 'date' && !locked && <DateGrid value={draft.date} now={now} onPick={d => { set({ date: d, dateGiven: true }); setEd(null); }} />}>
        <Val {...common} id="date" on={ed === 'date'} label="Change date" onClick={() => open('date')}>{dayLabel(draft.date, now)}</Val>
      </Row>
      <Row k="CATEGORY" editor={ed === 'cat' && !locked && <CatGrid categories={categories} value={draft.categoryId} onPick={id => { set({ categoryId: id }); setEd(null); }} />}>
        <Val {...common} id="category" on={ed === 'cat'} label="Change category" onClick={() => open('cat')}>{cat?.name || 'Pick one'}</Val>
      </Row>
      {locked ? (isSaved(card) ? (
        <>
          <Stamp card={card} roomName={roomName} date={draft.date} top={84} />
          <SavedFooter card={card} roomName={roomName} onUndo={onUndo} readOnly={readOnly} onOpen={onOpen} />
        </>
      ) : <NotAdded />) : (
        <div className="ch-foot"><button type="button" className="ch-btn ch-grad" disabled={!ok || saving} onClick={() => { setEd(null); onConfirm(); }}>{saving ? 'Saving…' : 'Confirm'}</button></div>
      )}
    </div>
  );
}

// ── bill card ──
export function BillCard({ card, onChange, members, categories, meId, isPersonal, roomName, now, onConfirm, onSeparate, onUndo, readOnly = false, onOpen }) {
  const [ed, setEd] = useState(null);                      // { f, id }
  const { bill, dots } = card;
  const locked = isSaved(card) || readOnly;
  const saving = card.status === 'saving';
  const common = { dots, locked };
  const set = patch => onChange({ ...card, bill: syncRest({ ...bill, ...patch }) });
  const setItem = (id, patch) => set({ items: bill.items.map(i => (i.id === id ? { ...i, ...patch } : i)) });
  const open = (f, id = '') => setEd(e => (e && e.f === f && e.id === id ? null : { f, id }));
  const is = (f, id = '') => !!ed && ed.f === f && ed.id === id && !locked;
  const close = () => setEd(null);

  const t = billTotals(bill);
  const rows = liveItems(bill);
  const payer = members.find(m => m.id === bill.paidBy);
  const shot = bill.source === 'bill';                     // read from a screenshot: must match the bill total to save
  const mm = shot ? billMismatch(bill) : null;
  const real = shot ? rows.filter(i => !(i.failed && !(i.amount > 0))) : rows;
  const ok = real.length > 0 && real.every(i => i.amount > 0) && t.over === 0 && !(mm && mm.off)
    && (isPersonal || (bill.paidBy && real.every(i => i.splitAmong?.length)));
  /** FIX ›: the first unread line's amount; if none, the money is missing from the list → a new line for it; if items are over, the total. */
  const fix = () => {
    const f = bill.items.find(i => i.failed && !(i.amount > 0));
    if (f) { open('iamt', f.id); return; }
    if (mm.diff > 0) {
      const id = uid();
      set({ items: [...bill.items.filter(i => !i.charges), { id, name: '', failed: true, amount: mm.diff, categoryId: bill.items[0]?.categoryId || null, splitAmong: members.map(m => m.id) }, ...bill.items.filter(i => i.charges)] });
      setEd({ f: 'iname', id });
    } else open('total');
  };
  const fixNo = mm?.failed.length ? `#${mm.failed[0]}` : '';

  return (
    <div className={`ch-card ch-bill ${locked ? 'is-saved' : ''}`}>
      <div className="ch-bh">
        <div className="ch-bh__l">
          <span className="ch-lab">BILL</span>
          {is('bname') ? <TextEdit value={bill.name === 'Untitled bill' ? '' : bill.name} onChange={v => set({ name: v, nameUnsure: false })} onClose={() => { if (!bill.name.trim()) set({ name: 'Untitled bill' }); close(); }} label="Bill name" caps="words" className="ch-inl--name" />
            : <Val {...common} id="name" label="Change bill name" onClick={() => open('bname')} className="ch-un ch-bname">{bill.name}</Val>}
          <span className="ch-mono ch-meta">
            <Val {...common} id="date" on={is('date')} label="Change date" onClick={() => open('date')}>{upDay(bill.date, now)}</Val> · {shot ? `${rows.filter(i => !i.charges).length} ITEMS` : `${rows.length} ${rows.length === 1 ? 'ITEM' : 'ITEMS'}`}
          </span>
          {!isPersonal && (
            <Val locked={locked} dots={[]} id="paidBy" on={is('payer')} label="Change who paid" onClick={() => open('payer')} className="ch-payer">
              {payer ? <Mg m={payer} /> : null}<span>Paid by <span className={dots.includes('all') || dots.includes('paidBy') ? 'ch-ed' : ''}>{payer ? (payer.id === meId ? 'You' : cleanName(payer.name)) : 'who?'}</span></span>
            </Val>
          )}
        </div>
        <div className="ch-bh__r">
          <span className="ch-lab">TOTAL</span>
          {shot && is('total')
            ? <AmountEdit small value={bill.total} onChange={a => set({ total: a, totalUnsure: false })} onClose={close} />
            : shot
              ? <Val {...common} dots={bill.totalUnsure ? ['all'] : dots} id="total" label="Change bill total" onClick={() => open('total')} className="ch-un ch-bh__tot"><span className="ch-r">₹</span>{fmtAmt(t.total)}</Val>
              : <span className="ch-un ch-bh__tot"><span className="ch-r">₹</span>{fmtAmt(t.total)}</span>}
        </div>
      </div>
      {is('payer') && <PersonGrid label="Who paid" members={members} meId={meId} selected={bill.paidBy ? [bill.paidBy] : []} onToggle={id => { set({ paidBy: id }); close(); }} />}
      {is('date') && <DateGrid value={bill.date} now={now} onPick={d => { set({ date: d }); close(); }} />}
      {shot && mm.off && !locked && (
        <button type="button" className="ch-mm" onClick={() => { haptic('tap'); fix(); }}>
          <span className="ch-mm__t">
            <span className="ch-mm__h">{mm.failed.length ? `${mm.failed.length} item${mm.failed.length === 1 ? '' : 's'} failed · ${mm.failed.map(n => `#${n}`).join(', ')} on the bill` : mm.diff > 0 ? 'Some of the bill isn’t in the list' : 'The items add up to more than the bill'}</span>
            <span className="ch-mono">BILL ₹{fmtAmt(bill.total)} · ITEMS ₹{fmtAmt(mm.sum)} · ₹{fmtAmt(Math.abs(mm.diff))} NOT MATCHED</span>
          </span>
          <span className="ch-mono ch-mm__fix">FIX {fixNo}{fixNo ? ' ' : ''}›</span>
        </button>
      )}

      {rows.map((it, i) => {
        const cat = categories.find(c => c.id === it.categoryId);
        const sp = it.splitAmong || [];
        const inSplit = members.filter(m => sp.includes(m.id));
        const allIn = members.length > 0 && sp.length === members.length;
        const unsureCat = dots.includes('all') || it.unsure;
        const unread = it.failed && !(it.amount > 0) && !it.name;
        return (
          <div key={it.id} className={`ch-irw ${it.failed && !locked && !(it.amount > 0 && it.name) ? 'is-failed' : ''}`}>
            <div className="ch-ir">
              <div className="ch-ir__l">
                <span className="ch-ir__n">
                  {!it.charges && <span className="ch-mono ch-num">#{i + 1}</span>}
                  {is('iname', it.id)
                    ? <TextEdit value={it.name} onChange={v => setItem(it.id, { name: v })} onClose={close} label={`Item ${i + 1} name`} caps="words" className="ch-inl--item" />
                    : <Val {...common} dots={it.failed ? ['all'] : dots} id={it.rest ? 'rest' : 'itemname'} label={`Change item ${i + 1} name`} onClick={() => open('iname', it.id)}>{it.name || (it.failed ? 'Couldn’t read this item' : 'Item')}</Val>}
                  {it.qty && !is('iname', it.id) ? <span className="ch-mono ch-qty">{it.qty}</span> : null}
                </span>
                {unread ? <span className="ch-mono ch-ir__hint">TAP TO TYPE NAME + AMOUNT</span> : it.charges ? (
                  <span className="ch-mono ch-ir__hint">{it.detail}{!isPersonal ? ` · ${(it.splitAmong || []).length === members.length ? `ALL ${members.length}` : `${(it.splitAmong || []).length} PEOPLE`}` : ''}</span>
                ) : (
                <span className="ch-ir__m">
                  <Val locked={locked} dots={unsureCat ? ['all'] : []} id="cat" on={is('icat', it.id)} label={`Change category for ${it.name}`} onClick={() => open('icat', it.id)} className="ch-mono ch-tag">
                    {cat ? <span className="ch-tag__ic" style={{ color: resolveCategoryIcon(cat).color }}><LineIcon path={resolveCategoryIcon(cat).path} size={13} strokeWidth={2} /></span> : <IcTag />}{(cat?.name || 'Category').toUpperCase()}
                  </Val>
                  {!isPersonal && (
                    <>
                      <span className="ch-sep">·</span>
                      <Val locked={locked} dots={allIn || !inSplit.length ? dots : []} id="split" on={is('isplit', it.id)} label={`Change who splits ${it.name}`} onClick={() => open('isplit', it.id)} className="ch-mono ch-tag">
                        {allIn ? `ALL ${sp.length}` : inSplit.length ? inSplit.map(m => <Mg key={m.id} m={m} />) : 'PICK'}
                      </Val>
                    </>
                  )}
                </span>
                )}
              </div>
              {is('iamt', it.id)
                ? <AmountEdit small value={it.amount} onChange={a => setItem(it.id, { amount: a })} onClose={close} />
                : <Val {...common} id={it.rest ? 'rest' : 'amount'} label={`Change amount for ${it.name}`} onClick={() => open('iamt', it.id)} className="ch-un ch-ir__amt">{it.failed && !(it.amount > 0) ? '₹—' : `₹${fmtAmt(it.amount)}`}</Val>}
            </div>
            {is('icat', it.id) && <CatGrid categories={categories} value={it.categoryId} onPick={id => { setItem(it.id, { categoryId: id, unsure: false }); close(); }} />}
            {is('isplit', it.id) && (
              <PersonGrid multi label={`Who splits ${it.name}`} members={members} meId={meId} selected={sp}
                onToggle={id => setItem(it.id, { splitAmong: sp.includes(id) ? (sp.length > 1 ? sp.filter(x => x !== id) : sp) : members.map(m => m.id).filter(x => x === id || sp.includes(x)) })}
                onAll={() => setItem(it.id, { splitAmong: members.map(m => m.id) })} />
            )}
          </div>
        );
      })}

      {t.over > 0 && !locked && !shot && (
        <div className="ch-mismatch" role="alert">
          <span className="ch-mono">ITEMS ₹{fmtAmt(t.sum)} · BILL ₹{fmtAmt(bill.total)}</span>
          <b>₹{fmtAmt(t.over)} OVER</b>
        </div>
      )}

      {locked ? (isSaved(card) ? (
        <>
          <Stamp bill card={card} roomName={roomName} date={bill.date} top={150} />
          <SavedFooter card={card} roomName={roomName} onUndo={onUndo} readOnly={readOnly} onOpen={onOpen} />
        </>
      ) : <NotAdded />) : (
        <div className="ch-foot ch-foot--col">
          <button type="button" className={`ch-btn ${shot && mm.off ? 'ch-btn--off' : 'ch-grad'}`} disabled={!ok || saving} onClick={() => { setEd(null); onConfirm(); }}>
            {saving ? 'Saving…' : shot && mm.off ? `Save bill · fix ₹${fmtAmt(Math.abs(mm.diff))} first` : 'Save bill'}
          </button>
          {real.length > 1 && !saving && (
            <button type="button" className="ch-btn ch-btn--ghost" disabled={!ok} onClick={() => { setEd(null); onSeparate(); }}>Add as {real.length} separate expenses instead</button>
          )}
        </div>
      )}
    </div>
  );
}
