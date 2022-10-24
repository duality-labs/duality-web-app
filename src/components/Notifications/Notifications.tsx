import { ReactNode } from 'react';
import { useToaster } from 'react-hot-toast/headless';

import './Notifications.scss';

export default function Notifications() {
  const { toasts, handlers } = useToaster();
  const { startPause, endPause, calculateOffset, updateHeight } = handlers;

  return (
    <ul
      className="notifications"
      onMouseEnter={startPause}
      onMouseLeave={endPause}
    >
      {toasts.map((toast) => {
        const offset = calculateOffset(toast, {
          reverseOrder: false,
          gutter: 8,
        });

        const ref = (el: HTMLLIElement) => {
          if (el && typeof toast.height !== 'number') {
            const height = el.getBoundingClientRect().height;
            updateHeight(toast.id, height);
          }
        };

        return (
          <li
            key={toast.id}
            ref={ref}
            className="notification"
            style={{
              opacity: toast.visible ? 1 : 0,
              transform: `translateY(${offset}px)`,
            }}
            {...toast.ariaProps}
          >
            {toast.message as ReactNode}
          </li>
        );
      })}
    </ul>
  );
}
