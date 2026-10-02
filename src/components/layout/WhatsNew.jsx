import { useState } from 'react';
import { haptic } from '../../utils/haptics';
import Sheet from '../ui/Sheet';
import { RELEASE, SHORT, CHANGE_COUNT, whatsNewUnseen, markWhatsNewSeen } from '../../version/version';
import './WhatsNew.css';

const GROUPS = [['new', 'NEW', 'wn-n'], ['improved', 'IMPROVED', 'wn-i'], ['fixed', 'FIXED', 'wn-f']];

/** Board Version-WhatsNew-Final, layout A: NEW / IMPROVED / FIXED headings with plain bullet lines. */
export function WhatsNewSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="wn-title">
      <div className="wn-head">
        <h2 className="wn-title" id="wn-title">What’s new</h2>
        <span className="wn-ver">v{SHORT} · {RELEASE.date}</span>
      </div>
      <div className="wn-groups">
        {GROUPS.filter(([k]) => RELEASE[k]?.length).map(([k, label, cls], gi) => (
          <div key={k} className={`wn-group ${cls}`} style={{ animationDelay: `${gi * 0.08}s` }}>
            <span className="wn-tag">{label}</span>
            {RELEASE[k].map(line => (
              <div key={line} className="wn-line"><span className="wn-dot" /><span>{line}</span></div>
            ))}
          </div>
        ))}
      </div>
      <button type="button" className="wn-ok se-press" onClick={onClose}>Got it</button>
    </Sheet>
  );
}

/** Settings row (board 8A4): ✦ squircle with a pink count until this version's notes are opened. */
export function WhatsNewRow() {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(whatsNewUnseen);
  const show = () => { haptic('tap'); setOpen(true); markWhatsNewSeen(); setUnseen(false); };
  return (
    <>
      <button type="button" className="st-card se-glass wn-row se-press" onClick={show}>
        <span className="wn-ic">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" /></svg>
          {unseen && <span className="wn-badge" aria-label={`${CHANGE_COUNT} new changes`}>{CHANGE_COUNT}</span>}
        </span>
        <span className="wn-row__t"><span>What’s new</span><small>v{SHORT}</small></span>
        <span className="wn-row__chev" aria-hidden="true">›</span>
      </button>
      <WhatsNewSheet open={open} onClose={() => { haptic('choose'); setOpen(false); }} />
    </>
  );
}
