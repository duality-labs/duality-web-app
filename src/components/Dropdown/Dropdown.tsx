import React, { cloneElement, useCallback, useState, useEffect } from 'react';
import { offset, useFloating, autoUpdate } from '@floating-ui/react';

interface IDropdownProps {
  renderOverlay: ({ close }: { close: () => void }) => React.ReactNode;
  closeIfClickedOutside?: boolean;
  children: React.ReactElement;
}

export default function Dropdown({
  renderOverlay,
  children,
  closeIfClickedOutside = true,
}: IDropdownProps) {
  const { x, y, strategy, update, refs } = useFloating<HTMLButtonElement>({
    placement: 'bottom',
    middleware: [offset(4)],
  });
  const [visible, setVisbile] = useState(false);
  const open = useCallback(() => setVisbile(true), [setVisbile]);
  const close = useCallback(() => setVisbile(false), [setVisbile]);

  // update position when screen size changes
  useEffect(() => {
    if (!visible || !refs.reference.current || !refs.floating.current) {
      return;
    }

    // Only call this when the floating element is rendered
    return autoUpdate(refs.reference.current, refs.floating.current, update);
  }, [visible, refs.reference, refs.floating, update]);

  if (Array.isArray(children)) {
    throw new Error('Dropdown must have only one child component');
  }

  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (
        event.target &&
        refs.floating.current &&
        !refs.floating.current.contains(event.target as Node)
      ) {
        close();
      }
    }
    // Bind the event listener to document
    const addHandler = closeIfClickedOutside && visible;
    if (addHandler) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keyup', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      // Unbind the event listener on clean up
      if (addHandler) {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keyup', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      }
    };
  }, [closeIfClickedOutside, refs.floating, visible, close]);

  // pass reference and action to child
  // add dropdown content
  return (
    <>
      {cloneElement(children, {
        ref: refs.setReference,
        onClick: open,
        onFocus: update,
      })}
      <div
        ref={refs.setFloating}
        style={{
          position: strategy,
          top: y ?? '',
          // render overlay offscren if not visible (render is required to compute height and width)
          left: visible ? x ?? '' : -9999,
        }}
      >
        {renderOverlay({ close })}
        <button onClick={close}>×</button>
      </div>
    </>
  );
}
