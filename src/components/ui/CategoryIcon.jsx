// Renders a category's line icon from its key.
import { resolveCategoryIcon, getCategoryIcon } from '../../design/categoryIcons';
import { CATEGORY_MOTION, subPaths } from '../../design/categoryMotion';
import '../../styles/categoryMotion.css';

/** A line icon on its tinted tile. Pass a Firestore `category` ({ name, icon }) or an icon `iconKey`. */
export default function CategoryIcon({ category, iconKey, size = 52, label, className = '' }) {
  const icon = iconKey ? getCategoryIcon(iconKey) : resolveCategoryIcon(category);
  return (
    <span
      className={`se-cat ${className}`}
      style={{ '--c': icon.color, '--size': `${size}px` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <LineIcon path={icon.path} />
    </span>
  );
}

/** Bare 24×24 line icon in the current text colour. */
export function LineIcon({ path, size, strokeWidth = 1.75 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A category's line icon with its own small motion (in the icon's colour). Pass `category` or `iconKey`. */
export function MotionIcon({ category, iconKey, size = 16, strokeWidth = 2, color }) {
  const icon = iconKey ? getCategoryIcon(iconKey) : resolveCategoryIcon(category);
  const parts = subPaths(icon.path);
  const rules = CATEGORY_MOTION[icon.key] || [];
  const whole = rules.find(r => r.parts === 'all');
  const moving = rules.filter(r => r.parts !== 'all');
  const used = new Set(moving.flatMap(r => r.parts));
  const still = parts.filter((_, i) => !used.has(i)).join('');
  const style = r => ({ transformOrigin: r.o ? `${r.o[0]}px ${r.o[1]}px` : undefined, animationDelay: r.d ? `${r.d}s` : undefined });
  const body = (
    <>
      {still && <path d={still} />}
      {moving.map((r, i) => (
        <path key={i} className={`se-mi-${r.a}`} style={style(r)} d={r.parts.map(j => parts[j]).join('')} pathLength={r.a === 'draw' ? 1 : undefined} />
      ))}
    </>
  );
  return (
    <svg className="se-mi" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color || icon.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {whole ? <g className={`se-mi-${whole.a}`} style={style(whole)}>{body}</g> : body}
      </g>
    </svg>
  );
}
