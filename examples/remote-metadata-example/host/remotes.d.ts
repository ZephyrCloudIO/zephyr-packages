/**
 * Type declarations for remote components
 * 
 * This file provides type definitions for the federated remote components,
 * ensuring proper type checking and autocompletion when used in the host application.
 */

// Remote A Component (SSR)
declare module 'remoteA/Component' {
  import { FC } from 'react';

  const Component: FC;
  export default Component;
}

// Remote B Button (CSR)
declare module 'remoteB/Button' {
  import { FC } from 'react';

  interface ButtonProps {
    text?: string;
    onClick?: () => void;
  }

  const Button: FC<ButtonProps>;
  export default Button;
}

// Remote C Card
declare module 'remoteC/Card' {
  import { FC, ReactNode } from 'react';

  interface CardProps {
    title?: string;
    children?: ReactNode;
  }

  const Card: FC<CardProps>;
  export default Card;
}