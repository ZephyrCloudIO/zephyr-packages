const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const withModuleFederation = require('@nx/react/module-federation');
const { withZephyr } = require('@ze/ze-webpack-plugin');

const mfConfig = {
  name: 'team-red',
  exposes: {
    './TeamRedLayout': './src/app/team-red-layout',
  },
  remotes: ['team-green', 'team-blue'],
};

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig),
  withZephyr(),
  (config) => {
    return dynmo(config);
    // return config;
  }
);

function dynmo(config) {
  const app = {
    org: 'valorkin',
    project: 'zephyr-mono',
  };
  const mfPlugin = config.plugins.find(
    (plugin) => plugin.constructor.name === 'ModuleFederationPlugin'
  );
  // const zePlugin = config.plugins.find(
  //   (plugin) => plugin.constructor.name === 'ZeWebpackPlugin'
  // );

  const fnReplace = replacer.toString();
  const strStart = new RegExp(/^function[\W\S]+return new Promise/);
  const strNewStart = `promise new Promise`;
  const strEnd = new RegExp(/;[^)}]+}$/);

  const promiseNewPromise = fnReplace
    .replace(strStart, strNewStart)
    .replace(strEnd, '');

  Object.keys(mfPlugin._options.remotes).forEach((key) => {
    const defaultUrl = mfPlugin._options.remotes[key];
    mfPlugin._options.remotes[key] = promiseNewPromise
      .replace('__REMOTE_KEY__', key)
      .replace('_DEFAULT_URL_', defaultUrl)
      .replace(
        '_EDGE_URL_',
        `__protocol__//${app.org}-${app.project}-${key}.__domain_and_port__/remoteEntry.js`
      )
      // .replace('_REMOTE_APP_', key)
      .replace('_DEFAULT_EDGE_DOMAIN_', 'cf.valorkin.dev');
  });
  return config;
}

function replacer() {
  return new Promise((resolve, reject) => {
    const remoteKey = '__REMOTE_KEY__';
    const defaultUrl = '_DEFAULT_URL_';
    let edgeUrl = '_EDGE_URL_';
    const getEdgeLink = () => {
      if (window.location.hostname === 'localhost') {
        return {
          protocol: 'https:',
          domain: '_DEFAULT_EDGE_DOMAIN_',
        };
      }

      let domain = getEdgeHost(window.location.hostname);
      const protocol = window.location.protocol;
      const port = window.location.port;
      if (port) {
        domain += `:${port}`;
      }

      return {
        protocol,
        domain,
      };
    };

    const { protocol, domain } = getEdgeLink();

    edgeUrl = edgeUrl
      .replace('__protocol__', protocol)
      .replace('__domain_and_port__', domain);

    const sessionEdgeURL = window.sessionStorage.getItem(remoteKey);

    if (sessionEdgeURL) {
      edgeUrl = sessionEdgeURL;
    }

    Promise.race([
      // todo: do 250ms timeout
      fetch(defaultUrl, { method: 'HEAD' })
        .then(() => defaultUrl)
        .catch(() => false),
      fetch(edgeUrl, { method: 'HEAD' })
        .then(() => edgeUrl)
        .catch(() => false),
    ])
      .then((remoteUrl) => {
        const module = import(remoteUrl);
        module
          .then((mod) => {
            resolve(mod);
          })
          .catch((err) => {
            reject(err);
          });
      })
      .catch((err) => {
        console.log(`who cares in POC`, err);
      });

    function getEdgeHost(hostname) {
      const regex = /^(.+?)\.(edge\.local|(cf|aws)\.valorkin\.dev)/;
      const match = hostname.match(regex);
      return match[2];
    }
  });
}
