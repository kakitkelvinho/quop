import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent tooling, not site code.
    ".claude/**",
    ".github/skills/**",
  ]),
  {
    // Reports components the React Compiler would skip. The compiler is not
    // enabled here, so hand-written useMemo is what memoizes, and it stays.
    rules: { "react-hooks/preserve-manual-memoization": "off" },
  },
]);

export default eslintConfig;
