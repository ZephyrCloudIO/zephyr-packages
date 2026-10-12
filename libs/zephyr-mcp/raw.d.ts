// Types for `import text from './file.txt?raw'` in tool files.
// Add `"types": ["zephyr-mcp/raw"]` to your tsconfig.
declare module '*?raw' {
  const content: string;
  export default content;
}
