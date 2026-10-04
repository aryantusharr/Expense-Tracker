import { useEffect, useRef, useState } from 'react';
import { groupChats, chatTitle, chatMeta, isEditable } from '../../../aai/chatStore.js';
import { IcClose, IcNew } from './parts';

/**
 * Past chats (board AAI-Chat-8): a left drawer over a scrim. ACTIVE (open, or closed less than a minute ago) ·
 * EARLIER TODAY · READ ONLY · YESTERDAY · OLDER. Tapping an added card inside an old chat opens it in History.
 * current = the chat on screen (highlighted). onPick(chat) → continue it (active) or look at it read-only.
 */
const clock = t => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayShort = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function PastChats({ chats, openId, current, onPick, onNew, onClose }) {
  const [shown, setShown] = useState(false);
  const [now] = useState(() => Date.now());
  const closeRef = useRef(null);
  const groups = groupChats(chats, now, openId);

  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    return () => cancelAnimationFrame(r);
  }, []);

  const leave = fn => { setShown(false); setTimeout(fn, 200); };
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); setShown(false); setTimeout(onClose, 200); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <>
      <div className={`ch-scrim ${shown ? 'is-on' : ''}`} onClick={() => leave(onClose)} aria-hidden="true" />
      <nav className={`ch-pcs ${shown ? 'is-on' : ''}`} aria-label="Past chats">
        <div className="ch-pcs__h">
          <span className="ch-pcs__t">Chats</span>
          <button ref={closeRef} type="button" className="ch-ib" aria-label="Close past chats" onClick={() => leave(onClose)}><IcClose /></button>
        </div>
        <button type="button" className="ch-btn ch-btn--ghost ch-pcs__new" onClick={() => leave(onNew)}><IcNew /> New chat</button>
        <div className="ch-pcs__list">
          {groups.map(g => (
            <section key={g.key} aria-label={g.label}>
              <div className="ch-lab ch-pcs__lab">{g.label}</div>
              {g.items.map(c => {
                const editable = isEditable(c, now, openId);
                return (
                  <button key={c.id} type="button" className={`ch-pc ${c.id === current ? 'is-cur' : ''}`} aria-current={c.id === current ? 'true' : undefined} onClick={() => leave(() => onPick(c))}>
                    <span className="ch-pc__r">
                      <span className="ch-pc__n">{chatTitle(c.messages)}</span>
                      <span className="ch-mono ch-pc__t">{c.id === openId ? 'NOW' : g.key === 'older' || g.key === 'yesterday' ? dayShort(c.updatedAt) : clock(c.updatedAt)}</span>
                    </span>
                    <span className="ch-mono ch-pc__m">{chatMeta(c.messages, { locked: !editable })}</span>
                  </button>
                );
              })}
            </section>
          ))}
          {!groups.length && <div className="ch-mono ch-pcs__none">NO CHATS YET · ADD SOMETHING AND IT SHOWS UP HERE</div>}
        </div>
        <div className="ch-mono ch-pcs__note">A CHAT LOCKS 1 MINUTE AFTER YOU CLOSE IT · TAP AN ADDED CARD → OPENS IT IN HISTORY</div>
      </nav>
    </>
  );
}
