// Merges into Vite's ImportMetaEnv (tsconfig types: vite/client), so the build id read is typed.
interface ImportMetaEnv {
  /** Commit the client was built from (client/vite.config.ts); undefined under Vitest. */
  readonly VITE_BUILD_ID?: string;
}
