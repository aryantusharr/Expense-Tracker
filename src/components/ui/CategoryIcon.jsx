import { resolveCategoryIcon, getCategoryIcon } from '../../design/categoryIcons';

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
