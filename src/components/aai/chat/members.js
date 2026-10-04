import { memberStyle } from '../../dashboard/dashboardData';

// Light-mode member tones from the light boards (dark palette colour → darker light-theme colour).
const LIGHT = { '#8B7CFF': '#5B4BD6', '#5FD4C4': '#0A8577', '#FF8FB5': '#C22F66' };

export const withStyle = users => users.map((u, i) => {
  const { color } = memberStyle(i);
  return { ...u, color, light: LIGHT[color] || `color-mix(in srgb, ${color} 62%, #000)` };
});
