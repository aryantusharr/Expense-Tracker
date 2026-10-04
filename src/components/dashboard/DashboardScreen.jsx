import { useEffect, useMemo, useState } from 'react';
import { useRoomContext } from '../../context/RoomContext';
import { useTheme } from '../../context/ThemeContext';
import { haptic } from '../../utils/haptics';
import {
  sharedModel, monthWindow, lifetime, spendingMatrix, lastTransaction, skyFor, memberStyle, initialOf,
} from './dashboardData';
import { HeroCard, NudgeStrip, Settlements, IdentitySheet, Mono } from './parts/Shared';
import BalanceDeck from './parts/BalanceDeck';
import { MonthCard, SpendingMatrix, LifetimeSpend } from './parts/MonthAndMatrix';
import UnmappedCategories from './parts/UnmappedCategories';
import { Ticker, BudgetCard, LastPaid } from './parts/Personal';
import AaiPill from '../aai/AaiPill';
import AaiChat from '../aai/chat/AaiChat';
import './DashboardScreen.css';

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export default function DashboardScreen() {
  const { room, roomCode, expenses, users, categories, userIdentity, setUserIdentity } = useRoomContext();
  const { theme } = useTheme();
  const online = useOnline();
  const isPersonal = room?.isPersonal === true;
  const budget = Number(room?.budget) || 0;

  const { months } = useMemo(() => monthWindow(expenses), [expenses]);
  const life = useMemo(() => lifetime(expenses), [expenses]);
  const matrix = useMemo(() => spendingMatrix(expenses, categories), [expenses, categories]);
  const model = useMemo(() => (isPersonal ? null : sharedModel(expenses, users)), [isPersonal, expenses, users]);

  const [sel, setSel] = useState(null);
  const selIdx = sel == null || sel >= months.length ? months.length - 1 : sel;
  const selMonth = months[selIdx];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aaiOpen, setAaiOpen] = useState(false);

  const me = model && userIdentity ? model.byId[userIdentity] : null;
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const curMonth = months[months.length - 1];
  const over = isPersonal && budget > 0 && selMonth.total > budget;
  const sky = skyFor(months.length - 1 - selIdx, { over, light: theme === 'light' });

  // Personal header: who + where synced from (latest synced copy).
  const owner = isPersonal ? { ...memberStyle(0), initial: initialOf(users[0]?.name || room?.name) } : null;
  const syncedFrom = useMemo(() => {
    if (!isPersonal) return null;
    const synced = expenses.filter(e => e.isSynced || e.syncedFromRoomName);
    if (!synced.length) return null;
    synced.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return synced[0].syncedFromRoomName || synced[0].syncedFromRoom || null;
  }, [isPersonal, expenses]);

  const meta = isPersonal
    ? `PERSONAL${syncedFrom ? ` · SYNCED WITH ${syncedFrom}` : ''}`
    : `SHARED · ${users.length} ${users.length === 1 ? 'ROOMMATE' : 'ROOMMATES'} · ${online ? 'LIVE' : 'OFFLINE'}`;

  return (
    <div className="se-page">
      <div className="dsh-sky" aria-hidden="true">
        <span className="se-orb se-orb-1" style={{ width: 300, height: 300, left: -120, top: -60, background: sky[0] }} />
        <span className="se-orb se-orb-2" style={{ width: 280, height: 280, right: -140, top: 360, background: sky[1] }} />
        <span className="se-orb se-orb-3" style={{ width: 220, height: 220, left: 40, bottom: -80, background: sky[2] }} />
      </div>

      <main className="dsh">
        <header className="dsh-head se-in">
          <div style={{ minWidth: 0 }}>
            <h1 className="dsh-head__title">{room?.name || 'Dashboard'}</h1>
            <div className="dsh-head__meta">
              <span className={`dsh-dot ${online ? 'se-live' : 'dsh-dot--off'}`} aria-hidden="true" />
              <span>{meta}</span>
            </div>
          </div>
          <div className="dsh-head__right">
          <AaiPill open={aaiOpen} onOpen={() => setAaiOpen(true)} />
          {isPersonal ? (
            <Mono m={owner} size={44} radius={14} fontSize={16} />
          ) : (
            <button
              type="button"
              className="dsh-me se-press"
              aria-label={me ? `You are ${me.name}. Change member profile` : 'Pick your member profile'}
              onClick={() => { haptic('tap'); setPickerOpen(true); }}
            >
              {me
                ? <Mono m={me} size={36} radius={12} fontSize={14} />
                : <span className="dsh-mono" style={{ '--c': 'var(--se-text-3)', width: 36, height: 36, borderRadius: 12, fontSize: 14 }}>?</span>}
            </button>
          )}
          </div>
        </header>

        {isPersonal ? (
          <>
            <Ticker cur={curMonth} prev={months[months.length - 2]} budget={budget} life={life} daysLeft={daysLeft} />
            {budget > 0 && <BudgetCard monthFull={curMonth.full} spent={curMonth.total} budget={budget} daysLeft={daysLeft} />}
            <MonthCard months={months} sel={selIdx} onSelect={setSel} budget={budget} delay={200} />
            <LifetimeSpend total={life.total} months={life.months} className="se-in" style={{ animationDelay: '240ms', borderRadius: 22 }} />
            <LastPaid tx={lastTransaction(expenses)} categories={categories} />
            <SpendingMatrix matrix={matrix} selKey={selMonth.key} budget={budget} delay={360} />
          </>
        ) : (
          <>
            <NudgeStrip members={model.members} meId={me?.id} />
            <HeroCard model={model} me={me} onPickIdentity={() => setPickerOpen(true)} />
            <Settlements settlements={model.settlements} meId={me?.id} />
            {model.members.length > 0 && (
              <BalanceDeck members={model.members} meId={me?.id} monthLabel={curMonth.short.toUpperCase()} since={life.since?.label} />
            )}
            <MonthCard months={months} sel={selIdx} onSelect={setSel} life={life} />
            <SpendingMatrix matrix={matrix} selKey={selMonth.key} />
          </>
        )}
      </main>

      {aaiOpen && <AaiChat onClose={() => setAaiOpen(false)} />}
      {isPersonal && <UnmappedCategories roomCode={roomCode} expenses={expenses} categories={categories} />}
      {!isPersonal && (
        <IdentitySheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          members={model.members}
          meId={me?.id}
          onPick={id => { setUserIdentity(id); setPickerOpen(false); }}
        />
      )}
    </div>
  );
}
