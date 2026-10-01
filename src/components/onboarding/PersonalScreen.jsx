import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPersonalTracker } from '../../services/roomService';
import { useRoomContext } from '../../context/RoomContext';
import { haptic } from '../../utils/haptics';
import { useToast } from '../ui/Toast';
import { fmt } from '../dashboard/dashboardData';
import ChatScreen from './ChatScreen';
import { useChat } from './useChat';

const PROGRESS = { name: 15, budget: 50, ready: 100, busy: 100 };
const since = () => `1 ${new Date().toLocaleString('en-GB', { month: 'short' })}`;

export default function PersonalScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { joinRoomSession } = useRoomContext();
  const { msgs, typing, bot, say } = useChat();
  const [step, setStep] = useState('wait');          // wait | name | budget | ready | busy
  const [data, setData] = useState({ name: '', budget: 0 });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => { await bot('What should we call you?'); setStep('name'); })();
  }, [bot]);

  const submitName = async name => {
    setStep('wait'); say(name);
    setData(d => ({ ...d, name }));
    await bot(`Hi ${name}! Want a monthly budget?`);
    setStep('budget');
  };

  const setBudget = async (amount, label) => {
    setStep('wait'); say(label);
    setData(d => ({ ...d, budget: amount }));
    await bot(amount > 0
      ? `Done — ₹${fmt(amount)} a month, starting ${since()}. I’ll show what’s left on your dashboard.`
      : 'No problem — you can add one later in Settings.');
    setStep('ready');
  };

  const typedBudget = text => {
    const n = parseInt(text.replace(/[^\d]/g, ''), 10);
    if (!n) { haptic('error'); return; }
    setBudget(n, `₹${fmt(n)}`);
  };

  const start = async () => {
    haptic('choose');
    setStep('busy');
    try {
      const { roomCode, roomData } = await createPersonalTracker(data.name, data.budget);
      joinRoomSession(roomCode);
      toast({ message: <><b>{roomData.name}</b> is ready · personal</>, kind: 'success', top: true, duration: 2600 });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      haptic('error');
      await bot(`Couldn’t create it (${err?.message || 'network problem'}). Try again?`);
      setStep('ready');
    }
  };

  let options = [];
  let input = null;
  if (step === 'name') {
    input = { placeholder: 'Your name', onSubmit: submitName };
    options = [{ t: 'I already have a code', kind: 'tint', fn: () => { haptic('tap'); navigate('/join', { state: { mode: 'personal' } }); } }];
  } else if (step === 'budget') {
    options = [
      { t: 'Yes, ₹8,000', kind: 'primary', fn: () => setBudget(8000, 'Yes, ₹8,000') },
      { t: '₹5,000', fn: () => setBudget(5000, '₹5,000') },
      { t: 'Not now', fn: () => setBudget(0, 'Not now') },
    ];
    input = { placeholder: 'Or type an amount', inputMode: 'numeric', maxLength: 9, onSubmit: typedBudget };
  } else if (step === 'ready' || step === 'busy') {
    options = [{ t: step === 'busy' ? 'Setting up…' : 'Start tracking →', kind: 'primary', disabled: step === 'busy', fn: start }];
  }

  return (
    <ChatScreen
      title="Just me" sub="PERSONAL SETUP" progress={PROGRESS[step] ?? 15}
      msgs={msgs} typing={typing} options={options} input={input}
    />
  );
}
