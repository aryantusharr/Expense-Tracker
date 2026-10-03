/**
 * The AAI receipt buddy (boards Bot-Home-Final, Bot-Pill-States, Bot-Sheet-Final).
 * Colours come from CSS vars so light mode gets the inverted buddy (black slip, pale eyes).
 */

/** Big buddy for the sheet: rises out of the printer slot once, then bobs + blinks. */
export function BigBuddy() {
  return (
    <div className="aai-bb" aria-hidden="true">
      <span className="aai-bb__win">
        <span className="aai-bb__rise">
          <span className="aai-bb__body">
            <span className="aai-bb__eyes"><span className="aai-bb__eye"><i /></span><span className="aai-bb__eye"><i /></span></span>
            <span className="aai-bb__blush"><i /><i /></span>
            <svg className="aai-bb__mouth" width="20.16" height="10.08" viewBox="0 0 20 10"><path d="M3 2q7 8 14 0" fill="none" strokeWidth="2.4" strokeLinecap="round" /></svg>
            <span className="aai-bb__hat" />
          </span>
        </span>
      </span>
      <span className="aai-bb__slot" />
    </div>
  );
}

/**
 * The 50×14 slot pill with the tiny buddy. state: idle · waiting · reading · error.
 * paused stops the loop (sheet open / app in the background).
 */
export function PillBuddy({ state = 'idle', paused = false }) {
  return (
    <span className={`aai-pb aai-pb--${state} ${paused ? 'is-paused' : ''}`} aria-hidden="true">
      <span className="aai-pb__win"><span className="aai-pb__slip"><i /><i /></span></span>
      <span className="aai-pb__slot" />
      {state === 'waiting' && <span className="aai-pb__dot" />}
    </span>
  );
}
