#!/usr/bin/env node

import fs from "fs/promises";
import { format } from "prettier";

const tsRegex = /\.ts(x)?$/;

const dotRegex = /\./g;

const dollarRegex = /\$/g;

const methodRegex = /^(post)|(get)|(delete)|(put)|(options)|(all)|(patch)/;

const isRouteFile = (f: string) => f.match(methodRegex);

const files = await fs
  .readdir("app/routes")
  .then((files) => files.filter(isRouteFile).sort());

const createDeclarations = async () => {
  const declarations = files
    .map((f) => {
      return `declare module "./${fileToModule(f)}" { 
        /** This is an ephemeral value and can only be used as a type */
        const PATTERN = "${fileToPath(f)}" 
      }`;
    })
    .join("");

  return declarations;
};

const createRouter = async () => {
  const vars: Record<string, string> = {};
  for (let i = 0; i < files.length; i++) {
    vars[files[i]] = `route_${i}`;
  }
  const imports =
    "import { Router, type RouteData } from '@mewhhaha/little-router';" +
    files.map((f) => `import ${vars[f]} from "./${fileToModule(f)}";`).join("");

  const routes = files
    .map((f) => {
      return `\t.${fileToMethod(f)}("${fileToPath(f)}", ${vars[f]}[1], ${
        vars[f]
      }[2])`;
    })
    .join("\n");

  const router =
    imports +
    `export const router = Router<RouteData["arguments"] extends unknown[] ? RouteData["arguments"] : []>()\n${routes};`;

  return router;
};

const fileToModule = (file: string) => file.replace(tsRegex, ".js");

const fileToMethod = (file: string) => file.match(methodRegex)?.[0] ?? "error";

const fileToPath = (file: string) =>
  file
    .replace(tsRegex, "")
    .replace(methodRegex, "")
    .replace(dotRegex, "/")
    .replace(dollarRegex, ":");

const [declarations, router] = await Promise.all([
  createDeclarations(),
  createRouter(),
]);

await fs.writeFile(
  "app/routes/_router.ts",
  await format(router + declarations, { parser: "typescript" })
);
