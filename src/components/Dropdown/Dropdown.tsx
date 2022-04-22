import React, { cloneElement, useCallback, useState } from 'react';
import { useFloating } from '@floating-ui/react-dom';

export default function Dropdown({
  overlay,
  children,
}: {
  overlay: React.ReactNode;
  children: React.ReactElement;
}) {
  const { x, y, reference, floating, strategy } =
    useFloating<HTMLButtonElement>({
      placement: 'bottom',
    });
  const [visible, setVisbile] = useState(false);
  const open = useCallback(() => setVisbile(true), [setVisbile]);
  const close = useCallback(() => setVisbile(false), [setVisbile]);

  if (Array.isArray(children)) {
    throw new Error('Dropdown must have only one child component');
  }

  // pass reference and action to child
  // add dropdown content
  return (
    <>
      {cloneElement(children, { ref: reference, onClick: open })}
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
        {overlay}
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
