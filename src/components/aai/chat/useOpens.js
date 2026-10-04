import { useEffect, useMemo, useState } from 'react';
import { useRoomContext } from '../../../context/RoomContext';
import { subscribeOpens } from '../../../services/opensService';
import { opensFromRows, opensSince } from '../../../aai/heatmap.js';

/**
 * Who opened the app, per member per day: { [memberId]: { 'YYYY-MM-DD': count } }, live from rooms/{code}/opens.
 * If reading isn't allowed (old rules) or fails, the heatmap simply stays empty.
 * In dev builds, `window.__setAaiOpens({...})` shows a filled heatmap without touching any database.
 */
export default function useOpens() {
  const { roomCode } = useRoomContext();
  const [rows, setRows] = useState(null);
  const [dev, setDev] = useState(null);
  useEffect(() => {
    if (!roomCode) return undefined;
    return subscribeOpens(roomCode, opensSince(new Date()), setRows);
  }, [roomCode]);
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__setAaiOpens = setDev;
    return () => { delete window.__setAaiOpens; };
  }, []);
  return useMemo(() => dev ?? opensFromRows(rows || []), [dev, rows]);
}
