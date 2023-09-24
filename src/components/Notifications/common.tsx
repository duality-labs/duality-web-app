import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';

import { toast } from './Notifications';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { coerceError } from '../../lib/utils/error';
import { seconds } from '../../lib/utils/time';

const { REACT_APP__REST_API } = process.env;

// standard error codes can be found in https://github.com/cosmos/cosmos-sdk/blob/v0.45.4/types/errors/errors.go
// however custom modules may register additional error codes
const REQUEST_SUCCESS = 0;
const ERROR_OUT_OF_GAS = 11;

interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  descriptionLink?: string;
}

interface TransactionConfig {
  restEndpoint?: string;
}

type MinimalTxResponse = Pick<
  DeliverTxResponse,
  'code' | 'transactionHash' | 'gasUsed' | 'gasWanted'
> &
  Partial<Pick<DeliverTxResponse, 'rawLog'>>;

export function createLoadingToast({
  id,
  title,
  description,
  descriptionLink,
}: ToastOptions = {}) {
  return toast.loading(title || 'Transaction in Progress...', {
    id,
    description: description || 'Executing your trade',
    descriptionLink,
    duration: Infinity,
    dismissable: true,
  });
}

export function checkMsgSuccessToast(
  res: MinimalTxResponse,
  { id, title, description, descriptionLink }: ToastOptions = {},
  { restEndpoint = REACT_APP__REST_API }: TransactionConfig = {}
) {
  const { code, transactionHash } = res;
  if (code === REQUEST_SUCCESS) {
    return toast.success(title || 'Transaction Successful!', {
      id,
      description: description || 'View more details',
      descriptionLink:
        descriptionLink ||
        `${restEndpoint}/cosmos/tx/v1beta1/txs/${transactionHash}`,
      icon: <FontAwesomeIcon icon={faCheckCircle} />,
      duration: 15 * seconds,
      dismissable: true,
    });
  }
}

export function checkMsgRejectedToast(
  err: Error & { response?: MinimalTxResponse },
  { id, title, description, descriptionLink }: ToastOptions = {},
  { restEndpoint = REACT_APP__REST_API }: TransactionConfig = {}
) {
  if (!err.response && err?.message.includes('rejected')) {
    return toast.error(title || 'Transaction Rejected', {
      id,
      description: description || 'You declined the transaction',
      descriptionLink,
      icon: <FontAwesomeIcon icon={faCircleXmark} />,
      duration: 5 * seconds,
      dismissable: true,
    });
  }
}

export function checkMsgOutOfGasToast(
  err: Error & { response?: MinimalTxResponse },
  { id, title, description, descriptionLink }: ToastOptions = {},
  { restEndpoint = REACT_APP__REST_API }: TransactionConfig = {}
) {
  if (err?.response?.code === ERROR_OUT_OF_GAS) {
    const { gasUsed, gasWanted, transactionHash } = err?.response;

    return toast.error(title || 'Transaction Failed', {
      id,
      description:
        description ||
        `Out of gas (used: ${gasUsed?.toLocaleString(
          'en-US'
        )} wanted: ${gasWanted?.toLocaleString('en-US')})`,
      descriptionLink:
        descriptionLink ||
        `${restEndpoint}/cosmos/tx/v1beta1/txs/${transactionHash}`,
      icon: <FontAwesomeIcon icon={faCircleXmark} />,
      duration: Infinity,
      dismissable: true,
    });
  }
}

export function checkMsgErrorToast(
  err: Error & { response?: MinimalTxResponse },
  { id, title, description, descriptionLink }: ToastOptions = {},
  { restEndpoint = REACT_APP__REST_API }: TransactionConfig = {}
) {
  const { transactionHash } = err?.response || {};
  const transactionLink = `${restEndpoint}/cosmos/tx/v1beta1/txs/${transactionHash}`;
  // pass error to console for developers
  // eslint-disable-next-line no-console
  console.error(
    err,
    err?.response?.rawLog || '[no raw log]',
    `See transaction: ${transactionLink}`
  );
  return toast.error(title || 'Transaction Failed', {
    id,
    description: description || 'Something went wrong, please try again',
    descriptionLink: descriptionLink || transactionLink,
    icon: <FontAwesomeIcon icon={faCircleXmark} />,
    duration: Infinity,
    dismissable: true,
  });
}

export function createErrorToast(
  err: Error,
  { id, title, description, descriptionLink }: ToastOptions = {}
) {
  // skip if this error has already been used to show a transaction toast
  if (err instanceof TransactionToastError) {
    return;
  }
  // pass error to console for developers
  // eslint-disable-next-line no-console
  console.error(err);
  return toast.error(title || 'Error', {
    id,
    description: description || 'Unknown error',
    descriptionLink: descriptionLink,
    icon: <FontAwesomeIcon icon={faCircleXmark} />,
    duration: 7 * seconds,
    dismissable: true,
  });
}

export class TransactionToastError extends Error {}

export async function createTransactionToasts<T extends MinimalTxResponse>(
  callback: (id: string) => Promise<T>,
  {
    restEndpoint = REACT_APP__REST_API,
    // create default ID if it does not exist yet
    id = `${Date.now()}.${Math.random}`,
    onLoadingMessage,
    onSuccess,
    onSuccessMessage,
    onError,
    onErrorMessage,
    quiet = false,
  }: {
    restEndpoint?: string;
    id?: string;
    onLoadingMessage?: string;
    onSuccess?: (res: T) => ToastOptions | undefined | void;
    onSuccessMessage?: string;
    onError?: (error: Error, res?: T) => ToastOptions | undefined | void;
    onErrorMessage?: string;
    // optionally silence errors here
    quiet?: boolean;
  } = {}
): Promise<T | undefined> {
  const config: TransactionConfig = { restEndpoint };
  // start toasts
  createLoadingToast({ id, description: onLoadingMessage });
  // start transaction and wait for response
  // ensure entire callback can be caught with the catch handlers
  return Promise.resolve()
    .then(() => callback(id))
    .then(function (res): T {
      if (!res) {
        throw new Error('No response');
      }
      const { code } = res;
      const toastOptions: ToastOptions = {
        id,
        description: onSuccessMessage,
        // add optional toast props from optional hook
        ...onSuccess?.(res),
      };
      // check and show a toast if successful
      if (!checkMsgSuccessToast(res, toastOptions, config)) {
        const error: Error & { response?: T } = new Error(`Tx error: ${code}`);
        error.response = res;
        throw error;
      }
      // listen for the transaction on the receiving chain
      return res;
    })
    .catch(function (maybeError: unknown) {
      // ensure thrown types are errors
      const err: Error & { response?: T } = coerceError(maybeError);
      const toastOptions: ToastOptions = {
        id,
        description: onErrorMessage,
        // add optional toast props from optional hook
        ...onError?.(err, err.response),
      };
      // catch transaction errors
      // chain toast checks so only one toast may be shown
      checkMsgRejectedToast(err, toastOptions, config) ||
        checkMsgOutOfGasToast(err, toastOptions, config) ||
        checkMsgErrorToast(err, toastOptions, config);

      // only throw the error if it will be handled
      if (!quiet) {
        throw new TransactionToastError('Transaction Error', { cause: err });
      }
      // return undefined as a nicer type than void
      return undefined;
    });
}
