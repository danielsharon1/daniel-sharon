/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** "static" = serverless GitHub Pages build that searches an encrypted snapshot in the browser. */
  readonly VITE_PF_MODE?: string;
  /** Optional Pl@ntNet key for photo identification in the static build (visible to site visitors). */
  readonly VITE_PLANTNET_KEY?: string;
  /** "1" for a frozen preview build (banner says the data is not refreshed). */
  readonly VITE_PF_PREVIEW?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
