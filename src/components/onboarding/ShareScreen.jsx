import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoomContext } from '../../context/RoomContext';
import { copyToClipboard, shareRoom } from '../../utils/helpers';
import { syncExistingSharedExpenses, removeSyncedExpensesFromPersonalRooms } from '../../services/expenseService';
import { createPersonalTracker } from '../../services/roomService';
import { haptic } from '../../utils/haptics';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { memberStyle, initialOf } from '../dashboard/dashboardData';
import { ROOM_DOTS } from './onboardingData';
import { ObPage, ObHeader } from './OnboardingBits';

export default function ShareScreen() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { room, savedRooms, updateRoom, setUserIdentity, userIdentity, rememberRoom } = useRoomContext();
  const [stamp, setStamp] = useState(0);              // bump to replay the COPIED stamp
  const [sync, setSync] = useState(0);                // 0 closed · 1 ask · 2 pick · 3 receipt
  const [meIdx, setMeIdx] = useState(0);
  const [roomIdx, setRoomIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [making, setMaking] = useState(false);
  const [progress, setProgress] = useState(null);

  const users = useMemo(() => room?.users || [], [room?.users]);
  const roomName = room?.name || savedRooms.find(r => r.code === code)?.name || 'your room';
  const personal = useMemo(() => savedRooms.filter(r => r.isPersonal), [savedRooms]);
  const you = users.find(u => u.id === userIdentity) || users[0];
  const pickedUser = users[meIdx] || users[0];
  const pickedRoom = personal[roomIdx];

  const copy = async () => {
    haptic('success');
    await copyToClipboard(code);
    setStamp(s => s + 1);
  };
  const share = async () => {
    haptic('tap');
    try {
      if (!(await shareRoom(code, roomName))) await copy();
    } catch { /* share sheet dismissed */ }
  };

  const openAsk = () => {
    haptic('tap');
    const i = users.findIndex(u => u.id === userIdentity);
    setMeIdx(i >= 0 ? i : 0);
    setSync(1);
  };
  const skip = () => {
    setSync(0);
    toast({ message: 'Sync is off · turn it on anytime in Settings', top: true, duration: 2600 });
    navigate('/dashboard', { replace: true });
  };
  const doSync = async () => {
    if (!pickedUser || !pickedRoom || busy) return;
    setBusy(true);
    try {
      // Only this member's old personal room (the target is updated in place) — never other members' rooms on this phone.
      await removeSyncedExpensesFromPersonalRooms(code, [pickedUser.personalRoomCode].filter(c => c && c !== pickedRoom.code));
      const updatedUsers = users.map(u => (u.id === pickedUser.id ? { ...u, personalRoomCode: pickedRoom.code } : u));
      await updateRoom(code, { users: updatedUsers });
      setUserIdentity(pickedUser.id);
      await syncExistingSharedExpenses(code, roomName, pickedRoom.code, pickedUser.id, (done, total) => setProgress({ done, total }));
      haptic('success');
      setSync(3);
    } catch (err) {
      haptic('error');
      toast({ message: 'Couldn’t set up sync', sub: String(err?.message || err), kind: 'error', top: true });
    }
    setProgress(null);
    setBusy(false);
  };
  // No personal room on this phone yet: make one for the picked member right here (no dead end).
  const makePersonal = async () => {
    if (!pickedUser || making) return;
    haptic('tap'); setMaking(true);
    try {
      const { roomCode, roomData } = await createPersonalTracker(pickedUser.name, 0);
      rememberRoom({ code: roomCode, name: roomData.name, isPersonal: true, memberCount: 1 });
      setRoomIdx(0);
      haptic('success');
    } catch (err) {
      haptic('error');
      toast({ message: 'Couldn’t create a personal room', sub: String(err?.message || err), kind: 'error', top: true });
    }
    setMaking(false);
  };
  const finish = () => {
    setSync(0);
    toast({ message: <>Sync on · <b>{roomName}</b> → {pickedRoom?.name}</>, kind: 'success', top: true, duration: 2800 });
    navigate('/dashboard', { replace: true });
  };

  return (
    <ObPage>
      <ObHeader title="Invite roommates" sub={`SHARE · ${roomName.toUpperCase()}`} onBack={() => navigate('/dashboard', { replace: true })} />
      <div className="ob-share ob-scr">
        <div className="ob-share__mid">
          <div className="ob-card">
            <div className="ob-card__main">
              <span className="ob-card__title">Join {roomName}!</span>
              <span className="ob-card__how">Open SplitEase → Join →<br />enter this code</span>
              <span className="ob-card__code">{code}</span>
              <span className="ob-card__rule" />
              <span className="ob-card__sig">— {you?.name || ''}</span>
            </div>
            <div className="ob-card__div" />
            <div className="ob-card__side">
              <span className="ob-card__stampbox"><b>₹</b><span>SPLITEASE</span></span>
              <span className="ob-card__seats">{users.length || ''} SEATS</span>
            </div>
            {stamp > 0 && <span key={stamp} className="ob-stamp ob-stamp--ok ob-stamp--copied">COPIED</span>}
          </div>
          <span className="ob-hint">Anyone with the code can join. You can find it later in Settings.</span>
        </div>

        <div className="ob-btnrow">
          <button type="button" className="se-btn se-btn--secondary se-press" onClick={copy}>Copy code</button>
          <button type="button" className="se-btn se-btn--primary se-press" onClick={share}>Share</button>
        </div>
        <button type="button" className="ob-link se-press" onClick={openAsk}>Go to {roomName} →</button>
      </div>

      <Sheet open={sync === 1 || sync === 2} onClose={() => (sync === 2 ? setSync(1) : skip())} labelledBy="ob-sync-title">
        {sync === 1 && (
          <>
            <h2 className="ob-sync__title" id="ob-sync-title">Sync your share to a personal room?</h2>
            <p className="ob-sync__body">Your share of every {roomName} expense shows up in your personal tracker as a read-only copy. You can turn it off in Settings.</p>
            <div className="ob-flow se-glass">
              <span className="ob-flow__slip">₹427</span>
              <span className="ob-flow__line" />
              <span className="ob-flow__lbl">COPY → MY ROOM</span>
            </div>
            <div className="ob-btnrow">
              <button type="button" className="se-btn se-btn--secondary se-press" onClick={skip}>Not now</button>
              <button type="button" className="se-btn se-btn--primary se-press" onClick={() => { haptic('tap'); setSync(2); }}>Set up sync</button>
            </div>
          </>
        )}
        {sync === 2 && (
          <>
            <span className="ob-label">Step 1 of 2</span>
            <h2 className="ob-sync__title" id="ob-sync-title">Which one is you?</h2>
            <div className="ob-who">
              {users.map((u, i) => {
                const c = memberStyle(i).color;
                return (
                  <button key={u.id} type="button" className={`ob-who__b se-press ${meIdx === i ? 'is-on' : ''}`}
                    style={{ '--c': c }} onClick={() => { haptic('choose'); setMeIdx(i); }}>
                    <span className="ob-who__m">{initialOf(u.name)}</span>
                    <span>{u.name}</span>
                  </button>
                );
              })}
            </div>
            <span className="ob-label" style={{ marginTop: 4 }}>Step 2 of 2 · Sync into</span>
            {personal.length === 0 ? (
              <>
                <p className="ob-sync__warn">No personal room on this phone yet.</p>
                <button type="button" className="se-btn se-btn--secondary se-btn--block se-press" disabled={making} onClick={makePersonal}>
                  {making ? 'Creating…' : `Create one for ${pickedUser?.name || 'me'}`}
                </button>
              </>
            ) : personal.map((r, i) => (
              <button key={r.code} type="button" className={`ob-prow se-press ${roomIdx === i ? 'is-on' : ''}`} onClick={() => { haptic('choose'); setRoomIdx(i); }}>
                <span className="ob-room__dot" style={{ '--c': ROOM_DOTS[(i + 1) % 3], width: 10, height: 10, boxShadow: 'none' }} />
                <span className="ob-prow__n">{r.name}</span>
                <span className="ob-prow__radio" />
              </button>
            ))}
            {personal.length > 0 && <span className="ob-sync__amber">Past {roomName} expenses get copied too.</span>}
            <div className="ob-btnrow">
              <button type="button" className="se-btn se-btn--secondary se-press" onClick={() => setSync(1)}>Back</button>
              <button type="button" className="se-btn se-btn--primary se-press" disabled={!pickedRoom || busy} onClick={doSync}>
                {busy ? (progress?.total ? `Copying ${progress.done} / ${progress.total}` : 'Syncing…') : `Sync ${pickedUser?.name || ''} → ${pickedRoom?.name || ''}`}
              </button>
            </div>
          </>
        )}
      </Sheet>

      {sync === 3 && createPortal(
        <div className="ob-receipt-scr se-page ob-scr">
          <div className="ob-receipt se-print">
            <b>SYNC SET UP</b>
            <span>{roomName.toUpperCase()} · {(pickedUser?.name || '').toUpperCase()}</span>
            <span className="ob-receipt__rule" />
            <span>→ {(pickedRoom?.name || '').toUpperCase()} (PERSONAL)</span>
            <span className="ob-receipt__dim">Every new share copies over</span>
            <span className="ob-stamp ob-stamp--ok ob-stamp--syncon">SYNC ON</span>
          </div>
          <button type="button" className="se-btn se-btn--primary se-btn--lg se-btn--block se-press" onClick={finish}>Go to {roomName} →</button>
        </div>,
        document.body
      )}
    </ObPage>
  );
}
