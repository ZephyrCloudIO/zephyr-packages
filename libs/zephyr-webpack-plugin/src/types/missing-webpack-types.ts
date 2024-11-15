import { Configuration, container } from 'webpack';

type AllowedWebpackProperties =
  // from which folder webpack is running
  | 'context'
  // getting access to MF configuration
  | 'plugins';
export type WebpackConfiguration = Pick<Configuration, AllowedWebpackProperties>;

// Get the type of the constructor arguments of ModuleFederationPlugin
type ModuleFederationPluginConstructorParams = ConstructorParameters<
  typeof container.ModuleFederationPlugin
>;

// Since it's an array of parameters, we extract the first one
type ModuleFederationPluginOptionsType = ModuleFederationPluginConstructorParams[0];

export type ModuleFederationPlugin = container.ModuleFederationPlugin & {
  _options: ModuleFederationPluginOptionsType;
};
