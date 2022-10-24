import { ReactNode } from 'react';
import {
  toast as baseToast,
  ToastOptions as BaseToastOptions,
  useToaster,
  Renderable,
} from 'react-hot-toast/headless';

import './Notifications.scss';

interface ToastOptions extends BaseToastOptions {
  message?: string;
  description?: string;
  icon?: Renderable;
  close?: React.MouseEventHandler<HTMLButtonElement>;
}

function CustomToast({
  message,
  description,
  icon,
  close,
  className,
}: ToastOptions) {
  return (
    <div
      className={['notification--inner', className].filter(Boolean).join(' ')}
    >
      {icon && <div className="icon">{icon}</div>}
      <div className="content">
        {message && <div className="message">{message}</div>}
        {description && <div className="description">{description}</div>}
      </div>
      {close && <button className="close-button" onClick={close} />}
    </div>
  );
}

export function toast(message: string, opts?: ToastOptions) {
  return baseToast(<CustomToast {...opts} message={message} />, opts);
}

toast.loading = (message: string, opts?: ToastOptions) =>
  baseToast.loading(<CustomToast {...opts} message={message} />, opts);
toast.success = (message: string, opts?: ToastOptions) =>
  baseToast.success(<CustomToast {...opts} message={message} />, opts);
toast.error = (message: string, opts?: ToastOptions) =>
  baseToast.error(<CustomToast {...opts} message={message} />, opts);
toast.custom = (message: string, opts?: ToastOptions) =>
  baseToast.custom(<CustomToast {...opts} message={message} />, opts);
toast.blank = (message: string, opts?: ToastOptions) =>
  baseToast(<CustomToast {...opts} message={message} />, opts);

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
            className={['notification', `notification--${toast.type}`].join(
              ' '
            )}
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
