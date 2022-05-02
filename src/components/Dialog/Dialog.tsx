import React from 'react';
import { DialogContent, DialogOverlay } from '@reach/dialog';

import '@reach/dialog/styles.css';
import './Dialog.scss';

interface DialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  initialFocusRef?: React.RefObject<HTMLInputElement | HTMLButtonElement>;
  className?: string;
  children?: React.ReactNode;
}

export default function Dialog({
  isOpen,
  onDismiss,
  initialFocusRef,
  className = '',
  children,
}: DialogProps) {
  return (
    <>
      {isOpen && (
        <DialogOverlay
          className={className}
          onDismiss={onDismiss}
          initialFocusRef={initialFocusRef}
        >
          <DialogContent className="dialog-content" aria-label="dialog content">
            {children}
          </DialogContent>
        </DialogOverlay>
      )}
    </>
  );
}
