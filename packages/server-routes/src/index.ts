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

const createDeclarations = () => {
  const pattern = `
    declare global {
      interface ServiceWorkerGlobalScope {
        PATTERN: string;
      }
    }

    self.PATTERN = "";
  `;

  const declarations = files
    .map((f) => {
      return `declare module "./${fileToModule(f)}" { 
        /** This is an ephemeral value and can only be used as a type */
        const PATTERN = "${fileToPath(f)}" 
      }`;
    })
    .join("");

  return pattern + declarations;
};

const createRouter = async () => {
  const vars: Record<string, string> = {};
  for (let i = 0; i < files.length; i++) {
    vars[files[i]] = `route${i}`;
  }

  const declarations = createDeclarations();

  const imports =
    "import { Router, type RouteData } from '@mewhhaha/little-router';";
  const asyncImports =
    "const d = <T>(r: { default: T }) => r.default;" +
    files
      .map((f) => `const ${vars[f]} = import("./${fileToModule(f)}").then(d);`)
      .join("");

  const routes = files
    .map((f) => {
      return `\t.${fileToMethod(f)}("${fileToPath(f)}", (await ${
        vars[f]
      })[1], (await ${vars[f]})[2])`;
    })
    .join("\n");

  const type = `
    const routes = router.infer;
    export type Routes = typeof routes;
  `;

  const router =
    imports +
    declarations +
    asyncImports +
    `export const router = Router<RouteData["arguments"] extends unknown[] ? RouteData["arguments"] : []>()${routes};` +
    type;

  await fs.writeFile(
    "app/routes/_router.ts",
    await format(router, { parser: "typescript" })
  );
};

const fileToModule = (file: string) => file.replace(tsRegex, ".js");

const fileToMethod = (file: string) => file.match(methodRegex)?.[0] ?? "error";

const fileToPath = (file: string) =>
  file
    .replace(tsRegex, "")
    .replace(methodRegex, "")
    .replace(dotRegex, "/")
    .replace(dollarRegex, ":");

await createRouter();
