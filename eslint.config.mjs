import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "public/**",
    ],
  },
];

export default config;
