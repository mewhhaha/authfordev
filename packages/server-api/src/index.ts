import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

let output = "";

let entryTypes: string[] = [];

function visitNode(node: ts.Node, checker: ts.TypeChecker, filename: string) {
  // Import Declarations
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const importPath = (node.moduleSpecifier as ts.StringLiteral)?.text;
    if (importPath) {
      const resolvedPath =
        path.resolve(path.dirname(filename), importPath) + ".ts";
      const sourceFile = ts.createSourceFile(
        resolvedPath,
        fs.readFileSync(resolvedPath, "utf-8"),
        ts.ScriptTarget.ESNext,
        true
      );

      if (filename === "src/index.ts") {
        entryTypes.push(importPath);
      }

      ts.forEachChild(sourceFile, (node) =>
        visitNode(node, checker, resolvedPath)
      );
    }
  }

  // Type Definitions: InterfaceDeclaration, TypeAliasDeclaration, etc.
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    const symbol = checker.getSymbolAtLocation(node.name);
    if (symbol) {
      const name = symbol.getName();
      if (entryTypes.includes(name)) {
        output += node.getFullText();
      }
    }
  }
}

// Entry Point
const entryFile = "app/routes/_router.ts";

// Create program and type checker
const program = ts.createProgram([entryFile], {
  target: ts.ScriptTarget.ESNext,
});
const checker = program.getTypeChecker();

// Start parsing from entry file
const sourceFile = program.getSourceFile(entryFile);
if (sourceFile) {
  ts.forEachChild(sourceFile, (node) => visitNode(node, checker, entryFile));
}

// Write to output bundle
fs.writeFileSync("dist/types.d.ts", output);

console.log("Declaration bundling and tree-shaking complete.");
