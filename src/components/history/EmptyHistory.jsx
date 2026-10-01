import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { haptic } from '../../utils/haptics';

/** Board 9a + 9b: printer bar with a blank swaying receipt, add button, arrow to the pulsing History tab. */
export default function EmptyHistory({ roomName }) {
  const navigate = useNavigate();
  // The nav's History indicator turns into a dashed, pulsing ring while this screen is up.
  useEffect(() => { document.body.classList.add('hist-empty'); return () => document.body.classList.remove('hist-empty'); }, []);

  return (
    <div className="se-page hist">
      <div className="hist__sky" aria-hidden="true">
        <span className="se-orb se-orb-1 hist__orb hist__orb--1" />
        <span className="se-orb se-orb-2 hist__orb hist__orb--2" />
        <span className="se-orb se-orb-3 hist__orb hist__orb--3" />
      </div>
      <header className="hist__head">
        <div className="hist__bar">
          <div className="hist__title"><h1>History</h1><span className="se-mono">0 EXPENSES · {roomName}</span></div>
        </div>
      </header>
      <div className="he0">
        <div className="he0__printer"><span className="he0__slit" /><span className="se-mono">{roomName} · HISTORY</span></div>
        <div className="he0__sway">
          <div className="he0__paper se-mono">
            <b>NO EXPENSES YET</b>
            <small>₹0.00</small>
            <hr />
            {[92, 64, 110].map((w, i) => (
              <span key={w} className="he0__ghost" style={{ animationDelay: `${i * 0.3}s` }}><i /><em style={{ width: w }} /><u /><em style={{ width: 34 }} /></span>
            ))}
            <hr />
            <span className="he0__tot"><span>TOTAL</span><span>0.00</span></span>
            <span className="he0__bars">||| || |||| | ||</span>
          </div>
        </div>
        <div className="he0__copy">
          <h2>Your first expense will print here</h2>
          <p>Every expense you add lands in History as a receipt — grouped by month and day.</p>
          <button type="button" className="se-btn se-btn--primary se-btn--lg se-press" onClick={() => { haptic('choose'); navigate('/add'); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            Add your first expense
          </button>
        </div>
      </div>
      <div className="he0__lands" aria-hidden="true">
        <span className="se-mono">LANDS HERE</span>
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
}
