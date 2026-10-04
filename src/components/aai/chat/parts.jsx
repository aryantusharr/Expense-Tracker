import { initialOf } from '../../dashboard/dashboardData';

/** Small shared bits of the AAI chat: monogram, avatar, header, thinking steps, icons. */

export function Mg({ m, big = false, dim = false }) {
  return (
    <span className={`ch-mg ${big ? 'ch-mg--big' : ''} ${dim ? 'is-dim' : ''}`} style={{ '--c': m.color, '--cl': m.light }}>
      {initialOf(m.name)}
    </span>
  );
}

/** The 26px receipt-slip avatar next to every AAI reply (40px on the empty state). */
export function Av({ big = false }) {
  return <span className={`ch-av ${big ? 'ch-av--big' : ''}`} aria-hidden="true"><i /></span>;
}

const sv = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const IcMenu = () => <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.8" {...sv}><path d="M4 7h16M4 12h10M4 17h16" /></svg>;
export const IcNew = () => <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.8" {...sv}><path d="M12 20h8" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>;
export const IcClose = () => <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.8" {...sv}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IcPlus = () => <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2" {...sv}><path d="M12 5v14M5 12h14" /></svg>;
export const IcSend = () => <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="2.4" {...sv}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
export const IcTag = () => <svg width="11" height="11" viewBox="0 0 24 24" strokeWidth="2.2" {...sv}><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>;
const IcCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" strokeWidth="2.6" {...sv}><path d="M5 12l5 5L20 7" /></svg>;
const IcChev = ({ up }) => <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...sv}><path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg>;

export function Header({ onMenu, onNew, onClose }) {
  return (
    <div className="ch-hdr">
      <button type="button" className="ch-ib" aria-label="Past chats" onClick={onMenu}><IcMenu /></button>
      <div className="ch-mark" aria-label="Aryan AI"><span>A</span><span className="ch-mark__s" /><span className="ch-mark__ai">AI</span></div>
      <div className="ch-hdr__r">
        <button type="button" className="ch-ib" aria-label="New chat" onClick={onNew}><IcNew /></button>
        <button type="button" className="ch-ib" aria-label="Close" onClick={onClose}><IcClose /></button>
      </div>
    </div>
  );
}

/** Reply text with **bold** spans. */
export function Say({ text }) {
  const parts = String(text).split(/\*\*(.+?)\*\*/g);
  return <div className="ch-say">{parts.map((p, i) => (i % 2 ? <b key={i} className="ch-ed">{p}</b> : p))}</div>;
}

/**
 * Mono steps while AAI works (✓ done, spinner on the current one), then a muted "Show thinking ⌄" accordion.
 * shown = how many steps are finished; done = all finished.
 */
export function Thinking({ steps, shown, done, open, onToggle }) {
  if (!steps.length) return null;
  if (!done) {
    return (
      <div className="ch-steps" role="status" aria-live="polite" aria-label="AAI is working">
        {steps.slice(0, shown + 1).map((s, i) => (
          <div key={i} className="ch-step">
            <span className="ch-dot">{i < shown ? <span className="ch-ok"><IcCheck /></span> : <span className="ch-spin" />}</span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="ch-thinkbox">
      <button type="button" className="ch-think" aria-expanded={open} onClick={onToggle}>
        Show thinking <IcChev up={open} />
      </button>
      {open && (
        <div className="ch-steps ch-steps--open">
          {steps.map((s, i) => (
            <div key={i} className="ch-step"><span className="ch-dot"><span className="ch-ok"><IcCheck /></span></span><span>{s.text}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The short A|AI loader: the buddy peeks out of the slot, blinks, slips back (board AAI-Loader-Short · Q1). */
export function ChatLoader({ out }) {
  return (
    <div className={`ch-load ${out ? 'is-out' : ''}`} role="status" aria-label="Opening Aryan AI">
      <div className="ch-load__mark" aria-hidden="true">
        <span>A</span>
        <span className="ch-load__slot">
          <span className="ch-load__bar" />
          <span className="ch-load__win"><span className="ch-load__slip"><i /><i /></span></span>
        </span>
        <span className="ch-load__ai">AI</span>
      </div>
      <div className="ch-load__txt">WAKING UP…</div>
    </div>
  );
}
