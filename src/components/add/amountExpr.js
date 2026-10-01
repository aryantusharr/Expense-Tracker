import { evaluateMathExpression } from './addHelpers';

export const OPS = ['÷', '×', '−', '+'];
const MAX_LEN = 16;

/** Expression string typed on the keypad ("120+45×2") → number, ignoring a dangling operator. */
export function evalExpr(expr) {
  if (!expr) return 0;
  let s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  s = s.replace(/[+\-*/.]+$/, '');
  if (!s) return 0;
  const v = evaluateMathExpression(s);
  return v == null || v < 0 ? 0 : v;
}

export const hasOperator = expr => /[÷×−+]/.test(expr.replace(/^−/, ''));

/** Apply one key press to the expression. */
export function pressKey(expr, key) {
  if (key === '⌫') return expr.slice(0, -1);
  if (expr.length >= MAX_LEN && key !== '⌫') return expr;
  const last = expr.slice(-1);
  const curNum = expr.split(/[÷×−+]/).pop();
  if (OPS.includes(key)) {
    if (!expr) return expr;                       // no leading operator
    if (OPS.includes(last)) return expr.slice(0, -1) + key; // replace operator
    return expr + key;
  }
  if (key === '.') {
    if (curNum.includes('.')) return expr;
    return expr + (curNum === '' ? '0.' : '.');
  }
  // digit
  if (curNum === '0' && key !== '.') return expr.slice(0, -1) + key; // no leading zeros
  if (curNum.includes('.') && curNum.split('.')[1].length >= 2) return expr; // 2 decimals
  return expr + key;
}
