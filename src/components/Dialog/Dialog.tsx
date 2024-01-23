import React, { useCallback } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

import ScrollableArea from '../ScrollableArea';

import './Dialog.scss';

interface DialogProps {
  isOpen: boolean;
  setIsOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  initialFocusRef?: React.RefObject<HTMLInputElement | HTMLButtonElement>;
  header?: React.ReactNode | React.ReactNode[];
  footer?: React.ReactNode | React.ReactNode[];
  className?: string;
  children?: React.ReactNode | React.ReactNode[];
}

export default function Dialog({
  isOpen,
  setIsOpen,
  initialFocusRef,
  header,
  footer,
  className = '',
  children,
}: DialogProps) {
  //
  const onOpenAutoFocus = useCallback(
    (e: Event) => {
      // if ref given to focus on, focus on that ref
      if (initialFocusRef?.current) {
        e.preventDefault();
        initialFocusRef.current.focus();
      }
    },
    [initialFocusRef]
  );
  return (
    <RadixDialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={['dialog-overlay', className].filter(Boolean).join(' ')}
        >
          {/* <div className="dialog-background absolute filled"></div> */}
        </RadixDialog.Overlay>
        <RadixDialog.Content
          className={['dialog-content', className].filter(Boolean).join(' ')}
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <div className="dialog-header-row">
            <div className="dialog-header" role="heading" aria-level={1}>
              {header}
            </div>
            <RadixDialog.Close className="dialog-header-close-button">
              <FontAwesomeIcon icon={faXmark}></FontAwesomeIcon>
            </RadixDialog.Close>
          </div>
          <ScrollableArea className="dialog-body">{children}</ScrollableArea>
          {footer && <div className="dialog-footer">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
