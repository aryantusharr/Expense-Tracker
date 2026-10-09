import './LoopMark.css';

/**
 * "AAI mark · looping loader (L1)" — the canvas board's 8s loop, built from its exact markup + keyframes (LoopMark.css):
 * peek → the slot curls under AI and carries the buddy → thinks (GPT? → Claude? → Gemini?) → sinks into the underline →
 * the slot curls up around AI and stands upright again → loop. Names only, never logos. Reduced motion → static A|AI + slot.
 */
const SLOT_A = 'M-7 24 L-7 36 L-7 2 L-7 36 C-7 47 -2 52 8 52 L88 52';
const SLOT_B = 'M8 52 L88 52 C104 52 102 -12 48 -14 C0 -16 -7 -12 -7 2 L-7 36 L-7 2 L-7 14';
const Slot = ({ d }) => (
  <g>
    <path d={d} stroke="rgba(95,212,196,.16)" strokeWidth="10" />
    <path d={d} className="L1mid" strokeWidth="6" />
    <path d={d} stroke="#000" strokeWidth="4" />
  </g>
);
const Tag = ({ cls, color, children }) => (
  <span className={`L1pp ${cls}`} style={{ left: 60, top: -2 }}>
    <span style={{ display: 'flex', background: '#12112E', border: `1px solid ${color}`, borderRadius: 8, padding: '3px 4px', boxShadow: `0 0 8px ${color}66` }}>
      <span style={{ font: "700 7.5px var(--se-font-mono, 'JetBrains Mono', monospace)", letterSpacing: '.04em', color, whiteSpace: 'nowrap' }}>{children}</span>
    </span>
  </span>
);

export default function LoopMark({ scale = 1.5 }) {
  return (
    <div className="L1root" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }} aria-hidden="true">
      <div className="L1w">
        <span className="L1A">A</span>
        <span className="L1AIw">
          <span className="L1AIt">AI</span>
          <span className="L1mk"><span className="L1in"><span className="L1bx"><span className="L1by"><span className="L1bd">
            <span className="L1brow" style={{ left: 3, transform: 'rotate(-12deg)' }} />
            <span className="L1brow" style={{ left: 10.5, transform: 'rotate(14deg) translateY(-1px)' }} />
            <span className="L1eye" style={{ left: 4 }} />
            <span className="L1eye" style={{ left: 11 }} />
            <span className="L1mo" />
            <span className="L1arm" />
          </span></span></span></span></span>
          <span className="L1w1">
            <svg className="L1sv L1s1" width="180" height="140" viewBox="-40 -40 180 140"><Slot d={SLOT_A} /></svg>
          </span>
          <span className="L1w2">
            <svg className="L1sv L1s2" width="180" height="140" viewBox="-40 -40 180 140"><Slot d={SLOT_B} /></svg>
          </span>
          <span className="L1tr" style={{ left: 81, top: 28, width: 2, height: 2 }} />
          <span className="L1tr" style={{ left: 84, top: 22, width: 3, height: 3 }} />
          <span className="L1tr" style={{ left: 87, top: 16, width: 4, height: 4 }} />
          <Tag cls="L1pp0" color="#B3A8FF">GPT?</Tag>
          <Tag cls="L1pp1" color="#FF8FB5">Claude?</Tag>
          <Tag cls="L1pp2" color="#5FD4C4">Gemini?</Tag>
        </span>
      </div>
    </div>
  );
}
