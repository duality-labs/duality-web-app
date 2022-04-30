import React from 'react';
import { DialogContent, DialogOverlay } from '@reach/dialog';

import '@reach/dialog/styles.css';

interface DialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  initialFocusRef?: React.RefObject<HTMLInputElement | HTMLButtonElement>;
  children?: React.ReactNode;
}

export default function Dialog({
  isOpen,
  onDismiss,
  initialFocusRef,
  children,
}: DialogProps) {
  return (
    <>
      {isOpen && (
        <DialogOverlay onDismiss={onDismiss} initialFocusRef={initialFocusRef}>
          <DialogContent aria-label="dialog content">{children}</DialogContent>
        </DialogOverlay>
      )}
    </>
  );
}
