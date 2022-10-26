import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircleNotch,
  faGasPump,
  faXmark,
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
  return toast.loading(title || 'Loading', {
    id,
    description: description || 'Executing your trade',
    descriptionLink,
    icon: <FontAwesomeIcon icon={faCircleNotch} spin />,
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
    return toast.success(title || 'Transaction Successful', {
      id,
      description: description || 'View more details',
      descriptionLink:
        descriptionLink ||
        `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
      icon: <FontAwesomeIcon icon={faCheckCircle} color="#5bc7b7" />,
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
      icon: <FontAwesomeIcon icon={faXmark} color="red" />,
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
        `Out of gas (used: ${gasUsed.toLocaleString(
          'en-US'
        )} wanted: ${gasWanted.toLocaleString('en-US')})`,
      descriptionLink:
        descriptionLink ||
        `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
      icon: <FontAwesomeIcon icon={faGasPump} color="var(--error)" />,
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
  return toast.error(title || 'Transaction Failed', {
    id,
    description: description || 'Something went wrong, please try again',
    descriptionLink:
      descriptionLink ||
      `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
    icon: '🤔',
    duration: Infinity,
    dismissable: true,
  });
}
