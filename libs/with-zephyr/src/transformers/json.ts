import fs from 'fs';

/**
 * Add to Parcel reporters (JSON config)
 *
 * Parcel uses a JSON configuration file (.parcelrc) with a reporters array. This function
 * modifies the JSON directly without using AST transformations.
 *
 * Transforms: { "reporters": ["..."] } To: { "reporters": ["...",
 * "parcel-reporter-zephyr"] }
 */
export function addToParcelReporters(filePath: string, pluginName: string): void {
  const content = fs.readFileSync(filePath, 'utf8');
  const config = JSON.parse(content);

  if (!config.reporters) {
    config.reporters = [];
  }

  if (!config.reporters.includes(pluginName)) {
    config.reporters.push(pluginName);
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}
