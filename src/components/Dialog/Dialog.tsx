import React from 'react';
import { DialogContent, DialogOverlay } from '@reach/dialog';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

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
                <FontAwesomeIcon icon={faXmark}></FontAwesomeIcon>
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
