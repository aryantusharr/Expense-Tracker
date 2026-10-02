import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomContext } from '../../context/RoomContext';
import { deleteRoom } from '../../services/roomService';
import { copyToClipboard } from '../../utils/helpers';
import { haptic } from '../../utils/haptics';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { summariseRoom, refreshRoomCaches, ROOM_DOTS, ICONS } from './onboardingData';
import { ObPage, Icon } from './OnboardingBits';
import { VERSION } from '../../version/version';

const SLIPS = [
  { t: '₹40', left: '18%', x: '-24px', r: '-30deg', d: '0s' },
  { t: '₹120', left: '48%', x: '10px', r: '20deg', d: '1.1s' },
  { t: '₹266', left: '76%', x: '30px', r: '40deg', d: '2.2s' },
  { t: '₹90', left: '34%', x: '-10px', r: '15deg', d: '1.7s' },
];

const KEYS = [
  { id: 'create', label: 'Create', to: '/create', c: '#8B7CFF', d: ICONS.plus },
  { id: 'join', label: 'Join', to: '/join', c: '#5FD4C4', d: ICONS.key },
  { id: 'personal', label: 'Personal', to: '/personal', c: '#FF8FB5', d: ICONS.user },
];

export default function LandingScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { savedRooms, joinRoomSession, forgetRoom } = useRoomContext();
  const [target, setTarget] = useState(null);   // room whose gear sheet is open
  const [confirming, setConfirming] = useState(false);

  // Fresh room details (budget, name) for every saved room, then redraw the rows.
  const [fresh, setFresh] = useState(0);
  const codes = savedRooms.map(r => r.code).join(',');
  useEffect(() => {
    let live = true;
    if (codes) refreshRoomCaches(savedRooms).then(() => { if (live) setFresh(n => n + 1); });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes]);

  const rows = useMemo(
    () => savedRooms.map((r, i) => ({ ...r, dot: ROOM_DOTS[i % ROOM_DOTS.length], ...summariseRoom(r) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedRooms, fresh]
  );
  const current = rows.find(r => r.code === target) || null;

  const open = code => { haptic('choose'); joinRoomSession(code); navigate('/dashboard'); };
  const closeSheet = () => { setTarget(null); setConfirming(false); };
  const say = (message, kind) => toast({ message, kind, top: true, duration: 2600 });

  const copyCode = async () => {
    const code = current.code;
    closeSheet();
    await copyToClipboard(code);
    haptic('success');
    say(<>Copied <b>{code}</b></>, 'success');
  };
  const removeLocal = () => {
    const { code, name } = current;
    closeSheet();
    forgetRoom(code);
    haptic('choose');
    say(<>Removed <b>{name}</b> from this device · rejoin with {code}</>);
  };
  const deleteForEveryone = () => {
    const { code, name } = current;
    closeSheet();
    deleteRoom(code).catch(() => { /* room doc deletion failed — it is removed locally either way */ });
    forgetRoom(code);
    haptic('error');
    say(<><b>{name}</b> deleted for everyone</>);
  };

  const warn = current
    ? `${current.count != null ? `All ${current.count} expenses` : 'All expenses'} ${current.isPersonal ? 'and your budget are gone from every device.' : 'disappear for every roommate too.'}`
    : '';

  return (
    <ObPage>
      <div className="ob-scr" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="ob-band">
          <span className="ob-brand">Split<span>Ease</span></span>
          <span className="ob-tag">Split fairly. Stay friends.</span>
          {SLIPS.map(s => (
            <span key={s.t} className="ob-slip" style={{ left: s.left, '--x': s.x, '--r': s.r, animationDelay: s.d }}>{s.t}</span>
          ))}
        </div>

        <div className="ob-sheet se-glass">
          <span className="ob-sheet__grab" />
          <span className="ob-label">{rows.length ? `Your rooms · ${rows.length}` : 'Your rooms'}</span>

          {rows.length > 0 ? (
            <div className="ob-rooms">
              {rows.map(r => (
                <div key={r.code} className="ob-room">
                  <button type="button" className="ob-room__main se-press" onClick={() => open(r.code)}>
                    <span className="ob-room__dot" style={{ '--c': r.dot }} />
                    <span className="ob-room__txt">
                      <span className="ob-room__name">{r.name}</span>
                      <span className="ob-room__sub">
                        {r.isPersonal ? 'PERSONAL' : `SHARED${r.memberCount ? ` · ${r.memberCount}` : ''}`} · {r.code}
                      </span>
                    </span>
                    {r.value && <span className={`ob-room__val ${r.tone !== 'neutral' ? `ob-room__val--${r.tone}` : ''}`}>{r.value}</span>}
                  </button>
                  <button type="button" aria-label={`${r.name} settings`} className="ob-gear se-press" onClick={() => { haptic('tap'); setTarget(r.code); }}>
                    <Icon d={ICONS.gear} size={17} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="ob-empty">No rooms on this phone yet. Create one, join with a code, or start a personal tracker.</p>
          )}

          <span className="ob-grow" />
          <span className="ob-label">Start something new</span>
          <div className="ob-new">
            {KEYS.map(k => (
              <button key={k.id} type="button" className="ob-orbit se-press" onClick={() => { haptic('tap'); navigate(k.to); }}>
                <span className="ob-orbit__ring" style={{ '--c': k.c }}>
                  <span className="ob-orbit__in"><Icon d={k.d} size={22} /></span>
                </span>
                {k.label}
              </button>
            ))}
          </div>
          <span className="ob-ver">SPLITEASE v{VERSION}</span>
        </div>
      </div>

      <Sheet open={!!current} onClose={closeSheet} labelledBy="ob-gsheet-name">
        {current && (
          <>
            <div className="ob-gsheet__head">
              <span className="ob-room__dot" style={{ '--c': current.dot }} />
              <span className="ob-gsheet__name" id="ob-gsheet-name">{current.name}</span>
              <span className="ob-room__sub">{current.isPersonal ? 'PERSONAL' : 'SHARED'} · {current.code}</span>
            </div>
            {!confirming ? (
              <div>
                <button type="button" className="ob-act se-press" onClick={() => open(current.code)}>
                  <Icon d={ICONS.open} size={18} />Open room
                </button>
                <button type="button" className="ob-act se-press" onClick={copyCode}>
                  <Icon d={ICONS.copy} size={18} />Copy join code
                </button>
                <button type="button" className="ob-act ob-act--pink se-press" onClick={() => { haptic('error'); setConfirming(true); }}>
                  <Icon d={ICONS.trash} size={18} />Delete for everyone
                </button>
                <button type="button" className="ob-act ob-act--red se-press" onClick={removeLocal}>
                  <Icon d={ICONS.out} size={18} />Remove from this device
                </button>
              </div>
            ) : (
              <>
                <div className="ob-confirm">
                  <b>Delete {current.name} for everyone?</b>
                  <span>{warn} This can’t be undone.</span>
                </div>
                <div className="ob-btnrow">
                  <button type="button" className="se-btn se-btn--secondary se-press" onClick={closeSheet}>Keep it</button>
                  <button type="button" className="se-btn ob-btn-del se-press" onClick={deleteForEveryone}>Delete</button>
                </div>
              </>
            )}
          </>
        )}
      </Sheet>
    </ObPage>
  );
}
