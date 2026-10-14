/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANILIST_CLIENT_ID?: string;
  readonly VITE_ANILIST_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
