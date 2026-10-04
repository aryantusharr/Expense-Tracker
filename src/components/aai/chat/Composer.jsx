import { TextField } from '../../ui/Keyboard';
import { haptic } from '../../../utils/haptics';
import { fmtINR } from '../../../aai/common.js';
import { IcPlus, IcSend } from './parts';

/** The composer pill (+ bill screenshot · field · send) and, while it is focused on an empty chat, the two rows above it. */

export function Composer({ text, setText, onSend, onBill, fieldRef, hint }) {
  const empty = !text.trim();
  return (
    <div className="ch-comp" data-kb>
      <button type="button" className="ch-cb ch-cb--gh" aria-label="Add bill screenshot" onClick={() => { haptic('tap'); onBill(); }}><IcPlus /></button>
      <TextField
        value={text} onChange={setText} maxLength={240} caps="none" digitRow doneLabel="Send" keepOpen slotContent={null}
        className="ch-field" placeholder={hint || 'Type an expense or add a bill'} fieldRef={fieldRef}
        onDone={() => onSend(text)} aria-label="Type an expense or add a bill"
      />
      <button type="button" className="ch-cb ch-send" aria-label="Send" disabled={empty} onClick={() => onSend(text)}><IcSend /></button>
    </div>
  );
}

const IcBill = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>
);

/** "SAME BILL AGAIN · 1 TAP → REVIEW" (violet) above "QUICK USUALS". Hidden when there is nothing to show. */
export function FocusRows({ bills, usuals, isPersonal, onBill, onUsual }) {
  if (!bills.length && !usuals.length) return null;
  return (
    <div className="ch-rows" data-kb>
      {bills.length > 0 && (
        <div className="ch-row">
          <span className="ch-lab ch-lab--v">SAME BILL AGAIN · 1 TAP → REVIEW</span>
          <div className="ch-row__s">
            {bills.map(b => (
              <button key={b.groupId} type="button" className="ch-bchip" onClick={() => onBill(b)}>
                <span className="ch-bchip__ic"><IcBill /></span>
                <span className="ch-bchip__t">
                  <span>{b.name} <b>{fmtINR(b.total)}</b></span>
                  <span className="ch-mono">{b.count} ITEMS · {b.last}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {usuals.length > 0 && (
        <div className="ch-row">
          <span className="ch-lab">QUICK USUALS</span>
          <div className="ch-row__s">
            {usuals.map(u => (
              <button key={u.key} type="button" className="ch-uchip" onClick={() => onUsual(u)}>
                <span>{u.description} <b>{fmtINR(u.amount)}</b></span>
                {!isPersonal && u.split && <span className="ch-mono">{u.split}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
