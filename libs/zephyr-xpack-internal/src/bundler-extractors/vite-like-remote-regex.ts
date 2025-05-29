// Different regex patterns to match various loadRemote call formats

export const viteLikeRemoteRegex = [
  // Basic pattern: loadRemote("remote/component")
  /loadRemote\(["']([^/]+)\/([^'"]+)["']\)/g,

  // Destructured pattern: { loadRemote: c } = a, then c("remote/component")
  /(?:\{[ \t]*loadRemote:[ \t]*([a-zA-Z0-9_$]+)[ \t]*\}|\bloadRemote[ \t]*:[ \t]*([a-zA-Z0-9_$]+)\b).*?([a-zA-Z0-9_$]+)[ \t]*\(["']([^/]+)\/([^'"]+)["']\)/g,

  // Promise chain pattern: n.then(e => c("remote/component"))
  /\.then\([ \t]*(?:[a-zA-Z0-9_$]+)[ \t]*=>[ \t]*(?:[a-zA-Z0-9_$]+)\(["']([^/]+)\/([^'"]+)["']\)\)/g,
];
