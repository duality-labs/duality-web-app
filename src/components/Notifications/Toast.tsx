import { ReactNode } from 'react';
import {
  toast as baseToast,
  ToastOptions as BaseToastOptions,
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

export default function Toast({
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
