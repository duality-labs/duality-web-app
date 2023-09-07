import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';

import { toast } from './Notifications';
import { DeliverTxResponse } from '@cosmjs/stargate';

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
  res: DeliverTxResponse,
  { id, title, description, descriptionLink }: ToastOptions = {}
) {
  const { code, transactionHash } = res;
  if (code === REQUEST_SUCCESS) {
    return toast.success(title || 'Transaction Successful!', {
      id,
      description: description || 'View more details',
      descriptionLink:
        descriptionLink ||
        `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
      icon: <FontAwesomeIcon icon={faCheckCircle} />,
      duration: 15e3,
      dismissable: true,
    });
  }
}

export function checkMsgRejectedToast(
  err: Error & { response?: DeliverTxResponse },
  { id, title, description, descriptionLink }: ToastOptions = {}
) {
  if (!err.response && err?.message.includes('rejected')) {
    return toast.error(title || 'Transaction Rejected', {
      id,
      description: description || 'You declined the transaction',
      descriptionLink,
      icon: <FontAwesomeIcon icon={faCircleXmark} />,
      duration: 5e3,
      dismissable: true,
    });
  }
}

export function checkMsgOutOfGasToast(
  err: Error & { response?: DeliverTxResponse },
  { id, title, description, descriptionLink }: ToastOptions = {}
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
        `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
      icon: <FontAwesomeIcon icon={faCircleXmark} />,
      duration: Infinity,
      dismissable: true,
    });
  }
}

export function checkMsgErrorToast(
  err: Error & { response?: DeliverTxResponse },
  { id, title, description, descriptionLink }: ToastOptions = {}
) {
  const { transactionHash } = err?.response || {};
  const transactionLink = `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`;
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

export async function handleStandardToastTransaction(
  callback: (id: string) => Promise<DeliverTxResponse>,
  {
    // create default ID if it does not exist yet
    id = `${Date.now()}.${Math.random}`,
    onLoadingMessage,
    onSuccessMessage,
    onErrorMessage,
    rethrowError = false,
  }: {
    id?: string;
    onLoadingMessage?: string;
    onSuccessMessage?:
      | string
      | ((res: DeliverTxResponse) => ToastOptions | undefined);
    onErrorMessage?:
      | string
      | ((res: DeliverTxResponse | undefined) => ToastOptions | undefined);
    rethrowError?: boolean;
  } = {}
): Promise<DeliverTxResponse | undefined> {
  // start toasts
  createLoadingToast({ id, description: onLoadingMessage });
  // start transaction and wiat for response
  return callback(id)
    .then(function (res): DeliverTxResponse {
      if (!res) {
        throw new Error('No response');
      }
      const { code } = res;
      const toastOptions: ToastOptions =
        typeof onSuccessMessage === 'string'
          ? { id, description: onSuccessMessage }
          : { id, ...onSuccessMessage?.(res) };
      // check and show a toast if successful
      if (!checkMsgSuccessToast(res, toastOptions)) {
        const error: Error & { response?: DeliverTxResponse } = new Error(
          `Tx error: ${code}`
        );
        error.response = res;
        throw error;
      }
      // listen for the transaction on the receiving chain
      return res;
    })
    .catch(function (err: Error & { response?: DeliverTxResponse }) {
      const toastOptions: ToastOptions =
        typeof onErrorMessage === 'string'
          ? { id, description: onErrorMessage }
          : { id, ...onErrorMessage?.(err.response) };
      // catch transaction errors
      // chain toast checks so only one toast may be shown
      checkMsgRejectedToast(err, toastOptions) ||
        checkMsgOutOfGasToast(err, toastOptions) ||
        checkMsgErrorToast(err, toastOptions);

      // only throw the error if it will be handled
      if (rethrowError) {
        throw err;
      }
      return undefined;
    });
}
