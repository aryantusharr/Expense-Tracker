import { useMemo, useState } from 'react';
import { useRoomContext } from '../../context/RoomContext';
import { useTheme } from '../../context/ThemeContext';
import { copyToClipboard } from '../../utils/helpers';
import { haptic } from '../../utils/haptics';
import { memberStyle, initialOf, monthWindow, fmt } from '../dashboard/dashboardData';
import { LineIcon } from '../ui/CategoryIcon';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import CategoriesSection from './CategoriesSection';
import ProfileSync from './ProfileSync';
import DataManagement from './DataManagement';
import './Settings.css';
import './SettingsScreen.css';

const P = {
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  data: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  room: 'M3 11l9-7 9 7v9H3z',
  swap: 'M7 7h13l-3-3M17 17H4l3 3',
};

const Pill = ({ icon, children }) => (
  <span className="st-pill"><LineIcon path={icon} size={14} strokeWidth={1.9} />{children}</span>
);

export default function SettingsScreen() {
  const { room, roomCode, expenses, users, categories, switchRoom, updateRoom, userIdentity, setUserIdentity, savedRooms } = useRoomContext();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const isPersonal = room?.isPersonal === true;
  const [copied, setCopied] = useState(0);
  const [sheet, setSheet] = useState(null);       // 'name' | 'budget' | null
  const [nameDraft, setNameDraft] = useState('');
  const [budDraft, setBudDraft] = useState(0);
  const [pulled, setPulled] = useState(0);
  const [wipe, setWipe] = useState(null);

  const budget = Number(room?.budget) || 0;
  const spent = useMemo(() => {
    const m = monthWindow(expenses).months;
    return m[m.length - 1]?.total || 0;
  }, [expenses]);
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  const copy = async () => {
    haptic('success');
    await copyToClipboard(roomCode);
    setCopied(c => c + 1);
    toast({ message: <>Copied <b>{roomCode}</b></>, kind: 'success', top: true, duration: 2200 });
  };

  const pull = () => {
    if (wipe) return;
    haptic('cord');
    setPulled(p => p + 1);
    const next = theme === 'dark' ? 'light' : 'dark';
    setWipe(next);
    setTimeout(toggleTheme, 320);
    setTimeout(() => setWipe(null), 950);
  };

  const openName = () => { haptic('tap'); setNameDraft(room?.name || ''); setSheet('name'); };
  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    try { await updateRoom(roomCode, { name }); haptic('success'); setSheet(null); toast({ message: <>Room renamed to <b>{name}</b></>, kind: 'success', top: true }); }
    catch (err) { toast({ message: 'Couldn’t rename', sub: String(err?.message || err), kind: 'error', top: true }); }
  };
  const openBudget = () => { haptic('tap'); setBudDraft(budget); setSheet('budget'); };
  const saveBudget = async () => {
    try { await updateRoom(roomCode, { budget: budDraft }); haptic('success'); setSheet(null); toast({ message: <>Budget set to <b>₹{fmt(budDraft)}</b></>, kind: 'success', top: true }); }
    catch (err) { toast({ message: 'Couldn’t save the budget', sub: String(err?.message || err), kind: 'error', top: true }); }
  };

  const a = theme === 'light' ? [0.2, 0.16, 0.1] : [0.5, 0.32, 0.22];
  const code = roomCode || '';
  const title = (room?.name || '').toUpperCase();

  return (
    <div className="se-page st">
      <div className="st-sky" aria-hidden="true">
        <span className="se-orb se-orb-1" style={{ width: 300, height: 300, left: -120, top: -60, background: `rgba(124,108,255,${a[0]})` }} />
        <span className="se-orb se-orb-2" style={{ width: 280, height: 280, right: -140, top: 360, background: `rgba(79,212,196,${a[1]})` }} />
        <span className="se-orb se-orb-3" style={{ width: 220, height: 220, left: 40, bottom: -80, background: `rgba(255,111,160,${a[2]})` }} />
      </div>

      <main className="st-main">
        <h1 className="st-title se-in">Settings</h1>

        {/* Room ID card */}
        <section className="st-room se-in" style={{ animationDelay: '.05s' }}>
          <div className="st-room__top">
            <div className="st-room__txt">
              <span className="st-mono st-mono--wide">
                {isPersonal ? 'PERSONAL ROOM · JUST YOU' : `SHARED ROOM · ${users.length} ${users.length === 1 ? 'MEMBER' : 'MEMBERS'}`}
              </span>
              <span className="st-room__name">{room?.name || '…'}</span>
            </div>
            <div className="st-stack">
              {users.slice(0, 6).map((u, i) => {
                const c = memberStyle(i).color;
                return <span key={u.id} className={`st-mono-m ${isPersonal ? 'st-mono-m--lg' : ''}`} style={{ '--c': c }} title={u.name}>{initialOf(u.name)}</span>;
              })}
            </div>
          </div>
          {!isPersonal && (
            <ProfileSync room={room} roomCode={roomCode} users={users} expenses={expenses} userIdentity={userIdentity}
              setUserIdentity={setUserIdentity} savedRooms={savedRooms} updateRoom={updateRoom} />
          )}
          {isPersonal && (
            <button type="button" className="st-bud se-press" onClick={openBudget}>
              <span className="st-bud__top">
                <span className="st-mono st-mono--wide">{budget > 0 ? 'MONTHLY BUDGET · TAP TO EDIT' : 'MONTHLY BUDGET · TAP TO SET'}</span>
                <span className="st-bud__val">₹{fmt(budget)}</span>
              </span>
              <span className="st-bud__bar"><span style={{ width: `${pct}%` }} /></span>
              <span className="st-mono st-teal">{budget > 0 ? `₹${fmt(spent)} SPENT · ₹${fmt(Math.max(0, budget - spent))} LEFT` : `₹${fmt(spent)} SPENT THIS MONTH`}</span>
            </button>
          )}
        </section>

        {/* Join code receipt */}
        <button type="button" className="st-code se-press se-in" style={{ animationDelay: '.1s' }} onClick={copy}>
          <span className="st-code__l">{title} · {isPersonal ? 'CODE' : 'JOIN CODE'}</span>
          <span className="st-code__c">{code}</span>
          <span className="st-code__s">{isPersonal ? 'TAP TO COPY · OPEN ON ANOTHER DEVICE' : 'TAP TO COPY · SHARE WITH ROOMMATES'}</span>
          {copied > 0 && <span key={copied} className="st-copied">COPIED</span>}
        </button>

        <Pill icon={P.tag}>Categories</Pill>
        <CategoriesSection roomCode={roomCode} categories={categories} expenses={expenses} />

        <Pill icon={P.sun}>Appearance</Pill>
        <div className="st-card se-glass st-appear">
          <div className="st-appear__txt">
            <span>Appearance</span>
            <span className="st-mono st-mono--wide">{theme === 'dark' ? 'DARK' : 'LIGHT'} · PULL THE CORD</span>
          </div>
          <button type="button" className={`st-cord ${pulled ? 'is-pulled' : ''}`} key={pulled} aria-label="Pull to switch theme" onClick={pull}>
            <span className="st-cord__line" />
            <span className="st-cord__knob" />
          </button>
        </div>

        <Pill icon={P.data}>Data</Pill>
        {/* Export / import — still the old controls until the S6 flows are rebuilt */}
        <DataManagement expenses={expenses} users={users} categories={categories} room={room} roomCode={roomCode} />

        <Pill icon={P.room}>Room</Pill>
        <div className="st-card se-glass st-rows">
          <button type="button" className="st-r se-press" onClick={() => { haptic('tap'); switchRoom(); }}>
            <span className="st-r__ic"><LineIcon path={P.swap} size={16} strokeWidth={1.9} /></span>
            <span className="st-r__t"><span>Switch room</span><small>Back to your rooms</small></span>
            <span className="st-r__chev">›</span>
          </button>
          <button type="button" className="st-r se-press" onClick={openName}>
            <span className="st-r__ic"><LineIcon path={P.room} size={16} strokeWidth={1.9} /></span>
            <span className="st-r__t"><span>Room name</span><small>{room?.name}</small></span>
            <span className="st-r__chev">✎</span>
          </button>
        </div>
      </main>

      {wipe && <div className="st-wipe" style={{ background: wipe === 'light' ? '#F4F4F8' : '#07071A' }} aria-hidden="true" />}

      <Sheet open={sheet === 'name'} onClose={() => setSheet(null)} labelledBy="st-name-t">
        <h2 className="se-sheet__title" id="st-name-t">Room name</h2>
        <label className="st-field">
          <span className="st-mono st-mono--wide">NAME</span>
          <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} maxLength={40} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') saveName(); }} />
        </label>
        <span className="st-note">Everyone in the room sees the new name.</span>
        <div className="st-btnrow">
          <button type="button" className="se-btn se-btn--secondary se-press" onClick={() => setSheet(null)}>Cancel</button>
          <button type="button" className="se-btn se-btn--primary se-press" disabled={!nameDraft.trim()} onClick={saveName}>Save name</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'budget'} onClose={() => setSheet(null)} labelledBy="st-bud-t">
        <h2 className="se-sheet__title" id="st-bud-t">Monthly budget</h2>
        <div className="st-big"><span>₹</span><b>{fmt(budDraft)}</b></div>
        <div className="st-steps">
          {[-1000, -500, 500, 1000].map(d => (
            <button key={d} type="button" className="st-step se-press"
              onClick={() => { haptic('tap'); setBudDraft(v => Math.max(0, v + d)); }}>{d < 0 ? '−' : '+'}₹{fmt(d)}</button>
          ))}
        </div>
        <span className="st-note st-note--c">₹{fmt(spent)} spent this month{budDraft > 0 ? ` · ₹${fmt(Math.max(0, budDraft - spent))} left` : ''}</span>
        <div className="st-btnrow">
          <button type="button" className="se-btn se-btn--secondary se-press" onClick={() => setSheet(null)}>Cancel</button>
          <button type="button" className="se-btn se-btn--primary se-press" onClick={saveBudget}>Save budget</button>
        </div>
      </Sheet>
    </div>
  );
}
