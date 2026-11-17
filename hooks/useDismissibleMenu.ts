'use client';
import { useEffect } from 'react';

export function useDismissibleMenu(open: boolean, onClose: () => void, selector: string) {
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    const close = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onClose();
        if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
      } else if (event.target instanceof Element && !event.target.closest(selector)) onClose();
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [open, onClose, selector]);
}
