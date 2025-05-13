// import walk from 'acorn-walk';
// import type { Node } from 'acorn';
// import type { ProgramNode } from 'rollup';
// import { ze_log } from 'zephyr-agent';

// export interface VitePreloadImport {
//   remoteId: string;
//   importPath: string;
//   originalNode: Node;
//   location: {
//     start: { line: number; column: number };
//     end: { line: number; column: number };
//   };
// }

// /**
//  * We are doing AST again because the moduleParsed event would include the original code
//  * Extracts remote module imports from __vitePreload calls in the AST Specifically targets
//  * patterns like: lazy(() => __vitePreload(() => import("vite-remote/Button"),
//  * **VITE_IS_MODERN**?**VITE_PRELOAD**:void 0))
//  */
// export function extractVitePreloadImports(
//   ast: ProgramNode,
//   _code: string
// ): VitePreloadImport[] {
//   const imports: VitePreloadImport[] = [];

//   let arrayNode: Node | undefined;
//   // Walk the AST to find __vitePreload calls
//   walk.full(ast, (node: any) => {
//     // Look for CallExpression nodes that might be __vitePreload calls
//     if (
//       node.type === 'CallExpression' &&
//       node.callee?.type === 'Identifier' &&
//       node.callee.name === '__vitePreload' &&
//       node.arguments.length >= 1
//     ) {
//       const firstArg = node.arguments[0];

//       ze_log('vite.extractVitePreloadImports.node: ', node);

//       // Look for arrow functions in the first argument
//       if (
//         firstArg.type === 'ArrowFunctionExpression' &&
//         firstArg.body.type === 'CallExpression' &&
//         firstArg.body.callee?.type === 'Identifier' &&
//         firstArg.body.callee.name === 'import' &&
//         firstArg.body.arguments.length === 1
//       ) {
//         const importArg = firstArg.body.arguments[0];

//         // Extract the import path from string literals
//         if (importArg.type === 'Literal' && typeof importArg.value === 'string') {
//           const importPath = importArg.value;

//           // Parse the import path to get the remote ID (before the first slash)
//           const slashIndex = importPath.indexOf('/');
//           if (slashIndex > 0) {
//             const remoteId = importPath.substring(0, slashIndex);
//             const modulePath = importPath.substring(slashIndex + 1);

//             imports.push({
//               remoteId,
//               importPath: modulePath,
//               originalNode: node,
//               location: node.loc,
//             });

//             ze_log('Found vite preload import', {
//               remoteId,
//               importPath,
//               location: node.loc,
//             });
//           }
//         }
//       }
//     }

//     // Also check for lazy imports wrapped in React.lazy or just lazy
//     if (
//       node.type === 'CallExpression' &&
//       ((node.callee?.type === 'Identifier' && node.callee.name === 'lazy') ||
//         (node.callee?.type === 'MemberExpression' &&
//           node.callee.property?.type === 'Identifier' &&
//           node.callee.property.name === 'lazy')) &&
//       node.arguments.length === 1 &&
//       node.arguments[0].type === 'ArrowFunctionExpression'
//     ) {
//       // This is a lazy() call with an arrow function, check if it contains __vitePreload
//       const arrowBody = node.arguments[0].body;

//       if (
//         arrowBody.type === 'CallExpression' &&
//         arrowBody.callee?.type === 'Identifier' &&
//         arrowBody.callee.name === '__vitePreload' &&
//         arrowBody.arguments.length >= 1
//       ) {
//         // Handle nested __vitePreload call
//         const nestedArrow = arrowBody.arguments[0];

//         if (
//           nestedArrow.type === 'ArrowFunctionExpression' &&
//           nestedArrow.body.type === 'CallExpression' &&
//           nestedArrow.body.callee?.type === 'Identifier' &&
//           nestedArrow.body.callee.name === 'import' &&
//           nestedArrow.body.arguments.length === 1
//         ) {
//           const importArg = nestedArrow.body.arguments[0];

//           if (importArg.type === 'Literal' && typeof importArg.value === 'string') {
//             const importPath = importArg.value;

//             // Parse the import path
//             const slashIndex = importPath.indexOf('/');
//             if (slashIndex > 0) {
//               const remoteId = importPath.substring(0, slashIndex);
//               const modulePath = importPath.substring(slashIndex + 1);

//               imports.push({
//                 remoteId,
//                 importPath: modulePath,
//                 originalNode: node,
//                 location: node.loc,
//               });

//               ze_log('Found lazy import with vite preload', {
//                 remoteId,
//                 importPath,
//                 location: node.loc,
//               });
//             }
//           }
//         }
//       }
//     }
//   });

//   return imports;
// }
