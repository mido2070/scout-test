/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    API_KEY?: string;
    GEMINI_API_KEY?: string;
  }
}

declare const process: {
  env: {
    API_KEY?: string;
    GEMINI_API_KEY?: string;
    [key: string]: string | undefined;
  };
};