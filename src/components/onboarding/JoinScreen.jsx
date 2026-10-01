import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { joinRoom } from '../../services/roomService';
import { useRoomContext } from '../../context/RoomContext';
import { haptic } from '../../utils/haptics';
import { useToast } from '../ui/Toast';
import { ObPage, ObHeader } from './OnboardingBits';

// Same alphabet generateRoomCode() uses — no I, O, 0, 1.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEYS = ALPHABET.split('');

const STAMPS = { none: 'NO ROOM', shared: 'SHARED ROOM', personal: 'PERSONAL', offline: 'OFFLINE' };

/** Pull a 6-letter code out of pasted text — a bare code or a /join/CODE link. */
function extractCode(text) {
  const t = String(text || '').toUpperCase();
  const link = t.match(/JOIN\/([A-Z0-9]{6})/);
  const raw = link ? link[1] : t.replace(/[^A-Z0-9]/g, '');
  return raw.split('').filter(c => ALPHABET.includes(c)).slice(0, 6).join('');
}

export default function JoinScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code: linkCode } = useParams();
  const toast = useToast();
  const { joinRoomSession } = useRoomContext();
  const personal = location.state?.mode === 'personal';

  const [code, setCode] = useState(() => { const f = extractCode(linkCode); return f.length === 6 ? f : ''; });
  const [phase, setPhase] = useState('idle');       // idle | checking | bad | ok
  const [badKind, setBadKind] = useState('none');   // none | shared | personal | offline
  const [found, setFound] = useState(null);         // { code, name, members }
  const run = useRef(0);

  const check = useCallback(async full => {
    const id = ++run.current;
    setPhase('checking');
    try {
      const { roomData } = await joinRoom(full);
      if (id !== run.current) return;
      const isPers = !!roomData.isPersonal;
      if (personal && !isPers) {
        setBadKind('shared'); setFound({ code: full, name: roomData.name }); setPhase('bad'); haptic('error'); return;
      }
      if (!personal && isPers) {
        setBadKind('personal'); setFound({ code: full, name: roomData.name }); setPhase('bad'); haptic('error'); return;
      }
      setFound({ code: full, name: roomData.name, members: roomData.users?.length || 1 });
      setPhase('ok');
      haptic('success');
    } catch (err) {
      if (id !== run.current) return;
      setBadKind(/not found/i.test(err?.message || '') ? 'none' : 'offline');
      setFound(null); setPhase('bad'); haptic('error');
    }
  }, [personal]);

  const setFull = useCallback(full => { setCode(full); if (full.length === 6) check(full); }, [check]);

  const press = useCallback(c => {
    if (phase === 'checking' || phase === 'ok') return;
    haptic('tap');
    const base = phase === 'bad' ? '' : code;
    if (base.length >= 6) return;
    if (phase === 'bad') setPhase('idle');
    setFull(base + c);
  }, [phase, code, setFull]);

  const back = useCallback(() => {
    if (phase === 'checking') return;
    haptic('tap');
    run.current++;
    setPhase('idle'); setFound(null);
    setCode(phase === 'bad' || phase === 'ok' ? '' : code.slice(0, -1));
  }, [phase, code]);

  const paste = async () => {
    haptic('tap');
    try {
      const full = extractCode(await navigator.clipboard.readText());
      if (!full) { toast({ message: 'No room code on the clipboard', top: true, duration: 2200 }); return; }
      setPhase('idle');
      setFull(full);
    } catch {
      toast({ message: 'Couldn’t read the clipboard — type the code instead', top: true, duration: 2600 });
    }
  };

  // Opened from a shared link (/join/CODE): fill it in and check straight away.
  useEffect(() => {
    const full = extractCode(linkCode);
    if (full.length === 6) Promise.resolve().then(() => check(full));
  }, [linkCode, check]);

  // Hardware keyboard (desktop): letters/digits and Backspace.
  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') { back(); return; }
      const c = e.key.length === 1 ? e.key.toUpperCase() : '';
      if (c && ALPHABET.includes(c)) press(c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, back]);

  const enter = () => { if (!found) return; haptic('choose'); joinRoomSession(found.code); navigate('/dashboard'); };

  const bad = phase === 'bad';
  const ok = phase === 'ok';
  const hint = ok
    ? `${found.name} · ${personal ? 'personal' : `${found.members} ${found.members === 1 ? 'member' : 'members'}`}`
    : bad
      ? badKind === 'shared' ? `${found.code} is ${found.name}, a shared room — join it from the home screen.`
        : badKind === 'personal' ? 'That’s a personal tracker — use “Personal → I already have a code”.'
        : badKind === 'offline' ? 'Couldn’t reach the server — check your connection and try again'
        : 'No room with that code — check it and try again'
      : phase === 'checking' ? 'Checking the code…'
      : personal ? 'Enter the code of your personal tracker' : 'Ask a roommate for their 6-letter code';

  return (
    <ObPage>
      <ObHeader
        title={personal ? 'Join your tracker' : 'Join a room'}
        sub={personal ? 'PERSONAL · 6-LETTER CODE' : 'ENTER THE 6-LETTER CODE'}
        onBack={() => navigate(personal ? '/personal' : '/')}
      />
      <div className="ob-join ob-scr">
        <div className="ob-join__mid">
          <div className="ob-strip-wrap" style={bad ? { animation: 'ob-shake .5s both' } : undefined} key={bad ? `bad${code}` : 'n'}>
            <div className="ob-strip" role="group" aria-label={`Room code ${code.split('').join(' ')}`}>
              {[0, 1, 2, 3, 4, 5].map(i => {
                const ch = code[i] || '';
                const cls = ['ob-cell', ch && 'ob-cell--on', bad && ch && 'ob-cell--bad', ok && 'ob-cell--ok', phase === 'checking' && 'ob-cell--wait'].filter(Boolean).join(' ');
                return (
                  <span key={i} className={cls} style={{ '--d': `${(i * 0.12).toFixed(2)}s` }}>
                    <span className="ob-cell__hole" />
                    <span className="ob-cell__ch">{ch || '·'}</span>
                  </span>
                );
              })}
            </div>
            {bad && <span className="ob-stamp ob-stamp--bad">{STAMPS[badKind]}</span>}
            {ok && <span className="ob-stamp ob-stamp--ok">ADMIT</span>}
          </div>
          <span className={`ob-hint ${bad ? 'ob-hint--bad' : ok ? 'ob-hint--ok' : ''}`} aria-live="polite">{hint}</span>
          {ok && (
            <div className="ob-enter">
              <button type="button" className="se-btn se-btn--primary se-btn--lg se-press" onClick={enter}>Enter {found.name} →</button>
            </div>
          )}
        </div>

        <div className="ob-keys">
          {KEYS.map(k => (
            <button key={k} type="button" className="ob-key" onClick={() => press(k)}>{k}</button>
          ))}
        </div>
        <div className="ob-keyrow">
          <button type="button" className="ob-paste se-press" onClick={paste}>Paste code</button>
          <button type="button" className="ob-bk se-press" aria-label="Delete" onClick={back}>⌫</button>
        </div>
      </div>
    </ObPage>
  );
}
