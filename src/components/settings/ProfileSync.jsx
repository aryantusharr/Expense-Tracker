import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomContext } from '../../context/RoomContext';
import { syncExistingSharedExpenses, removeSyncedExpensesFromPersonalRooms } from '../../services/expenseService';
import { roomStatus } from '../../services/roomService';
import { haptic } from '../../utils/haptics';
import { memberStyle, initialOf, fmt } from '../dashboard/dashboardData';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';

const ECG = 'M0 7 H11 L13 7 L15 1 L19 13 L21 4 L23 7 H34';
const LABEL = { on: 'SYNCING', ok: 'IN SYNC', off: 'SYNC OFF', wait: 'OFFLINE' };

/** Online / offline, live. */
function useOnline() {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOn(true); const down = () => setOn(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}
const Arrow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="ps-arrow">
    <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const cachedBudget = code => {
  try { return Number(JSON.parse(localStorage.getItem(`splitease_room_cache_${code}`) || 'null')?.budget) || 0; } catch { return 0; }
};

/**
 * Profile sync (boards S3g + S3d): the pill that lives in the room card, and its sheet —
 * info / turn off / 3-step setup / SYNC ON. Same data operations as the old SyncSettings.
 */
export default function ProfileSync({ room, roomCode, users, expenses, userIdentity, setUserIdentity, savedRooms, updateRoom }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [view, setView] = useState(null);          // null | on | off | confirmOff | setup | done
  const [step, setStep] = useState(0);
  const [who, setWho] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(0);
  const [progress, setProgress] = useState(null);   // { done, total } while past expenses are copied

  const personal = useMemo(() => savedRooms.filter(r => r.isPersonal), [savedRooms]);
  const me = users.find(u => u.id === userIdentity);
  const linked = me?.personalRoomCode ? savedRooms.find(r => r.code === me.personalRoomCode) : null;

  // Is the linked personal room still there? (server-confirmed; offline keeps the last state)
  const [linkCheck, setLinkCheck] = useState({ code: null, status: 'unknown', name: '' });
  useEffect(() => {
    const code = me?.personalRoomCode;
    if (!code) return undefined;
    let live = true;
    roomStatus(code).then(r => { if (live) setLinkCheck({ code, status: r.status, name: r.data?.name || '' }); });
    return () => { live = false; };
  }, [me?.personalRoomCode]);
  const linkGone = linkCheck.code === me?.personalRoomCode && linkCheck.status === 'gone';
  // Deleted elsewhere → clear my dead link once (same write as "Turn off").
  const unlinked = useRef(null);
  useEffect(() => {
    if (!linkGone || unlinked.current === me?.personalRoomCode) return;
    unlinked.current = me?.personalRoomCode;
    updateRoom(roomCode, { users: users.map(u => (u.id === userIdentity ? { ...u, personalRoomCode: null } : u)) }).catch(() => {});
  }, [linkGone, me?.personalRoomCode, roomCode, updateRoom, users, userIdentity]);

  const active = Boolean(me?.personalRoomCode) && !linkGone;
  const roomName = room?.name || 'this room';
  const linkedName = linked?.name || (linkCheck.code === me?.personalRoomCode && linkCheck.name) || 'your personal room';

  // Synced, but the personal room isn't in this phone's list (reinstall / new phone): offer to add it back.
  const { rememberRoom } = useRoomContext();
  const awayFromPhone = active && !linked && linkCheck.code === me?.personalRoomCode && linkCheck.status === 'exists';
  const addToPhone = () => {
    rememberRoom({ code: me.personalRoomCode, name: linkCheck.name || 'Personal room', isPersonal: true, memberCount: 1 });
    haptic('success');
    say(<>Added <b>{linkCheck.name || 'your personal room'}</b> · open it from ⇄ Switch room</>, 'success');
  };

  // Sync pill (board Input-SyncPill-Final): one ECG spike per copy, count = copies of my share.
  const online = useOnline();
  const copies = useMemo(() => (active ? expenses.filter(e => (e.splitAmong || []).includes(userIdentity) && (parseFloat(e.amount) || 0) > 0).length : 0), [expenses, active, userIdentity]);
  const lastCopies = useRef(copies);
  const [beating, setBeating] = useState(false);
  useEffect(() => {
    if (copies === lastCopies.current) return undefined;
    const grew = copies > lastCopies.current;
    lastCopies.current = copies;
    if (!grew) return undefined;
    setBeating(true);
    haptic('tap');
    const t = setTimeout(() => setBeating(false), 4100);
    return () => clearTimeout(t);
  }, [copies]);
  const pill = !active ? 'off' : !online ? 'wait' : (beating || progress) ? 'on' : 'ok';
  const count = progress ? progress.done : copies;

  const whoUser = users.find(u => u.id === who);
  const preview = useMemo(() => {
    let n = 0; let share = 0;
    for (const e of expenses) {
      const split = e.splitAmong || [];
      if (who && split.includes(who)) { n += 1; share += (parseFloat(e.amount) || 0) / split.length; }
    }
    return { n, share };
  }, [expenses, who]);

  const openSheet = () => { haptic('tap'); setView(active ? 'on' : 'off'); };
  const beginSetup = () => {
    haptic('tap');
    setWho(userIdentity || '');
    setTarget(me?.personalRoomCode || '');
    setStep(0);
    setView('setup');
  };
  const close = () => setView(null);
  const say = (message, kind) => toast({ message, kind, top: true, duration: 3200 });

  const turnOff = async () => {
    setBusy(true);
    try {
      await updateRoom(roomCode, { users: users.map(u => (u.id === userIdentity ? { ...u, personalRoomCode: null } : u)) });
      haptic('choose');
      close();
      say('Sync is off · new expenses won’t be copied');
    } catch { haptic('error'); say('Couldn’t turn sync off — try again', 'error'); }
    setBusy(false);
  };

  const finish = async () => {
    if (!who || !target || busy) return;
    setBusy(true);
    try {
      // Only this member's old personal room (the target is updated in place) — never other members' rooms on this phone.
      const oldCode = users.find(u => u.id === who)?.personalRoomCode;
      setProgress({ done: 0, total: 0 });
      await removeSyncedExpensesFromPersonalRooms(roomCode, [oldCode].filter(c => c && c !== target));
      const next = users.map(u => {
        if (u.id === who) return { ...u, personalRoomCode: target };
        if (u.personalRoomCode === target || u.id === userIdentity) return { ...u, personalRoomCode: null, _lastPersonalRoomCode: u.personalRoomCode };
        return u;
      });
      await updateRoom(roomCode, { users: next });
      setUserIdentity(who);
      const n = await syncExistingSharedExpenses(roomCode, roomName, target, who, (done, total) => setProgress({ done, total }));
      haptic('success');
      setCopied(n);
      setView('done');
      setTimeout(() => setView(v => (v === 'done' ? null : v)), 2600);
    } catch { haptic('error'); say('Couldn’t set up sync — try again', 'error'); }
    setProgress(null);
    setBusy(false);
  };

  const next = () => {
    if (step === 0 && who) { haptic('tap'); setStep(1); }
    else if (step === 1 && target) { haptic('tap'); setStep(2); }
    else if (step === 2) finish();
  };
  const back = () => { if (step === 0) setView(active ? 'on' : 'off'); else setStep(step - 1); };
  const targetName = savedRooms.find(r => r.code === target)?.name || '';

  return (
    <>
      <button type="button" className={`ps-pill ps-pill--${pill} se-press`} onClick={openSheet}
        aria-label={`Profile sync: ${LABEL[pill].toLowerCase()}${pill !== 'off' ? `, ${count} copies in ${linkedName}` : ', tap to set up'}`}>
        <span className="ps-l1">
          <span className={`ps-dot ${pill === 'on' ? 'ps-dot--blink' : ''}`} aria-hidden="true" />
          <span className="ps-txt">{LABEL[pill]}</span>
          <span className="ps-ecg ps-bump" key={`b${count}`} aria-hidden="true">
            <svg viewBox="0 0 34 14" preserveAspectRatio="none"><path d={ECG} /></svg>
          </span>
          {pill !== 'off' && <span className="ps-cnt" key={`c${count}`} aria-hidden="true">{count}</span>}
        </span>
        <span className="ps-l2" aria-hidden="true">
          {pill === 'off' ? (linkGone ? 'ROOM DELETED · TAP TO PICK ANOTHER' : 'TAP TO PICK A PERSONAL ROOM')
            : `→ ${linkedName.toUpperCase()} · ${pill === 'on' ? 'COPYING' : pill === 'wait' ? 'WAITING' : 'UP TO DATE'}`}
        </span>
      </button>

      <Sheet open={!!view} onClose={close} labelledBy="ps-title">
        {view === 'on' && (
          <>
            <div className="ps-head"><h2 className="se-sheet__title" id="ps-title">Profile sync</h2><span className="ps-stamp">SYNC ON</span></div>
            <div className="ps-link se-glass">
              <span className="st-mono-m" style={{ '--c': memberStyle(Math.max(0, users.findIndex(u => u.id === userIdentity))).color, width: 34, height: 34 }}>{initialOf(me?.name)}</span>
              <Arrow />
              <div className="ps-link__t"><b>{linkedName}</b><span className="st-mono">YOUR SHARE OF EVERY EXPENSE</span></div>
            </div>
            {awayFromPhone && (
              <div className="ps-away se-pop">
                <span className="ps-away__k">NOT ON THIS PHONE YET</span>
                <b>Your copies are safe — sync never stopped.</b>
                <p>
                  {linkedName} is still being filled with your share of every expense here. It just isn’t in this phone’s
                  room list, which happens after reinstalling the app or switching phones.
                </p>
                <p>Add it back to see your own spending and budget on this phone. Nothing is copied twice and nothing changes for your roommates.</p>
                <button type="button" className="se-btn se-btn--primary se-press ps-away__btn" onClick={addToPhone}>Add {linkedName} to this phone</button>
              </div>
            )}
            <div className="ps-rules">• Copies are read-only and carry the COPY stamp<br />• Edits and deletes here update the copy<br />• If your share drops to ₹0, the copy is removed</div>
            <div className="st-btnrow">
              <button type="button" className="se-btn se-btn--secondary se-press" onClick={beginSetup}>Change</button>
              <button type="button" className="se-btn se-btn--danger se-press" onClick={() => { haptic('error'); setView('confirmOff'); }}>Turn off</button>
            </div>
          </>
        )}
        {view === 'confirmOff' && (
          <>
            <h2 className="se-sheet__title" id="ps-title">Turn off sync?</h2>
            <p className="ps-body">New expenses in {roomName} won’t be copied to <b>{linkedName}</b>. Copies already there stay.</p>
            <div className="st-btnrow">
              <button type="button" className="se-btn se-btn--secondary se-press" onClick={() => setView('on')}>Keep on</button>
              <button type="button" className="se-btn st-del se-press" disabled={busy} onClick={turnOff}>Turn off</button>
            </div>
          </>
        )}
        {view === 'off' && (
          <>
            <div className="ps-head"><h2 className="se-sheet__title" id="ps-title">Profile sync</h2><span className="ps-stamp ps-stamp--off">SYNC OFF</span></div>
            <p className="ps-body">Copy your share of {roomName} expenses into one of your personal rooms automatically.</p>
            <button type="button" className="se-btn se-btn--primary se-btn--block se-press" onClick={beginSetup}>Set up sync</button>
          </>
        )}
        {view === 'setup' && (
          <>
            <div className="ps-steps">{[0, 1, 2].map(i => <span key={i} className={i <= step ? 'is-on' : ''} />)}</div>
            {step === 0 && (
              <>
                <h2 className="se-sheet__title" id="ps-title">Who are you in {roomName}?</h2>
                <div className="ob-who">
                  {users.map((u, i) => (
                    <button key={u.id} type="button" className={`ob-who__b se-press ${who === u.id ? 'is-on' : ''}`} style={{ '--c': memberStyle(i).color }}
                      onClick={() => { haptic('choose'); setWho(u.id); }}>
                      <span className="ob-who__m">{initialOf(u.name)}</span><span>{u.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h2 className="se-sheet__title" id="ps-title">Copy into which personal room?</h2>
                {personal.length === 0 ? (
                  <>
                    <p className="ps-body">There’s no personal room on this device yet.</p>
                    <button type="button" className="se-btn se-btn--secondary se-btn--block se-press" onClick={() => { close(); navigate('/personal'); }}>Create a personal room</button>
                  </>
                ) : personal.map(r => {
                  const b = cachedBudget(r.code);
                  return (
                    <button key={r.code} type="button" className={`ps-room se-press ${target === r.code ? 'is-on' : ''}`} onClick={() => { haptic('choose'); setTarget(r.code); }}>
                      <span><b>{r.name}</b><span className="st-mono">PERSONAL · {b > 0 ? `BUDGET ₹${fmt(b)}` : 'NO BUDGET'}</span></span>
                      <span className="ps-room__tick">✓</span>
                    </button>
                  );
                })}
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="se-sheet__title" id="ps-title">Copy past expenses too?</h2>
                <div className="ps-receipt">
                  <b>{(whoUser?.name || '').toUpperCase()} → {targetName.toUpperCase()}</b>
                  <span className="ps-receipt__rule" />
                  <span><span>PAST EXPENSES</span><span>{preview.n}</span></span>
                  <span><span>YOUR SHARE</span><b>₹{Math.round(preview.share).toLocaleString('en-IN')}</b></span>
                  <small>COPIES ARE READ-ONLY · STAMPED “COPY”</small>
                </div>
              </>
            )}
            <div className="st-btnrow">
              <button type="button" className="se-btn se-btn--secondary se-press" onClick={back}>Back</button>
              <button type="button" className="se-btn se-btn--primary se-press" disabled={busy || (step === 0 && !who) || (step === 1 && !target)} onClick={next}>
                {step === 2 ? (busy ? (progress?.total ? `Copying ${progress.done} / ${progress.total}` : 'Syncing…') : 'Turn on sync') : 'Next'}
              </button>
            </div>
          </>
        )}
        {view === 'done' && (
          <div className="ps-done">
            <span className="ps-stamp ps-stamp--big" id="ps-title">SYNC ON</span>
            <span className="ps-body">{copied} past {copied === 1 ? 'expense' : 'expenses'} copied to {targetName}</span>
          </div>
        )}
      </Sheet>
    </>
  );
}
