const config = {
  "*.{ts,tsx,mts,cts,mjs}": [
    "oxlint --type-aware --fix --deny-warnings --no-error-on-unmatched-pattern",
    "oxfmt --no-error-on-unmatched-pattern",
  ],
  "*.astro": [
    "eslint --fix --max-warnings=0 --no-warn-ignored --cache --cache-strategy content",
    "oxfmt --no-error-on-unmatched-pattern",
  ],
  "*.{js,jsx,json,jsonc,json5,md,mdx,css,scss,yml,yaml}": ["oxfmt --no-error-on-unmatched-pattern"],
};

export default config;
