/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    "@remix-run/eslint-config",
    "@remix-run/eslint-config/node",
    "plugin:tailwindcss/recommended",
  ],
  settings: {
    tailwindcss: {
      callees: ["cn"],
    },
  },
};
