import React, { cloneElement, useCallback, useState, useEffect } from 'react';
import { offset, useFloating, autoUpdate } from '@floating-ui/react-dom';

export default function Dropdown({
  renderOverlay,
  children,
  closeIfClickedOutside = true,
}: {
  renderOverlay: ({ close }: { close: () => void }) => React.ReactNode;
  children: React.ReactElement;
  closeIfClickedOutside?: boolean;
}) {
  const { x, y, reference, floating, strategy, update, refs } =
    useFloating<HTMLButtonElement>({
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
        ref: reference,
        onClick: open,
        onFocus: update,
      })}
      <div
        ref={floating}
        className="dropdown w-60 max-w-full border border-slate-200 rounded-xl"
        style={{
          position: strategy,
          top: y ?? '',
          // render overlay offscren if not visible (render is required to compute height and width)
          left: visible ? x ?? '' : -9999,
        }}
      >
        {renderOverlay({ close })}
        <button
          className="absolute top-0 right-0 py-2 px-3 rounded-xl"
          onClick={close}
        >
          ×
        </button>
      </div>
    </>
  );
}
