// You-owe hero: your last payment as a glass pill (board "Last paid · L2 + N4 magnifier").
// ₹ amount · category icon with its own motion · description · a reel of TODAY / date / weekday
// that scrolls upward and grows as each label passes the lens in the middle.
import { MotionIcon } from '../../ui/CategoryIcon';
import { fmt, reelFaces } from '../dashboardData';

const LOOP = 7.5; // seconds for one full trip of the reel (see .dsh-lp__it in DashboardScreen.css)
// How much a label grows under the lens: long ones (YESTERDAY, 5 DAYS AGO) less, so they stay inside the reel.
const peak = t => (t.length >= 8 ? 1.12 : t.length >= 7 ? 1.2 : 1.3);

export default function LastPaidPill({ tx, categories }) {
  if (!tx) return <span className="dsh-lp__none">Last · No payments yet</span>;
  const cat = (categories || []).find(c => c.id === tx.categoryId);
  const faces = reelFaces(tx.date);
  const amount = fmt(tx.amount);
  // Spread the labels evenly round the loop, with the first one starting in the middle.
  const delay = i => -(((LOOP / 2 - i * (LOOP / faces.length)) % LOOP + LOOP) % LOOP);
  return (
    <div className="dsh-lp" role="group" aria-label={`Last paid ₹${amount} for ${tx.name}, ${(faces[0] || '').toLowerCase()}`}>
      <span className="dsh-lp__sheen" aria-hidden="true" />
      <span className="dsh-lp__amt" aria-hidden="true">
        <span className="dsh-lp__label">LAST PAID</span>
        <span className="dsh-lp__num">
          <span className="cur">₹</span>
          {amount.split('').map((c, i) => <span key={i} className="dsh-lp__digit" style={{ animationDelay: `${800 + i * 70}ms` }}>{c}</span>)}
        </span>
      </span>
      <span className="dsh-lp__what" aria-hidden="true">
        <MotionIcon category={cat} size={16} />
        <span className="dsh-lp__name">{tx.name}</span>
      </span>
      <span className="dsh-lp__reel" aria-hidden="true">
        <span className="dsh-lp__lens" />
        {faces.map((t, i) => <span key={t} className={`dsh-lp__it dsh-lp__it--${i}`} style={{ animationDelay: `${delay(i)}s`, '--pk': peak(t) }}>{t}</span>)}
        <span className="dsh-lp__fade" />
      </span>
    </div>
  );
}
