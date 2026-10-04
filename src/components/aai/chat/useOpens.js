import { useEffect, useState } from 'react';

/**
 * Who opened the app, per member per day: { [memberId]: { 'YYYY-MM-DD': count } }.
 * Chat 1 · Part 1 ships the heatmap shell with no data; Part 2 reads/writes rooms/{code}/opens (test project first).
 * In dev builds, `window.__setAaiOpens({...})` lets us look at a filled heatmap without touching any database.
 */
export default function useOpens() {
  const [opens, setOpens] = useState({});
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__setAaiOpens = setOpens;
    return () => { delete window.__setAaiOpens; };
  }, []);
  return opens;
}
