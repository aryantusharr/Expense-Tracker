import { initialOf } from '../dashboard/dashboardData';

/** Tinted rounded square: member colour 20% over the surface, 1px border, initial in the colour. */
export default function Monogram({ member, size = 36, className = '', style }) {
  return (
    <span
      className={`add-mono ${className}`}
      style={{ '--c': member.color, width: size, height: size, borderRadius: size * 0.32, fontSize: size * 0.42, ...style }}
      aria-hidden="true"
    >
      {initialOf(member.name)}
    </span>
  );
}
