import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/uploads/**", "e2e/**", "packages/db/migrations/**", "**/next-env.d.ts", "*.js", "public/**", "archive/**", "apps/storefront/**"] },
  ...tseslint.configs.recommended,
  { files: ["**/*.tsx"], plugins: { "react-hooks": reactHooks }, rules: { ...reactHooks.configs.recommended.rules, "react-hooks/set-state-in-effect": "off" /* shortcut: plain fetch-in-effect until a data-fetching lib (TanStack Query, planned for the storefront) is adopted */ } },
  { rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] } },
);
