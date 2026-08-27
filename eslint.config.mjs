import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next, but matched at any depth. Anchored
    // at the root they miss a build cache that lands in a subdirectory, and
    // linting one buries the real findings under three thousand from Next's own
    // compiled output.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
    // Not ours to lint: the Python virtualenv for the transcription scripts
    // ships vendored JavaScript, and the local ingestion artifacts are data.
    ".venv-asr/**",
    "data/**",
  ]),
]);

export default eslintConfig;
