/**
 * The AAI receipt buddy on the Dashboard pill (boards Bot-Home-Final, Bot-Pill-States).
 * Colours come from CSS vars so light mode gets the inverted buddy (black slip, pale eyes).
 */

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
