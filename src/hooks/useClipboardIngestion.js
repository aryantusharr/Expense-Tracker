import { useState, useEffect, useCallback } from 'react';
import { parseSMS } from '../utils/smsParser';
import { addPendingTransaction, getPendingCount, isDuplicate, initDB } from '../utils/indexedDB';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Custom React hook for silent automated clipboard ingestion on window focus.
 * Processes bank transaction SMS copies, stages them in IndexedDB, and issues alerts.
 */
export function useClipboardIngestion() {
  const [pendingCount, setPendingCount] = useState(0);
  const [ingestionError, setIngestionError] = useState(null);
  const [ingestionSuccess, setIngestionSuccess] = useState(null);

  const clearIngestionError = useCallback(() => {
    setIngestionError(null);
  }, []);

  const clearIngestionSuccess = useCallback(() => {
    setIngestionSuccess(null);
  }, []);

  const showError = useCallback((msg) => {
    setIngestionError(msg);
    setTimeout(() => setIngestionError(null), 4000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setIngestionSuccess(msg);
    setTimeout(() => setIngestionSuccess(null), 4000);
  }, []);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // Silently ignore count refresh errors
    }
  }, []);

  /**
   * Secondary duplicate check against Firestore expenses in the current room.
   * Returns true if a similar expense (same amount + date) already exists.
   * This is a soft warning, not a hard block.
   */
  const checkFirestoreDuplicate = useCallback(async (parsedResult) => {
    try {
      const roomCode = localStorage.getItem('splitease_room');
      if (!roomCode || !parsedResult.date || !parsedResult.amount) return false;

      const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
      const q = query(
        expensesRef,
        where('amount', '==', parseFloat(parsedResult.amount)),
        where('date', '==', parsedResult.date)
      );

      const snap = await Promise.race([
        getDocs(q),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);

      return !snap.empty;
    } catch {
      // On error or timeout, skip the check (non-blocking)
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Initialize the IndexedDB staging database on mount
    initDB()
      .then(() => {
        if (active) refreshCount();
      })
      .catch(() => {
        // Silently ignore IndexedDB init errors
      });

    const handleFocus = async () => {
      // Route gate: only run inside room routes
      const hideOn = ['/share', '/create', '/join', '/personal'];
      const pathname = window.location.pathname;
      if (hideOn.some(p => pathname.startsWith(p)) || pathname === '/') {
        return;
      }

      try {
        // Ensure clipboard API exists in the browser
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          return;
        }

        // Attempt to read text from clipboard
        const rawText = await navigator.clipboard.readText();
        if (!rawText || !rawText.trim()) {
          return;
        }

        // Layer 1: Session memory check
        const lastProcessed = sessionStorage.getItem('lastProcessedClipboard');
        if (lastProcessed === rawText) {
          return;
        }
        sessionStorage.setItem('lastProcessedClipboard', rawText);

        // Try parsing the text
        const result = parseSMS(rawText);

        if (result.error) {
          if (result.error === 'INCOME' && active) {
            showError(result.message);
          }
          // Silent ignore for UNRECOGNIZED texts
          return;
        }

        // If parsed transaction is valid, check if it's a potential duplicate in IndexedDB
        const duplicateExist = await isDuplicate(result);
        if (duplicateExist) {
          if (active) {
            showError('This transaction has already been captured.');
          }
          return;
        }

        // Secondary duplicate check against Firestore
        const firestoreDupe = await checkFirestoreDuplicate(result);

        // Save transaction to IndexedDB
        await addPendingTransaction(result);
        if (active) {
          if (firestoreDupe) {
            showError('⚠️ A similar expense already exists in your records.');
          } else {
            showSuccess(`₹${result.amount} captured`);
          }
        }

        // Attempt to clear the clipboard to prevent duplicate prompts on re-focus
        try {
          await navigator.clipboard.writeText('');
          try {
            const verifyText = await navigator.clipboard.readText();
            if (verifyText !== '') {
              sessionStorage.setItem('lastProcessedClipboard', rawText);
            }
          } catch {
            // Fail silently
          }
        } catch {
          // Some browsers block clipboard writes unless initiated by a direct user interaction
          sessionStorage.setItem('lastProcessedClipboard', rawText);
        }

        // Refresh count to update React subscribers
        if (active) {
          await refreshCount();
        }
      } catch (err) {
        // iOS clipboard permission denial: fail completely silently
        if (err?.name === 'NotAllowedError') {
          return; // Do not retry, no toast, no log
        }
        // All other clipboard errors: fail silently (no console output in production)
      }
    };

    const handleUpdate = () => {
      if (active) refreshCount();
    };

    // Attach listeners for window focus and custom DB updates
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pending-transactions-updated', handleUpdate);

    // Initial check on hook mounting
    handleFocus();

    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pending-transactions-updated', handleUpdate);
    };
  }, [refreshCount, showError, showSuccess, checkFirestoreDuplicate]);

  return {
    pendingCount,
    ingestionError,
    ingestionSuccess,
    clearIngestionError,
    clearIngestionSuccess
  };
}
