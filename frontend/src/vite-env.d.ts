/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Stocker backend API (default: http://localhost:8000). */
  readonly VITE_API_BASE_URL?: string;
}
