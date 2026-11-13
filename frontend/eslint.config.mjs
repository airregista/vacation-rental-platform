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
  ]),
  // AGENTS.md UI conventions: colors come from globals.css tokens — no raw
  // hex/rgb/hsl literals in TS/TSX. Documented exceptions: the layout.tsx
  // metadata themeColor (exempted below); the two brand SVGs (app/icon.svg,
  // app/opengraph-image.svg) are not linted.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(/]",
          message:
            "Colors must use design tokens from globals.css (see AGENTS.md). Literal colors are allowed only in app/icon.svg, app/opengraph-image.svg, and layout.tsx themeColor.",
        },
      ],
    },
  },
  {
    // Documented exception: themeColor metadata values, not CSS.
    files: ["src/app/layout.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Documented exception: vendored verbatim from @shadcn/react@0.3.1 (MIT;
    // see src/components/ui/message-scroller/LICENSE.md). The react-hooks/refs
    // errors flag upstream's deliberate patterns (useLatest, lazy store init);
    // runtime behavior matches the previously installed npm package. Do not
    // "fix" these — edits would break diff parity with upstream.
    files: ["src/components/ui/message-scroller/**"],
    rules: { "react-hooks/refs": "off" },
  },
]);

export default eslintConfig;
