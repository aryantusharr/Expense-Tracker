import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, checkRoomNameExists } from '../../services/roomService';
import { useRoomContext } from '../../context/RoomContext';
import { haptic } from '../../utils/haptics';
import ChatScreen from './ChatScreen';
import { useChat } from './useChat';

const PROGRESS = { count: 8, room: 28, you: 50, mates: 72, ready: 100, busy: 100 };

export default function CreateScreen() {
  const navigate = useNavigate();
  const { joinRoomSession } = useRoomContext();
  const chat = useChat();
  const { msgs, typing, bot, say, markLastBad } = chat;
  const [step, setStep] = useState('wait');          // wait | count | room | you | mates | ready | busy
  const [data, setData] = useState({ count: 2, room: '', you: '', mates: [] });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      await bot('Let’s set up your room. How many of you share it?');
      setStep('count');
    })();
  }, [bot]);

  const pickCount = async n => {
    setStep('wait'); say(String(n));
    setData(d => ({ ...d, count: n }));
    await bot('Nice. What’s the room called?');
    setStep('room');
  };

  const submitRoom = async name => {
    setStep('wait'); say(name);
    let taken;
    try { taken = await checkRoomNameExists(name); } catch { taken = false; }
    if (taken) {
      haptic('error'); markLastBad();
      // Offer up to two free variations as tap chips (board E3: bot suggests others).
      const ideas = [`${name} 2`, `${name} Home`, `${name} Flat`];
      const free = [];
      for (const idea of ideas) {
        if (free.length === 2) break;
        try { if (!(await checkRoomNameExists(idea))) free.push(idea); } catch { /* skip */ }
      }
      await chat.wait(300);
      await bot(free.length
        ? `${name} already exists. Try ${free.join(' or ')} — or join it with its code.`
        : `${name} already exists. Try another — or join it with its code.`);
      setData(d => ({ ...d, taken: name, ideas: free }));
      setStep('room');
      return;
    }
    setData(d => ({ ...d, room: name, taken: '' }));
    await bot('And what should roommates call you?');
    setStep('you');
  };

  // Two members with the same name would be impossible to tell apart in "Who are you?".
  const isDuplicate = (name, others) => others.some(o => o.trim().toLowerCase() === name.trim().toLowerCase());
  const rejectDuplicate = async (name, prev) => {
    setStep('wait'); say(name); haptic('error'); markLastBad();
    await chat.wait(450);
    await bot(`${name} is already in this room — add a different name.`);
    setStep(prev);
  };

  const submitYou = async name => {
    setStep('wait'); say(name);
    setData(d => ({ ...d, you: name }));
    const need = data.count - 1;
    await bot(`Who else lives there? Add ${need} ${need === 1 ? 'name' : 'names'} — they’ll pick theirs when they join.`);
    setStep('mates');
  };

  const submitMate = async name => {
    if (isDuplicate(name, [data.you, ...data.mates])) { await rejectDuplicate(name, 'mates'); return; }
    const mates = [...data.mates, name];
    say(name);
    setData(d => ({ ...d, mates }));
    if (mates.length >= data.count - 1) {
      setStep('wait');
      await bot(`All set — ${data.room} is ready for ${data.count}: ${[data.you, ...mates].join(', ')}. Time to invite them.`);
      setStep('ready');
    }
  };

  const invite = async () => {
    haptic('choose');
    setStep('busy');
    try {
      const { roomCode, roomData } = await createRoom(data.room, [data.you, ...data.mates]);
      // The creator is the first member — remember that on this phone.
      localStorage.setItem(`splitease_identity_${roomCode}`, roomData.users[0].id);
      joinRoomSession(roomCode);
      navigate(`/share/${roomCode}`, { replace: true });
    } catch (err) {
      haptic('error');
      await bot(`Couldn’t create the room (${err?.message || 'network problem'}). Try again?`);
      setStep('ready');
    }
  };

  let options = [];
  let input = null;
  if (step === 'count') {
    options = [2, 3, 4, 5, 6].map(n => ({ t: String(n), fn: () => pickCount(n) }));
  } else if (step === 'room') {
    input = { placeholder: 'Room name', onSubmit: submitRoom };
    if (data.taken) options = [
      ...(data.ideas || []).map(idea => ({ t: idea, fn: () => submitRoom(idea) })),
      { t: `Join ${data.taken} instead`, kind: 'tint', fn: () => navigate('/join') },
    ];
  } else if (step === 'you') {
    input = { placeholder: 'Your name', onSubmit: submitYou };
  } else if (step === 'mates') {
    input = { placeholder: `Roommate ${data.mates.length + 1} of ${data.count - 1}`, onSubmit: submitMate };
  } else if (step === 'ready' || step === 'busy') {
    options = [{ t: step === 'busy' ? 'Creating…' : 'Invite roommates →', kind: 'primary', disabled: step === 'busy', fn: invite }];
  }

  return (
    <ChatScreen
      title="New room" sub="CREATE · SHARED" progress={PROGRESS[step] ?? 8}
      msgs={msgs} typing={typing} options={options} input={input}
    />
  );
}
