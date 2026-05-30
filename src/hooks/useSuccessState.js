import { useState } from 'react';

/**
 * Manages a success state that auto-dismisses after a delay.
 * @param {number} duration - milliseconds before auto-dismiss (default 2000)
 */
export function useSuccessState(duration = 2000) {
  const [showSuccess, setShowSuccess] = useState(false);

  const triggerSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), duration);
  };

  return { showSuccess, triggerSuccess };
}
