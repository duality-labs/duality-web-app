import React from 'react';
import { CloseButton, Flex } from '@chakra-ui/react';

import './Toast.scss';

type ToastId = string | number;

const Toast: React.FC<{
  id: ToastId;
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  close?: (id: ToastId) => void;
}> = ({ id, icon, title, description, close }) => {
  return (
    <Flex alignItems="center" gap="1ch" id={`${id}`}>
      {icon && <div className="icon">{icon}</div>}
      <div className="content">
        {title && <div className="title">{title}</div>}
        {description && <div className="description">{description}</div>}
      </div>
      {close && (
        <CloseButton
          className="close-button"
          size="sm"
          onClick={() => close(id)}
        />
      )}
    </Flex>
  );
};

export default Toast;
