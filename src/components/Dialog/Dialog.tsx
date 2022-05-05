import React from 'react';
import { DialogContent, DialogOverlay } from '@reach/dialog';

import ScrollableArea from '../ScrollableArea';

import '@reach/dialog/styles.css';
import './Dialog.scss';

interface DialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  initialFocusRef?: React.RefObject<HTMLInputElement | HTMLButtonElement>;
  header?: React.ReactNode | React.ReactNode[];
  footer?: React.ReactNode | React.ReactNode[];
  className?: string;
  children?: React.ReactNode | React.ReactNode[];
}

export default function Dialog({
  isOpen,
  onDismiss,
  initialFocusRef,
  header,
  footer,
  className = '',
  children,
}: DialogProps) {
  return (
    <>
      {isOpen && (
        <DialogOverlay
          className={['dialog-scrollable', className].filter(Boolean).join(' ')}
          onDismiss={onDismiss}
          initialFocusRef={initialFocusRef}
        >
          <DialogContent className="dialog-content" aria-label="dialog content">
            <div className="dialog-header-row">
              <div className="dialog-header" role="heading" aria-level={1}>
                {header}
              </div>
              <button
                className="dialog-header-close-button"
                onClick={onDismiss}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="feather feather-x"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <ScrollableArea className="dialog-body">{children}</ScrollableArea>
            {footer && <div className="dialog-footer">{footer}</div>}
          </DialogContent>
        </DialogOverlay>
      )}
    </>
  );
}
