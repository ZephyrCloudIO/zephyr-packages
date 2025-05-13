export {};

declare global {
  interface Window {
    __ENV__?: {
      ZE_ENV_TITLE?: string;
      [key: string]: string | undefined;
    };
  }
}
