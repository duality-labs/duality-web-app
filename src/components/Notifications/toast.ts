import { ReactNode, createElement } from 'react';
import {
  toast as baseToast,
  ToastOptions as BaseToastOptions,
  Renderable,
} from 'react-hot-toast/headless';
import Toast from './Toast.tsx';

import './Notifications.scss';

interface ToastOptions extends BaseToastOptions {
  message?: string;
  description?: ReactNode;
  descriptionLink?: string;
  icon?: Renderable;
  dismissable?: boolean;
}

function createToast(message: string, opts: ToastOptions = {}) {
  return function ToastWithId({ id }: { id: string }) {
    return createElement(Toast, { id, ...opts, message });
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
