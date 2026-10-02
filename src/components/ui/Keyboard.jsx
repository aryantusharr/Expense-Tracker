import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../../utils/haptics';

/**
 * In-app keyboard (boards Input-Keypad-Final "Side rail" + Input-Numpad-Final "Glass grid").
 * The iPhone keyboard never opens: fields are <TextField>s (a styled box with our own caret) and
 * typing happens on the tray at the bottom. Text fields get QWERTY with an ABC / 123 rail;
 * amount fields get the glass numpad (÷ × − + left, pink ⌫). Done closes; tap the field to reopen;
 * a tap anywhere else closes too. A hardware keyboard also types into the active field (desktop).
 */

const ACCENTS = ['#8B7CFF', '#5FD4C4', '#FF8FB5', '#F5C26B', '#6EC1FF', '#A8E06B', '#FF9A76', '#C9A7FF'];
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
// 123 layer: 6 columns; ⌫ and Done span 2.
const NUM = ['₹', '1', '2', '3', '-', '/', '@', '4', '5', '6', '(', ')', '&', '7', '8', '9', '⌫', '#', '.', '0', ',', 'Done'];
const SYM = new Set(['₹', '-', '/', '@', '(', ')', '&', '#']);
const PAD = ['÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '.', '0', '⌫'];
const OPS = { '÷': '/', '×': '*', '−': '-', '+': '+' };

const KbCtx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useKeyboard = () => useContext(KbCtx);

const BackIcon = () => (
  <svg width="22" height="16" viewBox="0 0 26 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 1h15a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8L1 9z" /><path d="M12 6l6 6M18 6l-6 6" />
  </svg>
);

/** A key that pops up + glows in its accent when pressed (fires on pointer up, like the board). */
function Key({ k, i, cls = '', style, onPress, children, label }) {
  const [on, setOn] = useState(0);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  const c = ACCENTS[i % ACCENTS.length];
  const r = `${((i * 37) % 11) - 5}deg`;
  return (
    <button
      type="button"
      className={`kb-k ${cls} ${on ? 'is-on' : ''}`}
      style={{ '--c': c, '--r': r, ...style }}
      aria-label={label || k}
      onPointerDown={e => e.preventDefault()}
      onClick={() => {
        setOn(n => n + 1);
        clearTimeout(t.current);
        t.current = setTimeout(() => setOn(0), 220);
        onPress(k, c);
      }}
    >
      {children ?? (k === '⌫' ? <BackIcon /> : k)}
    </button>
  );
}

function Tray({ kind, press, trayRef }) {
  const [layer, setLayer] = useState(0);
  const pick = n => { haptic('tap'); setLayer(n); };

  if (kind === 'amount' || kind === 'number') {
    return (
      <div className="kb kb--pad" ref={trayRef} data-kb>
        <div className="kb-pad" role="group" aria-label="Amount keypad">
          {PAD.map((k, i) => (
            <Key key={k} k={k} i={i} onPress={press}
              cls={`kb-n ${OPS[k] ? 'kb-n--op' : ''} ${OPS[k] && kind === 'number' ? 'kb-n--off' : ''} ${k === '⌫' ? 'kb-n--del' : ''}`}
              label={k === '⌫' ? 'Delete' : k === '.' ? 'Decimal point' : undefined} />
          ))}
        </div>
        <button type="button" className="kb-done se-press" onPointerDown={e => e.preventDefault()} onClick={() => press('Done')}>Done</button>
      </div>
    );
  }

  return (
    <div className="kb" ref={trayRef} data-kb>
      <div className="kb-wrap">
        <div className="kb-rail" role="tablist" aria-label="Keyboard layer">
          {['ABC', '123'].map((n, i) => (
            <button key={n} type="button" role="tab" aria-selected={layer === i} className={`kb-rl ${layer === i ? 'is-sel' : ''}`}
              onPointerDown={e => e.preventDefault()} onClick={() => pick(i)}>{n}</button>
          ))}
        </div>
        <div className="kb-keys">
          {layer === 0 ? (
            <div className="kb-rows">
              {ROWS.map((row, ri) => (
                <div className="kb-row" key={row}>
                  {[...row].map((k, ki) => <Key key={k} k={k} i={ri * 10 + ki} onPress={press} cls="kb-l" />)}
                  {ri === 2 && <Key k="⌫" i={27} onPress={press} cls="kb-del" label="Delete" style={{ flex: 1 }} />}
                </div>
              ))}
              <div className="kb-row">
                <Key k="space" i={28} onPress={press} cls="kb-sp" style={{ flex: 1 }} />
                <Key k="Done" i={29} onPress={press} cls="kb-sp kb-go" style={{ width: 'calc((100% - 45px) / 10 * 3 + 10px)' }} />
              </div>
            </div>
          ) : (
            <div className="kb-grid">
              {NUM.map((k, i) => (
                <Key key={k} k={k} i={i} onPress={press}
                  cls={k === '⌫' ? 'kb-del' : k === 'Done' ? 'kb-sp kb-go' : SYM.has(k) ? 'kb-sym' : ''}
                  label={k === '⌫' ? 'Delete' : undefined}
                  style={k === '⌫' || k === 'Done' ? { gridColumn: 'span 2' } : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KeyboardProvider({ children }) {
  const [active, setActive] = useState(null);    // { id, kind } of the focused field
  const api = useRef(null);                      // the focused field's { press, blur, el }
  const activeId = useRef(null);
  const trayRef = useRef(null);

  const close = useCallback(() => {
    const a = api.current;
    api.current = null;
    activeId.current = null;
    setActive(null);
    a?.blur?.();
  }, []);

  const focus = useCallback((id, kind, fieldApi) => {
    if (api.current && api.current !== fieldApi) api.current.blur?.();
    api.current = fieldApi;
    activeId.current = id;
    setActive({ id, kind });
  }, []);
  const isActive = useCallback(id => activeId.current === id, []);

  const press = useCallback((k, c) => {
    if (k === 'Done') { haptic('choose'); const a = api.current; close(); a?.done?.(); return; }
    haptic('tap');
    api.current?.press(k, c);
  }, [close]);

  // Page/sheet make room for the tray; keep the field in view.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!active) { root.classList.remove('se-kb-open'); root.style.removeProperty('--se-kb-h'); return undefined; }
    const el = trayRef.current;
    const set = () => root.style.setProperty('--se-kb-h', `${el?.offsetHeight || 0}px`);
    set();
    root.classList.add('se-kb-open');
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(set) : null;
    ro?.observe(el);
    const t = setTimeout(() => api.current?.el?.()?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    return () => { ro?.disconnect(); clearTimeout(t); };
  }, [active]);

  // Tap outside the tray and any field closes; hardware keys type (desktop / iPad keyboards).
  useEffect(() => {
    if (!active) return undefined;
    const down = e => { if (!e.target.closest?.('[data-kb], [data-se-field]')) close(); };
    const key = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      let k = null;
      if (e.key === 'Backspace') k = '⌫';
      else if (e.key === 'Enter') k = 'Done';
      else if (e.key === 'Escape') { close(); return; }
      else if (e.key === ' ') k = 'space';
      else if (e.key.length === 1) k = active.kind !== 'text' ? ({ '/': '÷', '*': '×', '-': '−', x: '×' }[e.key] || e.key) : { raw: e.key };
      if (!k) return;
      e.preventDefault();
      if (k === 'Done') press('Done');
      else api.current?.press(k, ACCENTS[1]);
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); };
  }, [active, close, press]);

  const value = useMemo(() => ({ active, focus, close, isActive }), [active, focus, close, isActive]);
  return (
    <KbCtx.Provider value={value}>
      {children}
      {active && createPortal(<Tray key={active.kind} kind={active.kind} press={press} trayRef={trayRef} />, document.body)}
    </KbCtx.Provider>
  );
}

const PAD_OPS = '+-*/';
/** Next amount expression after a numpad key (same characters the old inputs allowed: 0-9 . + - * /). */
function nextAmount(v, k) {
  if (k === '⌫') return v.slice(0, -1);
  const op = OPS[k];
  if (op) {
    if (!v) return v;
    return PAD_OPS.includes(v.slice(-1)) ? v.slice(0, -1) + op : v + op;
  }
  if (k === '.') {
    const seg = v.split(/[+\-*/]/).pop();
    if (seg.includes('.')) return v;
    return v + (seg === '' ? '0.' : '.');
  }
  if (!/^[0-9]$/.test(k)) return v;
  const seg = v.split(/[+\-*/]/).pop();
  if (seg === '0') return v.slice(0, -1) + k;
  return v + k;
}

/**
 * Field that types with the in-app keyboard. onChange gets the new string.
 * kind: 'text' (default) | 'amount' (numpad, expression string) | 'number' (numpad, no operators) | 'code' (CAPS).
 * caps: 'sentences' (default) | 'words' | 'none'.
 */
export function TextField({
  value = '', onChange, placeholder, maxLength = 80, kind = 'text', caps = 'sentences',
  className = '', autoFocus = false, onDone, onBlur, disabled = false, prefix, ...rest
}) {
  const kb = useKeyboard();
  const id = useId();
  const ref = useRef(null);
  const props = useRef(null);
  useLayoutEffect(() => { props.current = { value: String(value ?? ''), onChange, maxLength, kind, caps, onDone, onBlur }; });
  const [fx, setFx] = useState(null);       // { type: 'add' | 'del', n, c, ch }
  const on = kb?.active?.id === id;

  const [fieldApi] = useState(() => ({
      el: () => ref.current,
      blur: () => { ref.current?.blur(); props.current.onBlur?.(); },
      done: () => props.current.onDone?.(),
      press: (k, c) => {
        const p = props.current;
        const v = p.value;
        let next;
        if (p.kind === 'amount') next = nextAmount(v, k);
        else if (p.kind === 'number') next = OPS[k] ? v : nextAmount(v, k);
        else if (k === '⌫') next = v.slice(0, -1);
        else if (k === 'space') next = v + ' ';
        else {
          let ch = typeof k === 'object' ? k.raw : k;
          if (typeof k !== 'object' && /^[A-Z]$/.test(ch)) {
            const start = p.kind === 'code' || (p.caps === 'words' ? (v === '' || / $/.test(v)) : p.caps === 'sentences' && (v === '' || /[.!?] $/.test(v)));
            ch = start ? ch : ch.toLowerCase();
          }
          if (p.kind === 'code') ch = ch.toUpperCase();
          next = v + ch;
        }
        if (next.length > p.maxLength) return;
        if (next === v) return;
        setFx(f => ({ type: next.length < v.length ? 'del' : 'add', n: (f?.n || 0) + 1, c: c || ACCENTS[1], ch: next.length < v.length ? v.slice(-1) : '' }));
        p.value = next;   // fast presses build on this one before the next render
        p.onChange?.(next);
      },
  }));

  const pad = kind === 'amount' || kind === 'number' ? kind : 'text';
  const open = () => { if (!disabled && kb) { haptic('tap'); kb.focus(id, pad, fieldApi); } };

  useEffect(() => {
    if (autoFocus && !disabled && kb) kb.focus(id, pad, fieldApi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);
  // Unmounting while focused closes the tray.
  const kbRef = useRef(kb);
  useEffect(() => { kbRef.current = kb; });
  useEffect(() => () => { const k = kbRef.current; if (k?.isActive(id)) k.close(); }, [id]);
  useEffect(() => { if (disabled && on) kb.close(); }, [disabled, on, kb]);

  // Keep the end (and the caret) in view when the text is wider than the box.
  const inner = useRef(null);
  useLayoutEffect(() => { if (inner.current) inner.current.scrollLeft = inner.current.scrollWidth; }, [value, on]);

  const v = String(value ?? '');
  const shown = kind === 'amount' ? v.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−') : v;
  const lastAdd = fx?.type === 'add' && on;
  const head = lastAdd ? shown.slice(0, -1) : shown;
  const tail = lastAdd ? shown.slice(-1) : '';

  return (
    <span
      ref={ref}
      role="textbox"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-placeholder={placeholder}
      data-se-field
      className={`se-field ${className} ${on ? 'is-focus' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={open}
      onKeyDown={e => { if (!on && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}
      {...rest}
    >
      {prefix}
      <span className="se-field__in" ref={inner}>
        {v === '' && !on && <span className="se-field__ph">{placeholder}</span>}
        <span className="se-field__txt">
          {head}
          {tail && <span key={fx.n} className="se-kfly" style={{ '--c': fx.c }}>{tail}</span>}
          {on && <span className="se-caret" aria-hidden="true" />}
          {on && fx?.type === 'del' && fx.ch && <span key={`g${fx.n}`} className="se-kgone" aria-hidden="true">{fx.ch}</span>}
        </span>
        {v === '' && on && <span className="se-field__ph se-field__ph--on">{placeholder}</span>}
      </span>
    </span>
  );
}
