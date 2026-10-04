/**
 * An error as an AAI reply (board AAI-Chat-7): tinted box, round stamp, plain reason, two buttons, mono DETAILS line.
 * The copy + actions live in src/aai/errors.js; the chat decides what each action id does.
 * resolved → the buttons are gone (the person already chose); readOnly (old chat) → no buttons either.
 */
export default function ErrorReply({ err, resolved, readOnly, onAction }) {
  const long = err.stamp.includes(' ');                  // "NOT A BILL" → two lines
  const small = !long && err.stamp.length >= 7;          // UNCLEAR / OFFLINE: smaller so the word stays inside the ring
  return (
    <div className={`ch-err ch-err--${err.tone} ${resolved ? 'is-done' : ''}`} role="alert">
      <div className={`ch-err__stamp ${long ? 'is-long' : ''} ${small ? 'is-small' : ''}`} aria-hidden="true">{long ? err.stamp.replace(/^(\S+ \S+) /, '$1\n') : err.stamp}</div>
      <div className="ch-err__t">
        <span className="ch-err__h">{err.title}</span>
        <span className="ch-err__b">{err.body}</span>
      </div>
      {!resolved && !readOnly && (
        <div className="ch-err__btns">
          {err.actions.map(a => (
            <button key={a.id} type="button" className={`ch-eb ${a.primary ? 'ch-grad' : 'ch-eb--gh'}`} onClick={() => onAction(a.id)}>{a.label}</button>
          ))}
        </div>
      )}
      <div className="ch-mono ch-err__d">DETAILS · {err.details}</div>
    </div>
  );
}
