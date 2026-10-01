import { useEffect, useState } from 'react';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** ₹ amount with reel digits that roll when the number changes (keyed from the right so places stay put). */
export default function AmountOdometer({ value, height = 56 }) {
  const text = (value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const chars = text.split('');
  const [first, setFirst] = useState(true);   // digits added later pop in; the first render doesn't
  useEffect(() => { const t = setTimeout(() => setFirst(false), 0); return () => clearTimeout(t); }, []);
  return (
    <span className="add-odo" role="text" aria-label={`₹${text}`} style={{ height }}>
      {chars.map((ch, i) => {
        const fromRight = chars.length - 1 - i;
        if (!/\d/.test(ch)) {
          return <span key={`s${fromRight}`} aria-hidden="true" className="add-odo__sep" style={{ lineHeight: `${height}px` }}>{ch}</span>;
        }
        return (
          <span key={`d${fromRight}`} aria-hidden="true" className={`add-odo__win ${first ? '' : 'add-odo__win--new'}`} style={{ height }}>
            <span className="add-odo__reel" style={{ transform: `translateY(${-Number(ch) * height}px)` }}>
              {DIGITS.map(g => <span key={g} className="add-odo__d" style={{ height, lineHeight: `${height}px` }}>{g}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}
