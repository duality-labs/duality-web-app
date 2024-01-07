import { ReactNode } from 'react';
import {
  toast as baseToast,
  ToastOptions as BaseToastOptions,
  useToaster,
  Renderable,
} from 'react-hot-toast/headless';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

import './Notifications.scss';

interface ToastOptions extends BaseToastOptions {
  message?: string;
  description?: ReactNode;
  descriptionLink?: string;
  icon?: Renderable;
  dismissable?: boolean;
}

function CustomToast({
  id,
  className,
  message,
  description,
  descriptionLink,
  icon,
  dismissable,
}: ToastOptions) {
  return (
    <div
      className={['col notification--inner p-4 pb-3 gap-2', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="row gap-md">
        {icon && <div className="col icon">{icon}</div>}
        {message && <div className="col message">{message}</div>}
        {dismissable && (
          <div className="col ml-auto">
            <button
              aria-label="Close"
              className="close-button"
              onClick={() => baseToast.dismiss(id)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}
      </div>
      {description && (
        <div className="row mb-2">
          {descriptionLink ? (
            <a
              className="description"
              href={descriptionLink}
              target="_blank"
              rel="noreferrer"
            >
              {description}
            </a>
          ) : (
            <div className="description">{description}</div>
          )}
        </div>
      )}
    </div>
  );
}

function createToast(message: string, opts: ToastOptions = {}) {
  return function ToastWithId({ id }: { id: string }) {
    return <CustomToast id={id} {...opts} message={message} />;
  };
}

export function toast(message: string, opts?: ToastOptions) {
  return baseToast(createToast(message, opts), opts);
}
toast.loading = (message: string, opts?: ToastOptions) =>
  baseToast.loading(createToast(message, opts), opts);
toast.success = (message: string, opts?: ToastOptions) =>
  baseToast.success(createToast(message, opts), opts);
toast.error = (message: string, opts?: ToastOptions) =>
  baseToast.error(createToast(message, opts), opts);
toast.custom = (message: string, opts?: ToastOptions) =>
  baseToast.custom(createToast(message, opts), opts);
toast.blank = (message: string, opts?: ToastOptions) =>
  baseToast(createToast(message, opts), opts);

export default function Notifications() {
  const { toasts, handlers } = useToaster({
    duration: 7000,
  });
  const { startPause, endPause, calculateOffset, updateHeight } = handlers;

  return (
    <ul
      className="notifications"
      onMouseEnter={startPause}
      onMouseLeave={endPause}
    >
      {toasts.map((toast) => {
        const offset = calculateOffset(toast, { gutter: 0 });

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
            {typeof toast.message === 'function'
              ? toast.message?.(toast)
              : toast.message}
          </li>
        );
      })}
    </ul>
  );
}
