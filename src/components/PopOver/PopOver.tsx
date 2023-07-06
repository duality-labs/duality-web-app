import { ReactElement, cloneElement, useState } from 'react';
import {
  offset,
  useClick,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react';

import './PopOver.scss';

export default function PopOver({
  children,
  floating,
}: {
  children: ReactElement;
  floating: ReactElement;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { context, refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'top',
    middleware: [offset({ mainAxis: 4 })],
  });
  const hover = useHover(context, { mouseOnly: true });
  const click = useClick(context, { ignoreMouse: true, toggle: true });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    click,
  ]);
  return (
    <>
      {cloneElement(children, {
        ref: refs.setReference,
        ...getReferenceProps(),
      })}
      {isOpen &&
        cloneElement(floating, {
          className: [
            'popover page-card py-2 px-3 mb-2',
            floating.props['className'],
          ]
            .filter(Boolean)
            .join(' '),
          ref: refs.setFloating,
          style: floatingStyles,
          ...getFloatingProps(),
        })}
    </>
  );
}
