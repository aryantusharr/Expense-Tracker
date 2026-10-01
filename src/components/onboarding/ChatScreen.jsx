import { useEffect, useRef, useState } from 'react';
import { ObPage, ObHeader } from './OnboardingBits';

/**
 * Chat layout shared by Create and Personal: header, progress bar, bubbles, answer chips,
 * and (on free-text steps) a small input row. `options`: [{ t, fn, kind: 'primary'|'tint' }].
 */
export default function ChatScreen({ title, sub, progress, msgs, typing, options = [], input, onBack }) {
  const endRef = useRef(null);
  const [text, setText] = useState('');
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, typing, options.length]);

  const submit = e => {
    e.preventDefault();
    const v = text.trim();
    if (!v || !input) return;
    setText('');
    input.onSubmit(v);
  };

  return (
    <ObPage>
      <ObHeader title={title} sub={sub} onBack={onBack} />
      <div className="ob-chat ob-scr">
        <div className="ob-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="ob-prog__bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="ob-msgs" aria-live="polite">
          {msgs.map((m, i) => (
            <span key={i} className={`ob-bub ${m.me ? 'ob-bub--me' : 'ob-bub--bot'} ${m.bad ? 'ob-bub--bad' : ''}`}>
              {m.t}
              {m.bad && <span className="ob-stamp ob-stamp--bad ob-stamp--taken">TAKEN</span>}
            </span>
          ))}
          {typing && (
            <span className="ob-typing" aria-label="Typing">
              <i /><i style={{ animationDelay: '.2s' }} /><i style={{ animationDelay: '.4s' }} />
            </span>
          )}
          <span ref={endRef} />
        </div>

        <div className="ob-opts">
          {options.map(o => (
            <button key={o.t} type="button" disabled={o.disabled}
              className={`ob-chip se-press ${o.kind ? `ob-chip--${o.kind}` : ''}`} onClick={o.fn}>{o.t}</button>
          ))}
        </div>

        {input && (
          <form className="ob-input se-glass" onSubmit={submit}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={input.placeholder}
              inputMode={input.inputMode}
              maxLength={input.maxLength || 40}
              autoComplete="off"
              autoCapitalize={input.inputMode === 'numeric' ? 'off' : 'words'}
              aria-label={input.placeholder}
              disabled={input.disabled}
            />
            <button type="submit" className="ob-send se-press" aria-label="Send" disabled={!text.trim() || input.disabled}>↑</button>
          </form>
        )}
      </div>
    </ObPage>
  );
}
