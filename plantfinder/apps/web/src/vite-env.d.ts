/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** "static" = serverless GitHub Pages build that searches an encrypted snapshot in the browser. */
  readonly VITE_PF_MODE?: string;
  /** Optional Pl@ntNet key for photo identification in the static build (visible to site visitors). */
  readonly VITE_PLANTNET_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
