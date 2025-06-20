(() => {
  // webpackBootstrap
  'use strict';
  var __webpack_modules__ = {
    1835: function (__unused_webpack_module, exports) {
      var __webpack_unused_export__;
      /**
       * Hoists a name from a module or promised module.
       *
       * @param module The module to hoist the name from
       * @param name The name to hoist
       * @returns The value on the module (or promised module)
       */
      __webpack_unused_export__ = {
        value: true,
      };
      Object.defineProperty(exports, 'hoist', {
        enumerable: true,
        get: function () {
          return hoist;
        },
      });
      function hoist(module, name) {
        // If the name is available in the module, return it.
        if (name in module) {
          return module[name];
        }
        // If a property called `then` exists, assume it's a promise and
        // return a promise that resolves to the name.
        if ('then' in module && typeof module.then === 'function') {
          return module.then((mod) => hoist(mod, name));
        }
        // If we're trying to hoise the default export, and the module is a function,
        // return the module itself.
        if (typeof module === 'function' && name === 'default') {
          return module;
        }
        // Otherwise, return undefined.
        return undefined;
      }

      //# sourceMappingURL=helpers.js.map
    },
    6428: function (__unused_webpack_module, __webpack_exports__, __webpack_require__) {
      __webpack_require__.r(__webpack_exports__);
      __webpack_require__.d(__webpack_exports__, {
        config: () => config,
        default: () => __WEBPACK_DEFAULT_EXPORT__,
        getServerSideProps: () => getServerSideProps,
        getStaticPaths: () => getStaticPaths,
        getStaticProps: () => getStaticProps,
        reportWebVitals: () => reportWebVitals,
        routeModule: () => routeModule,
        unstable_getServerProps: () => unstable_getServerProps,
        unstable_getServerSideProps: () => unstable_getServerSideProps,
        unstable_getStaticParams: () => unstable_getStaticParams,
        unstable_getStaticPaths: () => unstable_getStaticPaths,
        unstable_getStaticProps: () => unstable_getStaticProps,
      });
      /* ESM import */ var next_dist_server_route_modules_pages_module_compiled__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(1355);
      /* ESM import */ var next_dist_server_route_modules_pages_module_compiled__WEBPACK_IMPORTED_MODULE_0___default =
        /*#__PURE__*/ __webpack_require__.n(
          next_dist_server_route_modules_pages_module_compiled__WEBPACK_IMPORTED_MODULE_0__
        );
      /* ESM import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(5619);
      /* ESM import */ var next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__ =
        __webpack_require__(1835);
      /* ESM import */ var next_dist_pages_document__WEBPACK_IMPORTED_MODULE_3__ =
        __webpack_require__(5843);
      /* ESM import */ var next_dist_pages_document__WEBPACK_IMPORTED_MODULE_3___default =
        /*#__PURE__*/ __webpack_require__.n(
          next_dist_pages_document__WEBPACK_IMPORTED_MODULE_3__
        );
      /* ESM import */ var next_dist_pages_app__WEBPACK_IMPORTED_MODULE_4__ =
        __webpack_require__(4437);
      /* ESM import */ var next_dist_pages_app__WEBPACK_IMPORTED_MODULE_4___default =
        /*#__PURE__*/ __webpack_require__.n(
          next_dist_pages_app__WEBPACK_IMPORTED_MODULE_4__
        );
      /* ESM import */ var next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__ =
        __webpack_require__(221);
      /* ESM import */ var next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5___default =
        /*#__PURE__*/ __webpack_require__.n(
          next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__
        );

      // Import the app and document modules.

      // Import the userland code.

      // Re-export the component (should be the default export).
      /* ESM default export */ const __WEBPACK_DEFAULT_EXPORT__ = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'default'
      );
      // Re-export methods.
      const getStaticProps = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'getStaticProps'
      );
      const getStaticPaths = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'getStaticPaths'
      );
      const getServerSideProps = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'getServerSideProps'
      );
      const config = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'config'
      );
      const reportWebVitals = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'reportWebVitals'
      );
      // Re-export legacy methods.
      const unstable_getStaticProps = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'unstable_getStaticProps'
      );
      const unstable_getStaticPaths = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'unstable_getStaticPaths'
      );
      const unstable_getStaticParams = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'unstable_getStaticParams'
      );
      const unstable_getServerProps = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'unstable_getServerProps'
      );
      const unstable_getServerSideProps = (0,
      next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(
        next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
        'unstable_getServerSideProps'
      );
      // Create and export the route module that will be consumed.
      const routeModule =
        new next_dist_server_route_modules_pages_module_compiled__WEBPACK_IMPORTED_MODULE_0__.PagesRouteModule(
          {
            definition: {
              kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind
                .PAGES,
              page: '/_error',
              pathname: '/_error',
              // The following aren't used in production.
              bundlePath: '',
              filename: '',
            },
            components: {
              // default export might not exist when optimized for data only
              App: next_dist_pages_app__WEBPACK_IMPORTED_MODULE_4___default(),
              Document: next_dist_pages_document__WEBPACK_IMPORTED_MODULE_3___default(),
            },
            userland: next_dist_pages_error__WEBPACK_IMPORTED_MODULE_5__,
          }
        );

      //# sourceMappingURL=pages.js.map
    },
    4437: function (module, exports, __webpack_require__) {
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      Object.defineProperty(exports, 'default', {
        enumerable: true,
        get: function () {
          return App;
        },
      });
      const _interop_require_default = __webpack_require__(1977);
      const _jsxruntime = __webpack_require__(997);
      const _react = /*#__PURE__*/ _interop_require_default._(__webpack_require__(6689));
      const _utils = __webpack_require__(1210);
      /**
       * `App` component is used for initialize of pages. It allows for overwriting and full
       * control of the `page` initialization. This allows for keeping state between navigation,
       * custom error handling, injecting additional data.
       */ async function appGetInitialProps(param) {
        let { Component, ctx } = param;
        const pageProps = await (0, _utils.loadGetInitialProps)(Component, ctx);
        return {
          pageProps,
        };
      }
      class App extends _react.default.Component {
        render() {
          const { Component, pageProps } = this.props;
          return /*#__PURE__*/ (0, _jsxruntime.jsx)(Component, {
            ...pageProps,
          });
        }
      }
      App.origGetInitialProps = appGetInitialProps;
      App.getInitialProps = appGetInitialProps;
      if (
        (typeof exports['default'] === 'function' ||
          (typeof exports['default'] === 'object' && exports['default'] !== null)) &&
        typeof exports['default'].__esModule === 'undefined'
      ) {
        Object.defineProperty(exports['default'], '__esModule', {
          value: true,
        });
        Object.assign(exports['default'], exports);
        module.exports = exports['default'];
      } //# sourceMappingURL=_app.js.map
    },
    5843: function (__unused_webpack_module, exports, __webpack_require__) {
      /// <reference types="webpack/module.d.ts" />

      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      0 && 0;
      function _export(target, all) {
        for (var name in all)
          Object.defineProperty(target, name, {
            enumerable: true,
            get: all[name],
          });
      }
      _export(exports, {
        Head: function () {
          return Head;
        },
        Html: function () {
          return Html;
        },
        Main: function () {
          return Main;
        },
        NextScript: function () {
          return NextScript;
        },
        /**
         * `Document` component handles the initial `document` markup and renders only on the
         * server side. Commonly used for implementing server side rendering for `css-in-js`
         * libraries.
         */ default: function () {
          return Document;
        },
      });
      const _jsxruntime = __webpack_require__(997);
      const _react = /*#__PURE__*/ _interop_require_wildcard(__webpack_require__(6689));
      const _constants = __webpack_require__(3837);
      const _getpagefiles = __webpack_require__(4006);
      const _htmlescape = __webpack_require__(788);
      const _iserror = /*#__PURE__*/ _interop_require_default(__webpack_require__(7512));
      const _htmlcontextsharedruntime = __webpack_require__(5517);
      const _encodeuripath = __webpack_require__(1706);
      const _tracer = __webpack_require__(3528);
      const _utils = __webpack_require__(4829);
      function _interop_require_default(obj) {
        return obj && obj.__esModule
          ? obj
          : {
              default: obj,
            };
      }
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== 'function') return null;
        var cacheBabelInterop = new WeakMap();
        var cacheNodeInterop = new WeakMap();
        return (_getRequireWildcardCache = function (nodeInterop) {
          return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) {
          return obj;
        }
        if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
          return {
            default: obj,
          };
        }
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) {
          return cache.get(obj);
        }
        var newObj = {
          __proto__: null,
        };
        var hasPropertyDescriptor =
          Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== 'default' && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor
              ? Object.getOwnPropertyDescriptor(obj, key)
              : null;
            if (desc && (desc.get || desc.set)) {
              Object.defineProperty(newObj, key, desc);
            } else {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        if (cache) {
          cache.set(obj, newObj);
        }
        return newObj;
      }
      /** Set of pages that have triggered a large data warning on production mode. */ const largePageDataWarnings =
        new Set();
      function getDocumentFiles(buildManifest, pathname, inAmpMode) {
        const sharedFiles = (0, _getpagefiles.getPageFiles)(buildManifest, '/_app');
        const pageFiles =
          true && inAmpMode
            ? []
            : (0, _getpagefiles.getPageFiles)(buildManifest, pathname);
        return {
          sharedFiles,
          pageFiles,
          allFiles: [...new Set([...sharedFiles, ...pageFiles])],
        };
      }
      function getPolyfillScripts(context, props) {
        // polyfills.js has to be rendered as nomodule without async
        // It also has to be the first script to load
        const {
          assetPrefix,
          buildManifest,
          assetQueryString,
          disableOptimizedLoading,
          crossOrigin,
        } = context;
        return buildManifest.polyfillFiles
          .filter(
            (polyfill) => polyfill.endsWith('.js') && !polyfill.endsWith('.module.js')
          )
          .map((polyfill) =>
            /*#__PURE__*/ (0, _jsxruntime.jsx)(
              'script',
              {
                defer: !disableOptimizedLoading,
                nonce: props.nonce,
                crossOrigin: props.crossOrigin || crossOrigin,
                noModule: true,
                src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(polyfill)}${assetQueryString}`,
              },
              polyfill
            )
          );
      }
      function hasComponentProps(child) {
        return !!child && !!child.props;
      }
      function AmpStyles({ styles }) {
        if (!styles) return null;
        // try to parse styles from fragment for backwards compat
        const curStyles = Array.isArray(styles) ? styles : [];
        if (
          styles.props && // @ts-ignore Property 'props' does not exist on type ReactElement
          Array.isArray(styles.props.children)
        ) {
          const hasStyles = (el) => {
            var _el_props_dangerouslySetInnerHTML, _el_props;
            return el == null
              ? void 0
              : (_el_props = el.props) == null
                ? void 0
                : (_el_props_dangerouslySetInnerHTML =
                      _el_props.dangerouslySetInnerHTML) == null
                  ? void 0
                  : _el_props_dangerouslySetInnerHTML.__html;
          };
          // @ts-ignore Property 'props' does not exist on type ReactElement
          styles.props.children.forEach((child) => {
            if (Array.isArray(child)) {
              child.forEach((el) => hasStyles(el) && curStyles.push(el));
            } else if (hasStyles(child)) {
              curStyles.push(child);
            }
          });
        }
        /* Add custom styles before AMP styles to prevent accidental overrides */ return /*#__PURE__*/ (0,
        _jsxruntime.jsx)('style', {
          'amp-custom': '',
          dangerouslySetInnerHTML: {
            __html: curStyles
              .map((style) => style.props.dangerouslySetInnerHTML.__html)
              .join('')
              .replace(/\/\*# sourceMappingURL=.*\*\//g, '')
              .replace(/\/\*@ sourceURL=.*?\*\//g, ''),
          },
        });
      }
      function getDynamicChunks(context, props, files) {
        const {
          dynamicImports,
          assetPrefix,
          isDevelopment,
          assetQueryString,
          disableOptimizedLoading,
          crossOrigin,
        } = context;
        return dynamicImports.map((file) => {
          if (!file.endsWith('.js') || files.allFiles.includes(file)) return null;
          return /*#__PURE__*/ (0, _jsxruntime.jsx)(
            'script',
            {
              async: !isDevelopment && disableOptimizedLoading,
              defer: !disableOptimizedLoading,
              src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
              nonce: props.nonce,
              crossOrigin: props.crossOrigin || crossOrigin,
            },
            file
          );
        });
      }
      function getScripts(context, props, files) {
        var _buildManifest_lowPriorityFiles;
        const {
          assetPrefix,
          buildManifest,
          isDevelopment,
          assetQueryString,
          disableOptimizedLoading,
          crossOrigin,
        } = context;
        const normalScripts = files.allFiles.filter((file) => file.endsWith('.js'));
        const lowPriorityScripts =
          (_buildManifest_lowPriorityFiles = buildManifest.lowPriorityFiles) == null
            ? void 0
            : _buildManifest_lowPriorityFiles.filter((file) => file.endsWith('.js'));
        return [...normalScripts, ...lowPriorityScripts].map((file) => {
          return /*#__PURE__*/ (0, _jsxruntime.jsx)(
            'script',
            {
              src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
              nonce: props.nonce,
              async: !isDevelopment && disableOptimizedLoading,
              defer: !disableOptimizedLoading,
              crossOrigin: props.crossOrigin || crossOrigin,
            },
            file
          );
        });
      }
      function getPreNextWorkerScripts(context, props) {
        const { assetPrefix, scriptLoader, crossOrigin, nextScriptWorkers } = context;
        // disable `nextScriptWorkers` in edge runtime
        if (!nextScriptWorkers || 'nodejs' === 'edge') return null;
        try {
          // @ts-expect-error: Prevent webpack from processing this require
          let { partytownSnippet } = require('@builder.io/partytown/integration');
          const children = Array.isArray(props.children)
            ? props.children
            : [props.children];
          // Check to see if the user has defined their own Partytown configuration
          const userDefinedConfig = children.find((child) => {
            var _child_props_dangerouslySetInnerHTML, _child_props;
            return (
              hasComponentProps(child) &&
              (child == null
                ? void 0
                : (_child_props = child.props) == null
                  ? void 0
                  : (_child_props_dangerouslySetInnerHTML =
                        _child_props.dangerouslySetInnerHTML) == null
                    ? void 0
                    : _child_props_dangerouslySetInnerHTML.__html.length) &&
              'data-partytown-config' in child.props
            );
          });
          return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
            children: [
              !userDefinedConfig &&
                /*#__PURE__*/ (0, _jsxruntime.jsx)('script', {
                  'data-partytown-config': '',
                  dangerouslySetInnerHTML: {
                    __html: `
            partytown = {
              lib: "${assetPrefix}/_next/static/~partytown/"
            };
          `,
                  },
                }),
              /*#__PURE__*/ (0, _jsxruntime.jsx)('script', {
                'data-partytown': '',
                dangerouslySetInnerHTML: {
                  __html: partytownSnippet(),
                },
              }),
              (scriptLoader.worker || []).map((file, index) => {
                const {
                  strategy,
                  src,
                  children: scriptChildren,
                  dangerouslySetInnerHTML,
                  ...scriptProps
                } = file;
                let srcProps = {};
                if (src) {
                  // Use external src if provided
                  srcProps.src = src;
                } else if (dangerouslySetInnerHTML && dangerouslySetInnerHTML.__html) {
                  // Embed inline script if provided with dangerouslySetInnerHTML
                  srcProps.dangerouslySetInnerHTML = {
                    __html: dangerouslySetInnerHTML.__html,
                  };
                } else if (scriptChildren) {
                  // Embed inline script if provided with children
                  srcProps.dangerouslySetInnerHTML = {
                    __html:
                      typeof scriptChildren === 'string'
                        ? scriptChildren
                        : Array.isArray(scriptChildren)
                          ? scriptChildren.join('')
                          : '',
                  };
                } else {
                  throw Object.defineProperty(
                    new Error(
                      'Invalid usage of next/script. Did you forget to include a src attribute or an inline script? https://nextjs.org/docs/messages/invalid-script'
                    ),
                    '__NEXT_ERROR_CODE',
                    {
                      value: 'E82',
                      enumerable: false,
                      configurable: true,
                    }
                  );
                }
                return /*#__PURE__*/ (0, _react.createElement)('script', {
                  ...srcProps,
                  ...scriptProps,
                  type: 'text/partytown',
                  key: src || index,
                  nonce: props.nonce,
                  'data-nscript': 'worker',
                  crossOrigin: props.crossOrigin || crossOrigin,
                });
              }),
            ],
          });
        } catch (err) {
          if ((0, _iserror.default)(err) && err.code !== 'MODULE_NOT_FOUND') {
            console.warn(`Warning: ${err.message}`);
          }
          return null;
        }
      }
      function getPreNextScripts(context, props) {
        const { scriptLoader, disableOptimizedLoading, crossOrigin } = context;
        const webWorkerScripts = getPreNextWorkerScripts(context, props);
        const beforeInteractiveScripts = (scriptLoader.beforeInteractive || [])
          .filter((script) => script.src)
          .map((file, index) => {
            const { strategy, ...scriptProps } = file;
            return /*#__PURE__*/ (0, _react.createElement)('script', {
              ...scriptProps,
              key: scriptProps.src || index,
              defer: scriptProps.defer ?? !disableOptimizedLoading,
              nonce: props.nonce,
              'data-nscript': 'beforeInteractive',
              crossOrigin: props.crossOrigin || crossOrigin,
            });
          });
        return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
          children: [webWorkerScripts, beforeInteractiveScripts],
        });
      }
      function getHeadHTMLProps(props) {
        const { crossOrigin, nonce, ...restProps } = props;
        // This assignment is necessary for additional type checking to avoid unsupported attributes in <head>
        const headProps = restProps;
        return headProps;
      }
      function getAmpPath(ampPath, asPath) {
        return ampPath || `${asPath}${asPath.includes('?') ? '&' : '?'}amp=1`;
      }
      function getNextFontLinkTags(nextFontManifest, dangerousAsPath, assetPrefix = '') {
        if (!nextFontManifest) {
          return {
            preconnect: null,
            preload: null,
          };
        }
        const appFontsEntry = nextFontManifest.pages['/_app'];
        const pageFontsEntry = nextFontManifest.pages[dangerousAsPath];
        const preloadedFontFiles = Array.from(
          new Set([...(appFontsEntry ?? []), ...(pageFontsEntry ?? [])])
        );
        // If no font files should preload but there's an entry for the path, add a preconnect tag.
        const preconnectToSelf = !!(
          preloadedFontFiles.length === 0 &&
          (appFontsEntry || pageFontsEntry)
        );
        return {
          preconnect: preconnectToSelf
            ? /*#__PURE__*/ (0, _jsxruntime.jsx)('link', {
                'data-next-font': nextFontManifest.pagesUsingSizeAdjust
                  ? 'size-adjust'
                  : '',
                rel: 'preconnect',
                href: '/',
                crossOrigin: 'anonymous',
              })
            : null,
          preload: preloadedFontFiles
            ? preloadedFontFiles.map((fontFile) => {
                const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(fontFile)[1];
                return /*#__PURE__*/ (0, _jsxruntime.jsx)(
                  'link',
                  {
                    rel: 'preload',
                    href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(fontFile)}`,
                    as: 'font',
                    type: `font/${ext}`,
                    crossOrigin: 'anonymous',
                    'data-next-font': fontFile.includes('-s') ? 'size-adjust' : '',
                  },
                  fontFile
                );
              })
            : null,
        };
      }
      class Head extends _react.default.Component {
        static #_ = (this.contextType = _htmlcontextsharedruntime.HtmlContext);
        getCssLinks(files) {
          const {
            assetPrefix,
            assetQueryString,
            dynamicImports,
            dynamicCssManifest,
            crossOrigin,
            optimizeCss,
          } = this.context;
          const cssFiles = files.allFiles.filter((f) => f.endsWith('.css'));
          const sharedFiles = new Set(files.sharedFiles);
          // Unmanaged files are CSS files that will be handled directly by the
          // webpack runtime (`mini-css-extract-plugin`).
          let unmanagedFiles = new Set([]);
          let localDynamicCssFiles = Array.from(
            new Set(dynamicImports.filter((file) => file.endsWith('.css')))
          );
          if (localDynamicCssFiles.length) {
            const existing = new Set(cssFiles);
            localDynamicCssFiles = localDynamicCssFiles.filter(
              (f) => !(existing.has(f) || sharedFiles.has(f))
            );
            unmanagedFiles = new Set(localDynamicCssFiles);
            cssFiles.push(...localDynamicCssFiles);
          }
          let cssLinkElements = [];
          cssFiles.forEach((file) => {
            const isSharedFile = sharedFiles.has(file);
            const isUnmanagedFile = unmanagedFiles.has(file);
            const isFileInDynamicCssManifest = dynamicCssManifest.has(file);
            if (!optimizeCss) {
              cssLinkElements.push(
                /*#__PURE__*/ (0, _jsxruntime.jsx)(
                  'link',
                  {
                    nonce: this.props.nonce,
                    rel: 'preload',
                    href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                    as: 'style',
                    crossOrigin: this.props.crossOrigin || crossOrigin,
                  },
                  `${file}-preload`
                )
              );
            }
            cssLinkElements.push(
              /*#__PURE__*/ (0, _jsxruntime.jsx)(
                'link',
                {
                  nonce: this.props.nonce,
                  rel: 'stylesheet',
                  href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                  crossOrigin: this.props.crossOrigin || crossOrigin,
                  'data-n-g': isUnmanagedFile ? undefined : isSharedFile ? '' : undefined,
                  'data-n-p':
                    isSharedFile || isUnmanagedFile || isFileInDynamicCssManifest
                      ? undefined
                      : '',
                },
                file
              )
            );
          });
          return cssLinkElements.length === 0 ? null : cssLinkElements;
        }
        getPreloadDynamicChunks() {
          const { dynamicImports, assetPrefix, assetQueryString, crossOrigin } =
            this.context;
          return dynamicImports
            .map((file) => {
              if (!file.endsWith('.js')) {
                return null;
              }
              return /*#__PURE__*/ (0, _jsxruntime.jsx)(
                'link',
                {
                  rel: 'preload',
                  href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                  as: 'script',
                  nonce: this.props.nonce,
                  crossOrigin: this.props.crossOrigin || crossOrigin,
                },
                file
              );
            }) // Filter out nulled scripts
            .filter(Boolean);
        }
        getPreloadMainLinks(files) {
          const { assetPrefix, assetQueryString, scriptLoader, crossOrigin } =
            this.context;
          const preloadFiles = files.allFiles.filter((file) => {
            return file.endsWith('.js');
          });
          return [
            ...(scriptLoader.beforeInteractive || []).map((file) =>
              /*#__PURE__*/ (0, _jsxruntime.jsx)(
                'link',
                {
                  nonce: this.props.nonce,
                  rel: 'preload',
                  href: file.src,
                  as: 'script',
                  crossOrigin: this.props.crossOrigin || crossOrigin,
                },
                file.src
              )
            ),
            ...preloadFiles.map((file) =>
              /*#__PURE__*/ (0, _jsxruntime.jsx)(
                'link',
                {
                  nonce: this.props.nonce,
                  rel: 'preload',
                  href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                  as: 'script',
                  crossOrigin: this.props.crossOrigin || crossOrigin,
                },
                file
              )
            ),
          ];
        }
        getBeforeInteractiveInlineScripts() {
          const { scriptLoader } = this.context;
          const { nonce, crossOrigin } = this.props;
          return (scriptLoader.beforeInteractive || [])
            .filter(
              (script) =>
                !script.src && (script.dangerouslySetInnerHTML || script.children)
            )
            .map((file, index) => {
              const { strategy, children, dangerouslySetInnerHTML, src, ...scriptProps } =
                file;
              let html = '';
              if (dangerouslySetInnerHTML && dangerouslySetInnerHTML.__html) {
                html = dangerouslySetInnerHTML.__html;
              } else if (children) {
                html =
                  typeof children === 'string'
                    ? children
                    : Array.isArray(children)
                      ? children.join('')
                      : '';
              }
              return /*#__PURE__*/ (0, _react.createElement)('script', {
                ...scriptProps,
                dangerouslySetInnerHTML: {
                  __html: html,
                },
                key: scriptProps.id || index,
                nonce: nonce,
                'data-nscript': 'beforeInteractive',
                crossOrigin: crossOrigin || undefined,
              });
            });
        }
        getDynamicChunks(files) {
          return getDynamicChunks(this.context, this.props, files);
        }
        getPreNextScripts() {
          return getPreNextScripts(this.context, this.props);
        }
        getScripts(files) {
          return getScripts(this.context, this.props, files);
        }
        getPolyfillScripts() {
          return getPolyfillScripts(this.context, this.props);
        }
        render() {
          const {
            styles,
            ampPath,
            inAmpMode,
            hybridAmp,
            canonicalBase,
            __NEXT_DATA__,
            dangerousAsPath,
            headTags,
            unstable_runtimeJS,
            unstable_JsPreload,
            disableOptimizedLoading,
            optimizeCss,
            assetPrefix,
            nextFontManifest,
          } = this.context;
          const disableRuntimeJS = unstable_runtimeJS === false;
          const disableJsPreload =
            unstable_JsPreload === false || !disableOptimizedLoading;
          this.context.docComponentsRendered.Head = true;
          let { head } = this.context;
          let cssPreloads = [];
          let otherHeadElements = [];
          if (head) {
            head.forEach((child) => {
              if (
                child &&
                child.type === 'link' &&
                child.props['rel'] === 'preload' &&
                child.props['as'] === 'style'
              ) {
                if (this.context.strictNextHead) {
                  cssPreloads.push(
                    /*#__PURE__*/ _react.default.cloneElement(child, {
                      'data-next-head': '',
                    })
                  );
                } else {
                  cssPreloads.push(child);
                }
              } else {
                if (child) {
                  if (this.context.strictNextHead) {
                    otherHeadElements.push(
                      /*#__PURE__*/ _react.default.cloneElement(child, {
                        'data-next-head': '',
                      })
                    );
                  } else {
                    otherHeadElements.push(child);
                  }
                }
              }
            });
            head = cssPreloads.concat(otherHeadElements);
          }
          let children = _react.default.Children.toArray(this.props.children).filter(
            Boolean
          );
          // show a warning if Head contains <title> (only in development)
          if (true) {
            children = _react.default.Children.map(children, (child) => {
              var _child_props;
              const isReactHelmet =
                child == null
                  ? void 0
                  : (_child_props = child.props) == null
                    ? void 0
                    : _child_props['data-react-helmet'];
              if (!isReactHelmet) {
                var _child_props1;
                if ((child == null ? void 0 : child.type) === 'title') {
                  console.warn(
                    "Warning: <title> should not be used in _document.js's <Head>. https://nextjs.org/docs/messages/no-document-title"
                  );
                } else if (
                  (child == null ? void 0 : child.type) === 'meta' &&
                  (child == null
                    ? void 0
                    : (_child_props1 = child.props) == null
                      ? void 0
                      : _child_props1.name) === 'viewport'
                ) {
                  console.warn(
                    "Warning: viewport meta tags should not be used in _document.js's <Head>. https://nextjs.org/docs/messages/no-document-viewport-meta"
                  );
                }
              }
              return child;
              // @types/react bug. Returned value from .map will not be `null` if you pass in `[null]`
            });
            if (this.props.crossOrigin)
              console.warn(
                'Warning: `Head` attribute `crossOrigin` is deprecated. https://nextjs.org/docs/messages/doc-crossorigin-deprecated'
              );
          }
          let hasAmphtmlRel = false;
          let hasCanonicalRel = false;
          // show warning and remove conflicting amp head tags
          head = _react.default.Children.map(head || [], (child) => {
            if (!child) return child;
            const { type, props } = child;
            if (true && inAmpMode) {
              let badProp = '';
              if (type === 'meta' && props.name === 'viewport') {
                badProp = 'name="viewport"';
              } else if (type === 'link' && props.rel === 'canonical') {
                hasCanonicalRel = true;
              } else if (type === 'script') {
                // only block if
                // 1. it has a src and isn't pointing to ampproject's CDN
                // 2. it is using dangerouslySetInnerHTML without a type or
                // a type of text/javascript
                if (
                  (props.src && props.src.indexOf('ampproject') < -1) ||
                  (props.dangerouslySetInnerHTML &&
                    (!props.type || props.type === 'text/javascript'))
                ) {
                  badProp = '<script';
                  Object.keys(props).forEach((prop) => {
                    badProp += ` ${prop}="${props[prop]}"`;
                  });
                  badProp += '/>';
                }
              }
              if (badProp) {
                console.warn(
                  `Found conflicting amp tag "${child.type}" with conflicting prop ${badProp} in ${__NEXT_DATA__.page}. https://nextjs.org/docs/messages/conflicting-amp-tag`
                );
                return null;
              }
            } else {
              // non-amp mode
              if (type === 'link' && props.rel === 'amphtml') {
                hasAmphtmlRel = true;
              }
            }
            return child;
            // @types/react bug. Returned value from .map will not be `null` if you pass in `[null]`
          });
          const files = getDocumentFiles(
            this.context.buildManifest,
            this.context.__NEXT_DATA__.page,
            true && inAmpMode
          );
          const nextFontLinkTags = getNextFontLinkTags(
            nextFontManifest,
            dangerousAsPath,
            assetPrefix
          );
          const tracingMetadata = (0, _utils.getTracedMetadata)(
            (0, _tracer.getTracer)().getTracePropagationData(),
            this.context.experimentalClientTraceMetadata
          );
          const traceMetaTags = (tracingMetadata || []).map(({ key, value }, index) =>
            /*#__PURE__*/ (0, _jsxruntime.jsx)(
              'meta',
              {
                name: key,
                content: value,
              },
              `next-trace-data-${index}`
            )
          );
          return /*#__PURE__*/ (0, _jsxruntime.jsxs)('head', {
            ...getHeadHTMLProps(this.props),
            children: [
              this.context.isDevelopment &&
                /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                  children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)('style', {
                      'data-next-hide-fouc': true,
                      'data-ampdevmode': true && inAmpMode ? 'true' : undefined,
                      dangerouslySetInnerHTML: {
                        __html: `body{display:none}`,
                      },
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)('noscript', {
                      'data-next-hide-fouc': true,
                      'data-ampdevmode': true && inAmpMode ? 'true' : undefined,
                      children: /*#__PURE__*/ (0, _jsxruntime.jsx)('style', {
                        dangerouslySetInnerHTML: {
                          __html: `body{display:block}`,
                        },
                      }),
                    }),
                  ],
                }),
              head,
              this.context.strictNextHead
                ? null
                : /*#__PURE__*/ (0, _jsxruntime.jsx)('meta', {
                    name: 'next-head-count',
                    content: _react.default.Children.count(head || []).toString(),
                  }),
              children,
              nextFontLinkTags.preconnect,
              nextFontLinkTags.preload,
              true &&
                inAmpMode &&
                /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                  children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)('meta', {
                      name: 'viewport',
                      content: 'width=device-width,minimum-scale=1,initial-scale=1',
                    }),
                    !hasCanonicalRel &&
                      /*#__PURE__*/ (0, _jsxruntime.jsx)('link', {
                        rel: 'canonical',
                        href:
                          canonicalBase +
                          __webpack_require__(289) /* .cleanAmpPath */
                            .cleanAmpPath(dangerousAsPath),
                      }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)('link', {
                      rel: 'preload',
                      as: 'script',
                      href: 'https://cdn.ampproject.org/v0.js',
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(AmpStyles, {
                      styles: styles,
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)('style', {
                      'amp-boilerplate': '',
                      dangerouslySetInnerHTML: {
                        __html: `body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}`,
                      },
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)('noscript', {
                      children: /*#__PURE__*/ (0, _jsxruntime.jsx)('style', {
                        'amp-boilerplate': '',
                        dangerouslySetInnerHTML: {
                          __html: `body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}`,
                        },
                      }),
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)('script', {
                      async: true,
                      src: 'https://cdn.ampproject.org/v0.js',
                    }),
                  ],
                }),
              !(true && inAmpMode) &&
                /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                  children: [
                    !hasAmphtmlRel &&
                      hybridAmp &&
                      /*#__PURE__*/ (0, _jsxruntime.jsx)('link', {
                        rel: 'amphtml',
                        href: canonicalBase + getAmpPath(ampPath, dangerousAsPath),
                      }),
                    this.getBeforeInteractiveInlineScripts(),
                    !optimizeCss && this.getCssLinks(files),
                    !optimizeCss &&
                      /*#__PURE__*/ (0, _jsxruntime.jsx)('noscript', {
                        'data-n-css': this.props.nonce ?? '',
                      }),
                    !disableRuntimeJS &&
                      !disableJsPreload &&
                      this.getPreloadDynamicChunks(),
                    !disableRuntimeJS &&
                      !disableJsPreload &&
                      this.getPreloadMainLinks(files),
                    !disableOptimizedLoading &&
                      !disableRuntimeJS &&
                      this.getPolyfillScripts(),
                    !disableOptimizedLoading &&
                      !disableRuntimeJS &&
                      this.getPreNextScripts(),
                    !disableOptimizedLoading &&
                      !disableRuntimeJS &&
                      this.getDynamicChunks(files),
                    !disableOptimizedLoading &&
                      !disableRuntimeJS &&
                      this.getScripts(files),
                    optimizeCss && this.getCssLinks(files),
                    optimizeCss &&
                      /*#__PURE__*/ (0, _jsxruntime.jsx)('noscript', {
                        'data-n-css': this.props.nonce ?? '',
                      }),
                    this.context.isDevelopment && // this element is used to mount development styles so the
                      // ordering matches production
                      // (by default, style-loader injects at the bottom of <head />)
                      /*#__PURE__*/ (0, _jsxruntime.jsx)('noscript', {
                        id: '__next_css__DO_NOT_USE__',
                      }),
                    traceMetaTags,
                    styles || null,
                  ],
                }),
              /*#__PURE__*/ _react.default.createElement(
                _react.default.Fragment,
                {},
                ...(headTags || [])
              ),
            ],
          });
        }
      }
      function handleDocumentScriptLoaderItems(scriptLoader, __NEXT_DATA__, props) {
        var _children_find_props, _children_find, _children_find_props1, _children_find1;
        if (!props.children) return;
        const scriptLoaderItems = [];
        const children = Array.isArray(props.children)
          ? props.children
          : [props.children];
        const headChildren =
          (_children_find = children.find((child) => child.type === Head)) == null
            ? void 0
            : (_children_find_props = _children_find.props) == null
              ? void 0
              : _children_find_props.children;
        const bodyChildren =
          (_children_find1 = children.find((child) => child.type === 'body')) == null
            ? void 0
            : (_children_find_props1 = _children_find1.props) == null
              ? void 0
              : _children_find_props1.children;
        // Scripts with beforeInteractive can be placed inside Head or <body> so children of both needs to be traversed
        const combinedChildren = [
          ...(Array.isArray(headChildren) ? headChildren : [headChildren]),
          ...(Array.isArray(bodyChildren) ? bodyChildren : [bodyChildren]),
        ];
        _react.default.Children.forEach(combinedChildren, (child) => {
          var _child_type;
          if (!child) return;
          // When using the `next/script` component, register it in script loader.
          if ((_child_type = child.type) == null ? void 0 : _child_type.__nextScript) {
            if (child.props.strategy === 'beforeInteractive') {
              scriptLoader.beforeInteractive = (
                scriptLoader.beforeInteractive || []
              ).concat([
                {
                  ...child.props,
                },
              ]);
              return;
            } else if (
              ['lazyOnload', 'afterInteractive', 'worker'].includes(child.props.strategy)
            ) {
              scriptLoaderItems.push(child.props);
              return;
            } else if (typeof child.props.strategy === 'undefined') {
              scriptLoaderItems.push({
                ...child.props,
                strategy: 'afterInteractive',
              });
              return;
            }
          }
        });
        __NEXT_DATA__.scriptLoader = scriptLoaderItems;
      }
      class NextScript extends _react.default.Component {
        static #_ = (this.contextType = _htmlcontextsharedruntime.HtmlContext);
        getDynamicChunks(files) {
          return getDynamicChunks(this.context, this.props, files);
        }
        getPreNextScripts() {
          return getPreNextScripts(this.context, this.props);
        }
        getScripts(files) {
          return getScripts(this.context, this.props, files);
        }
        getPolyfillScripts() {
          return getPolyfillScripts(this.context, this.props);
        }
        static getInlineScriptSource(context) {
          const { __NEXT_DATA__, largePageDataBytes } = context;
          try {
            const data = JSON.stringify(__NEXT_DATA__);
            if (largePageDataWarnings.has(__NEXT_DATA__.page)) {
              return (0, _htmlescape.htmlEscapeJsonString)(data);
            }
            const bytes = false ? 0 : Buffer.from(data).byteLength;
            const prettyBytes = __webpack_require__(9625) /* ["default"] */['default'];
            if (largePageDataBytes && bytes > largePageDataBytes) {
              if (false) {
              }
              console.warn(
                `Warning: data for page "${__NEXT_DATA__.page}"${__NEXT_DATA__.page === context.dangerousAsPath ? '' : ` (path "${context.dangerousAsPath}")`} is ${prettyBytes(bytes)} which exceeds the threshold of ${prettyBytes(largePageDataBytes)}, this amount of data can reduce performance.\nSee more info here: https://nextjs.org/docs/messages/large-page-data`
              );
            }
            return (0, _htmlescape.htmlEscapeJsonString)(data);
          } catch (err) {
            if (
              (0, _iserror.default)(err) &&
              err.message.indexOf('circular structure') !== -1
            ) {
              throw Object.defineProperty(
                new Error(
                  `Circular structure in "getInitialProps" result of page "${__NEXT_DATA__.page}". https://nextjs.org/docs/messages/circular-structure`
                ),
                '__NEXT_ERROR_CODE',
                {
                  value: 'E490',
                  enumerable: false,
                  configurable: true,
                }
              );
            }
            throw err;
          }
        }
        render() {
          const {
            assetPrefix,
            inAmpMode,
            buildManifest,
            unstable_runtimeJS,
            docComponentsRendered,
            assetQueryString,
            disableOptimizedLoading,
            crossOrigin,
          } = this.context;
          const disableRuntimeJS = unstable_runtimeJS === false;
          docComponentsRendered.NextScript = true;
          if (true && inAmpMode) {
            if (false) {
            }
            const ampDevFiles = [
              ...buildManifest.devFiles,
              ...buildManifest.polyfillFiles,
              ...buildManifest.ampDevFiles,
            ];
            return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
              children: [
                disableRuntimeJS
                  ? null
                  : /*#__PURE__*/ (0, _jsxruntime.jsx)('script', {
                      id: '__NEXT_DATA__',
                      type: 'application/json',
                      nonce: this.props.nonce,
                      crossOrigin: this.props.crossOrigin || crossOrigin,
                      dangerouslySetInnerHTML: {
                        __html: NextScript.getInlineScriptSource(this.context),
                      },
                      'data-ampdevmode': true,
                    }),
                ampDevFiles.map((file) =>
                  /*#__PURE__*/ (0, _jsxruntime.jsx)(
                    'script',
                    {
                      src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                      nonce: this.props.nonce,
                      crossOrigin: this.props.crossOrigin || crossOrigin,
                      'data-ampdevmode': true,
                    },
                    file
                  )
                ),
              ],
            });
          }
          if (true) {
            if (this.props.crossOrigin)
              console.warn(
                'Warning: `NextScript` attribute `crossOrigin` is deprecated. https://nextjs.org/docs/messages/doc-crossorigin-deprecated'
              );
          }
          const files = getDocumentFiles(
            this.context.buildManifest,
            this.context.__NEXT_DATA__.page,
            true && inAmpMode
          );
          return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
            children: [
              !disableRuntimeJS && buildManifest.devFiles
                ? buildManifest.devFiles.map((file) =>
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(
                      'script',
                      {
                        src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                        nonce: this.props.nonce,
                        crossOrigin: this.props.crossOrigin || crossOrigin,
                      },
                      file
                    )
                  )
                : null,
              disableRuntimeJS
                ? null
                : /*#__PURE__*/ (0, _jsxruntime.jsx)('script', {
                    id: '__NEXT_DATA__',
                    type: 'application/json',
                    nonce: this.props.nonce,
                    crossOrigin: this.props.crossOrigin || crossOrigin,
                    dangerouslySetInnerHTML: {
                      __html: NextScript.getInlineScriptSource(this.context),
                    },
                  }),
              disableOptimizedLoading && !disableRuntimeJS && this.getPolyfillScripts(),
              disableOptimizedLoading && !disableRuntimeJS && this.getPreNextScripts(),
              disableOptimizedLoading &&
                !disableRuntimeJS &&
                this.getDynamicChunks(files),
              disableOptimizedLoading && !disableRuntimeJS && this.getScripts(files),
            ],
          });
        }
      }
      function Html(props) {
        const { inAmpMode, docComponentsRendered, locale, scriptLoader, __NEXT_DATA__ } =
          (0, _htmlcontextsharedruntime.useHtmlContext)();
        docComponentsRendered.Html = true;
        handleDocumentScriptLoaderItems(scriptLoader, __NEXT_DATA__, props);
        return /*#__PURE__*/ (0, _jsxruntime.jsx)('html', {
          ...props,
          lang: props.lang || locale || undefined,
          amp: true && inAmpMode ? '' : undefined,
          'data-ampdevmode':
            true && inAmpMode && 'development' !== 'production' ? '' : undefined,
        });
      }
      function Main() {
        const { docComponentsRendered } = (0, _htmlcontextsharedruntime.useHtmlContext)();
        docComponentsRendered.Main = true;
        // @ts-ignore
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(
          'next-js-internal-body-render-target',
          {}
        );
      }
      class Document extends _react.default.Component {
        /**
         * `getInitialProps` hook returns the context object with the addition of
         * `renderPage`. `renderPage` callback executes `React` rendering logic synchronously
         * to support server-rendering wrappers
         */ static getInitialProps(ctx) {
          return ctx.defaultGetInitialProps(ctx);
        }
        render() {
          return /*#__PURE__*/ (0, _jsxruntime.jsxs)(Html, {
            children: [
              /*#__PURE__*/ (0, _jsxruntime.jsx)(Head, {}),
              /*#__PURE__*/ (0, _jsxruntime.jsxs)('body', {
                children: [
                  /*#__PURE__*/ (0, _jsxruntime.jsx)(Main, {}),
                  /*#__PURE__*/ (0, _jsxruntime.jsx)(NextScript, {}),
                ],
              }),
            ],
          });
        }
      }
      // Add a special property to the built-in `Document` component so later we can
      // identify if a user customized `Document` is used or not.
      const InternalFunctionDocument = function InternalFunctionDocument() {
        return /*#__PURE__*/ (0, _jsxruntime.jsxs)(Html, {
          children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)(Head, {}),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)('body', {
              children: [
                /*#__PURE__*/ (0, _jsxruntime.jsx)(Main, {}),
                /*#__PURE__*/ (0, _jsxruntime.jsx)(NextScript, {}),
              ],
            }),
          ],
        });
      };
      Document[_constants.NEXT_BUILTIN_DOCUMENT] = InternalFunctionDocument; //# sourceMappingURL=_document.js.map
    },
    221: function (module, exports, __webpack_require__) {
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      Object.defineProperty(exports, 'default', {
        enumerable: true,
        get: function () {
          return Error;
        },
      });
      const _interop_require_default = __webpack_require__(1977);
      const _jsxruntime = __webpack_require__(997);
      const _react = /*#__PURE__*/ _interop_require_default._(__webpack_require__(6689));
      const _head = /*#__PURE__*/ _interop_require_default._(__webpack_require__(7189));
      const statusCodes = {
        400: 'Bad Request',
        404: 'This page could not be found',
        405: 'Method Not Allowed',
        500: 'Internal Server Error',
      };
      function _getInitialProps(param) {
        let { req, res, err } = param;
        const statusCode =
          res && res.statusCode ? res.statusCode : err ? err.statusCode : 404;
        let hostname;
        if (false) {
        } else if (req) {
          const { getRequestMeta } = __webpack_require__(2126);
          const initUrl = getRequestMeta(req, 'initURL');
          if (initUrl) {
            const url = new URL(initUrl);
            hostname = url.hostname;
          }
        }
        return {
          statusCode,
          hostname,
        };
      }
      const styles = {
        error: {
          // https://github.com/sindresorhus/modern-normalize/blob/main/modern-normalize.css#L38-L52
          fontFamily:
            'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
          height: '100vh',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
        desc: {
          lineHeight: '48px',
        },
        h1: {
          display: 'inline-block',
          margin: '0 20px 0 0',
          paddingRight: 23,
          fontSize: 24,
          fontWeight: 500,
          verticalAlign: 'top',
        },
        h2: {
          fontSize: 14,
          fontWeight: 400,
          lineHeight: '28px',
        },
        wrap: {
          display: 'inline-block',
        },
      };
      class Error extends _react.default.Component {
        render() {
          const { statusCode, withDarkMode = true } = this.props;
          const title =
            this.props.title ||
            statusCodes[statusCode] ||
            'An unexpected error has occurred';
          return /*#__PURE__*/ (0, _jsxruntime.jsxs)('div', {
            style: styles.error,
            children: [
              /*#__PURE__*/ (0, _jsxruntime.jsx)(_head.default, {
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)('title', {
                  children: statusCode
                    ? statusCode + ': ' + title
                    : 'Application error: a client-side exception has occurred',
                }),
              }),
              /*#__PURE__*/ (0, _jsxruntime.jsxs)('div', {
                style: styles.desc,
                children: [
                  /*#__PURE__*/ (0, _jsxruntime.jsx)('style', {
                    dangerouslySetInnerHTML: {
                      /* CSS minified from
                body { margin: 0; color: #000; background: #fff; }
                .next-error-h1 {
                  border-right: 1px solid rgba(0, 0, 0, .3);
                }

                ${
                  withDarkMode
                    ? `@media (prefers-color-scheme: dark) {
                  body { color: #fff; background: #000; }
                  .next-error-h1 {
                    border-right: 1px solid rgba(255, 255, 255, .3);
                  }
                }`
                    : ''
                }
               */ __html:
                        'body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}' +
                        (withDarkMode
                          ? '@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}'
                          : ''),
                    },
                  }),
                  statusCode
                    ? /*#__PURE__*/ (0, _jsxruntime.jsx)('h1', {
                        className: 'next-error-h1',
                        style: styles.h1,
                        children: statusCode,
                      })
                    : null,
                  /*#__PURE__*/ (0, _jsxruntime.jsx)('div', {
                    style: styles.wrap,
                    children: /*#__PURE__*/ (0, _jsxruntime.jsxs)('h2', {
                      style: styles.h2,
                      children: [
                        this.props.title || statusCode
                          ? title
                          : /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                              children: [
                                'Application error: a client-side exception has occurred',
                                ' ',
                                Boolean(this.props.hostname) &&
                                  /*#__PURE__*/ (0, _jsxruntime.jsxs)(
                                    _jsxruntime.Fragment,
                                    {
                                      children: ['while loading ', this.props.hostname],
                                    }
                                  ),
                                ' ',
                                '(see the browser console for more information)',
                              ],
                            }),
                        '.',
                      ],
                    }),
                  }),
                ],
              }),
            ],
          });
        }
      }
      Error.displayName = 'ErrorPage';
      Error.getInitialProps = _getInitialProps;
      Error.origGetInitialProps = _getInitialProps;
      if (
        (typeof exports['default'] === 'function' ||
          (typeof exports['default'] === 'object' && exports['default'] !== null)) &&
        typeof exports['default'].__esModule === 'undefined'
      ) {
        Object.defineProperty(exports['default'], '__esModule', {
          value: true,
        });
        Object.assign(exports['default'], exports);
        module.exports = exports['default'];
      } //# sourceMappingURL=_error.js.map
    },
    8932: function (__unused_webpack_module, exports) {
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      Object.defineProperty(exports, 'isInAmpMode', {
        enumerable: true,
        get: function () {
          return isInAmpMode;
        },
      });
      function isInAmpMode(param) {
        let {
          ampFirst = false,
          hybrid = false,
          hasQuery = false,
        } = param === void 0 ? {} : param;
        return ampFirst || (hybrid && hasQuery);
      } //# sourceMappingURL=amp-mode.js.map
    },
    7189: function (module, exports, __webpack_require__) {
      /* __next_internal_client_entry_do_not_use__  cjs */
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      0 && 0;
      function _export(target, all) {
        for (var name in all)
          Object.defineProperty(target, name, {
            enumerable: true,
            get: all[name],
          });
      }
      _export(exports, {
        default: function () {
          return _default;
        },
        defaultHead: function () {
          return defaultHead;
        },
      });
      const _interop_require_default = __webpack_require__(1977);
      const _interop_require_wildcard = __webpack_require__(6043);
      const _jsxruntime = __webpack_require__(997);
      const _react = /*#__PURE__*/ _interop_require_wildcard._(__webpack_require__(6689));
      const _sideeffect = /*#__PURE__*/ _interop_require_default._(
        __webpack_require__(5345)
      );
      const _ampcontextsharedruntime = __webpack_require__(1482);
      const _headmanagercontextsharedruntime = __webpack_require__(6659);
      const _ampmode = __webpack_require__(8932);
      const _warnonce = __webpack_require__(9774);
      function defaultHead(inAmpMode) {
        if (inAmpMode === void 0) inAmpMode = false;
        const head = [
          /*#__PURE__*/ (0, _jsxruntime.jsx)(
            'meta',
            {
              charSet: 'utf-8',
            },
            'charset'
          ),
        ];
        if (!inAmpMode) {
          head.push(
            /*#__PURE__*/ (0, _jsxruntime.jsx)(
              'meta',
              {
                name: 'viewport',
                content: 'width=device-width',
              },
              'viewport'
            )
          );
        }
        return head;
      }
      function onlyReactElement(list, child) {
        // React children can be "string" or "number" in this case we ignore them for backwards compat
        if (typeof child === 'string' || typeof child === 'number') {
          return list;
        }
        // Adds support for React.Fragment
        if (child.type === _react.default.Fragment) {
          return list.concat(
            _react.default.Children.toArray(child.props.children).reduce(
              (fragmentList, fragmentChild) => {
                if (
                  typeof fragmentChild === 'string' ||
                  typeof fragmentChild === 'number'
                ) {
                  return fragmentList;
                }
                return fragmentList.concat(fragmentChild);
              },
              []
            )
          );
        }
        return list.concat(child);
      }
      const METATYPES = ['name', 'httpEquiv', 'charSet', 'itemProp'];
      /*
 returns a function for filtering head child elements
 which shouldn't be duplicated, like <title/>
 Also adds support for deduplicated `key` properties
*/ function unique() {
        const keys = new Set();
        const tags = new Set();
        const metaTypes = new Set();
        const metaCategories = {};
        return (h) => {
          let isUnique = true;
          let hasKey = false;
          if (h.key && typeof h.key !== 'number' && h.key.indexOf('$') > 0) {
            hasKey = true;
            const key = h.key.slice(h.key.indexOf('$') + 1);
            if (keys.has(key)) {
              isUnique = false;
            } else {
              keys.add(key);
            }
          }
          // eslint-disable-next-line default-case
          switch (h.type) {
            case 'title':
            case 'base':
              if (tags.has(h.type)) {
                isUnique = false;
              } else {
                tags.add(h.type);
              }
              break;
            case 'meta':
              for (let i = 0, len = METATYPES.length; i < len; i++) {
                const metatype = METATYPES[i];
                if (!h.props.hasOwnProperty(metatype)) continue;
                if (metatype === 'charSet') {
                  if (metaTypes.has(metatype)) {
                    isUnique = false;
                  } else {
                    metaTypes.add(metatype);
                  }
                } else {
                  const category = h.props[metatype];
                  const categories = metaCategories[metatype] || new Set();
                  if ((metatype !== 'name' || !hasKey) && categories.has(category)) {
                    isUnique = false;
                  } else {
                    categories.add(category);
                    metaCategories[metatype] = categories;
                  }
                }
              }
              break;
          }
          return isUnique;
        };
      }
      /** @param headChildrenElements List of children of <Head> */ function reduceComponents(
        headChildrenElements,
        props
      ) {
        const { inAmpMode } = props;
        return headChildrenElements
          .reduce(onlyReactElement, [])
          .reverse()
          .concat(defaultHead(inAmpMode).reverse())
          .filter(unique())
          .reverse()
          .map((c, i) => {
            const key = c.key || i;
            if (false) {
            }
            if (true) {
              // omit JSON-LD structured data snippets from the warning
              if (c.type === 'script' && c.props['type'] !== 'application/ld+json') {
                const srcMessage = c.props['src']
                  ? '<script> tag with src="' + c.props['src'] + '"'
                  : 'inline <script>';
                (0, _warnonce.warnOnce)(
                  'Do not add <script> tags using next/head (see ' +
                    srcMessage +
                    '). Use next/script instead. \nSee more info here: https://nextjs.org/docs/messages/no-script-tags-in-head-component'
                );
              } else if (c.type === 'link' && c.props['rel'] === 'stylesheet') {
                (0, _warnonce.warnOnce)(
                  'Do not add stylesheets using next/head (see <link rel="stylesheet"> tag with href="' +
                    c.props['href'] +
                    '"). Use Document instead. \nSee more info here: https://nextjs.org/docs/messages/no-stylesheets-in-head-component'
                );
              }
            }
            return /*#__PURE__*/ _react.default.cloneElement(c, {
              key,
            });
          });
      }
      /**
       * This component injects elements to `<head>` of your page. To avoid duplicated `tags` in
       * `<head>` you can use the `key` property, which will make sure every tag is only
       * rendered once.
       */ function Head(param) {
        let { children } = param;
        const ampState = (0, _react.useContext)(_ampcontextsharedruntime.AmpStateContext);
        const headManager = (0, _react.useContext)(
          _headmanagercontextsharedruntime.HeadManagerContext
        );
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(_sideeffect.default, {
          reduceComponentsToState: reduceComponents,
          headManager: headManager,
          inAmpMode: (0, _ampmode.isInAmpMode)(ampState),
          children: children,
        });
      }
      const _default = Head;
      if (
        (typeof exports['default'] === 'function' ||
          (typeof exports['default'] === 'object' && exports['default'] !== null)) &&
        typeof exports['default'].__esModule === 'undefined'
      ) {
        Object.defineProperty(exports['default'], '__esModule', {
          value: true,
        });
        Object.assign(exports['default'], exports);
        module.exports = exports['default'];
      } //# sourceMappingURL=head.js.map
    },
    5345: function (__unused_webpack_module, exports, __webpack_require__) {
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      Object.defineProperty(exports, 'default', {
        enumerable: true,
        get: function () {
          return SideEffect;
        },
      });
      const _react = __webpack_require__(6689);
      const isServer = 'undefined' === 'undefined';
      const useClientOnlyLayoutEffect = isServer ? () => {} : _react.useLayoutEffect;
      const useClientOnlyEffect = isServer ? () => {} : _react.useEffect;
      function SideEffect(props) {
        const { headManager, reduceComponentsToState } = props;
        function emitChange() {
          if (headManager && headManager.mountedInstances) {
            const headElements = _react.Children.toArray(
              Array.from(headManager.mountedInstances).filter(Boolean)
            );
            headManager.updateHead(reduceComponentsToState(headElements, props));
          }
        }
        if (isServer) {
          var _headManager_mountedInstances;
          headManager == null
            ? void 0
            : (_headManager_mountedInstances = headManager.mountedInstances) == null
              ? void 0
              : _headManager_mountedInstances.add(props.children);
          emitChange();
        }
        useClientOnlyLayoutEffect(
          {
            'SideEffect.useClientOnlyLayoutEffect': () => {
              var _headManager_mountedInstances;
              headManager == null
                ? void 0
                : (_headManager_mountedInstances = headManager.mountedInstances) == null
                  ? void 0
                  : _headManager_mountedInstances.add(props.children);
              return {
                'SideEffect.useClientOnlyLayoutEffect': () => {
                  var _headManager_mountedInstances;
                  headManager == null
                    ? void 0
                    : (_headManager_mountedInstances = headManager.mountedInstances) ==
                        null
                      ? void 0
                      : _headManager_mountedInstances.delete(props.children);
                },
              }['SideEffect.useClientOnlyLayoutEffect'];
            },
          }['SideEffect.useClientOnlyLayoutEffect']
        );
        // We need to call `updateHead` method whenever the `SideEffect` is trigger in all
        // life-cycles: mount, update, unmount. However, if there are multiple `SideEffect`s
        // being rendered, we only trigger the method from the last one.
        // This is ensured by keeping the last unflushed `updateHead` in the `_pendingUpdate`
        // singleton in the layout effect pass, and actually trigger it in the effect pass.
        useClientOnlyLayoutEffect(
          {
            'SideEffect.useClientOnlyLayoutEffect': () => {
              if (headManager) {
                headManager._pendingUpdate = emitChange;
              }
              return {
                'SideEffect.useClientOnlyLayoutEffect': () => {
                  if (headManager) {
                    headManager._pendingUpdate = emitChange;
                  }
                },
              }['SideEffect.useClientOnlyLayoutEffect'];
            },
          }['SideEffect.useClientOnlyLayoutEffect']
        );
        useClientOnlyEffect(
          {
            'SideEffect.useClientOnlyEffect': () => {
              if (headManager && headManager._pendingUpdate) {
                headManager._pendingUpdate();
                headManager._pendingUpdate = null;
              }
              return {
                'SideEffect.useClientOnlyEffect': () => {
                  if (headManager && headManager._pendingUpdate) {
                    headManager._pendingUpdate();
                    headManager._pendingUpdate = null;
                  }
                },
              }['SideEffect.useClientOnlyEffect'];
            },
          }['SideEffect.useClientOnlyEffect']
        );
        return null;
      } //# sourceMappingURL=side-effect.js.map
    },
    9774: function (__unused_webpack_module, exports) {
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      Object.defineProperty(exports, 'warnOnce', {
        enumerable: true,
        get: function () {
          return warnOnce;
        },
      });
      let warnOnce = (_) => {};
      if (true) {
        const warnings = new Set();
        warnOnce = (msg) => {
          if (!warnings.has(msg)) {
            console.warn(msg);
          }
          warnings.add(msg);
        };
      } //# sourceMappingURL=warn-once.js.map
    },
    2126: function (__unused_webpack_module, exports) {
      /* eslint-disable no-redeclare */
      Object.defineProperty(exports, '__esModule', {
        value: true,
      });
      0 && 0;
      function _export(target, all) {
        for (var name in all)
          Object.defineProperty(target, name, {
            enumerable: true,
            get: all[name],
          });
      }
      _export(exports, {
        NEXT_REQUEST_META: function () {
          return NEXT_REQUEST_META;
        },
        addRequestMeta: function () {
          return addRequestMeta;
        },
        getRequestMeta: function () {
          return getRequestMeta;
        },
        removeRequestMeta: function () {
          return removeRequestMeta;
        },
        setRequestMeta: function () {
          return setRequestMeta;
        },
      });
      const NEXT_REQUEST_META = Symbol.for('NextInternalRequestMeta');
      function getRequestMeta(req, key) {
        const meta = req[NEXT_REQUEST_META] || {};
        return typeof key === 'string' ? meta[key] : meta;
      }
      function setRequestMeta(req, meta) {
        req[NEXT_REQUEST_META] = meta;
        return meta;
      }
      function addRequestMeta(request, key, value) {
        const meta = getRequestMeta(request);
        meta[key] = value;
        return setRequestMeta(request, meta);
      }
      function removeRequestMeta(request, key) {
        const meta = getRequestMeta(request);
        delete meta[key];
        return setRequestMeta(request, meta);
      }

      //# sourceMappingURL=request-meta.js.map
    },
    5619: function (__unused_webpack_module, exports) {
      var __webpack_unused_export__;

      __webpack_unused_export__ = {
        value: true,
      };
      Object.defineProperty(exports, 'RouteKind', {
        enumerable: true,
        get: function () {
          return RouteKind;
        },
      });
      var RouteKind = /*#__PURE__*/ (function (RouteKind) {
        /** `PAGES` represents all the React pages that are under `pages/`. */ RouteKind[
          'PAGES'
        ] = 'PAGES';
        /** `PAGES_API` represents all the API routes under `pages/api/`. */ RouteKind[
          'PAGES_API'
        ] = 'PAGES_API';
        /**
         * `APP_PAGE` represents all the React pages that are under `app/` with the filename
         * of `page.{j,t}s{,x}`.
         */ RouteKind['APP_PAGE'] = 'APP_PAGE';
        /**
         * `APP_ROUTE` represents all the API routes and metadata routes that are under `app/`
         * with the filename of `route.{j,t}s{,x}`.
         */ RouteKind['APP_ROUTE'] = 'APP_ROUTE';
        /** `IMAGE` represents all the images that are generated by `next/image`. */ RouteKind[
          'IMAGE'
        ] = 'IMAGE';
        return RouteKind;
      })({});

      //# sourceMappingURL=route-kind.js.map
    },
    1355: function (module, __unused_webpack_exports, __webpack_require__) {
      if (false) {
      } else {
        if (true) {
          if (false) {
          } else {
            module.exports = __webpack_require__(6019);
          }
        } else {
        }
      }

      //# sourceMappingURL=module.compiled.js.map
    },
    1482: function (module, __unused_webpack_exports, __webpack_require__) {
      module.exports =
        __webpack_require__(
          1355
        ) /* .vendored.contexts.AmpContext */.vendored.contexts.AmpContext;

      //# sourceMappingURL=amp-context.js.map
    },
    6659: function (module, __unused_webpack_exports, __webpack_require__) {
      module.exports =
        __webpack_require__(
          1355
        ) /* .vendored.contexts.HeadManagerContext */.vendored.contexts.HeadManagerContext;

      //# sourceMappingURL=head-manager-context.js.map
    },
    6019: function (module) {
      module.exports = require('next/dist/compiled/next-server/pages.runtime.dev.js');
    },
    6689: function (module) {
      module.exports = require('react');
    },
    997: function (module) {
      module.exports = require('react/jsx-runtime');
    },
    5315: function (module) {
      module.exports = require('path');
    },
    6043: function (__unused_webpack_module, exports) {
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== 'function') return null;

        var cacheBabelInterop = new WeakMap();
        var cacheNodeInterop = new WeakMap();

        return (_getRequireWildcardCache = function (nodeInterop) {
          return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) return obj;
        if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function'))
          return { default: obj };

        var cache = _getRequireWildcardCache(nodeInterop);

        if (cache && cache.has(obj)) return cache.get(obj);

        var newObj = { __proto__: null };
        var hasPropertyDescriptor =
          Object.defineProperty && Object.getOwnPropertyDescriptor;

        for (var key in obj) {
          if (key !== 'default' && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor
              ? Object.getOwnPropertyDescriptor(obj, key)
              : null;
            if (desc && (desc.get || desc.set)) Object.defineProperty(newObj, key, desc);
            else newObj[key] = obj[key];
          }
        }

        newObj.default = obj;

        if (cache) cache.set(obj, newObj);

        return newObj;
      }
      exports._ = _interop_require_wildcard;
    },
  };
  /***/
  // The module cache
  var __webpack_module_cache__ = {};

  // The require function
  function __webpack_require__(moduleId) {
    // Check if module is in cache
    var cachedModule = __webpack_module_cache__[moduleId];
    if (cachedModule !== undefined) {
      if (cachedModule.error !== undefined) throw cachedModule.error;
      return cachedModule.exports;
    }
    // Create a new module (and put it into the cache)
    var module = (__webpack_module_cache__[moduleId] = {
      exports: {},
    });
    // Execute the module function
    try {
      __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    } catch (e) {
      module.error = e;
      throw e;
    }
    // Return the exports of the module
    return module.exports;
  }

  // expose the modules object (__webpack_modules__)
  __webpack_require__.m = __webpack_modules__;

  // the startup function
  __webpack_require__.x = () => {
    // Load entry module and return exports
    // This entry module depends on other loaded chunks and execution need to be delayed
    var __webpack_exports__ = __webpack_require__.O(undefined, ['889'], function () {
      return __webpack_require__(6428);
    });
    __webpack_exports__ = __webpack_require__.O(__webpack_exports__);
    return __webpack_exports__;
  };

  /***/
  // webpack/runtime/compat_get_default_export
  (() => {
    // getDefaultExport function for compatibility with non-ESM modules
    __webpack_require__.n = (module) => {
      var getter = module && module.__esModule ? () => module['default'] : () => module;
      __webpack_require__.d(getter, { a: getter });
      return getter;
    };
  })();
  // webpack/runtime/define_property_getters
  (() => {
    __webpack_require__.d = (exports, definition) => {
      for (var key in definition) {
        if (
          __webpack_require__.o(definition, key) &&
          !__webpack_require__.o(exports, key)
        ) {
          Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
        }
      }
    };
  })();
  // webpack/runtime/ensure_chunk
  (() => {
    __webpack_require__.f = {};
    // This file contains only the entry chunk.
    // The chunk loading function for additional chunks
    __webpack_require__.e = (chunkId) => {
      return Promise.all(
        Object.keys(__webpack_require__.f).reduce((promises, key) => {
          __webpack_require__.f[key](chunkId, promises);
          return promises;
        }, [])
      );
    };
  })();
  // webpack/runtime/get javascript chunk filename
  (() => {
    // This function allow to reference chunks
    __webpack_require__.u = (chunkId) => {
      // return url for filenames not based on template

      // return url for filenames based on template
      return '' + chunkId + '.js';
    };
  })();
  // webpack/runtime/has_own_property
  (() => {
    __webpack_require__.o = (obj, prop) =>
      Object.prototype.hasOwnProperty.call(obj, prop);
  })();
  // webpack/runtime/make_namespace_object
  (() => {
    // define __esModule on exports
    __webpack_require__.r = (exports) => {
      if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
        Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
      }
      Object.defineProperty(exports, '__esModule', { value: true });
    };
  })();
  // webpack/runtime/on_chunk_loaded
  (() => {
    var deferred = [];
    __webpack_require__.O = (result, chunkIds, fn, priority) => {
      if (chunkIds) {
        priority = priority || 0;
        for (var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--)
          deferred[i] = deferred[i - 1];
        deferred[i] = [chunkIds, fn, priority];
        return;
      }
      var notFulfilled = Infinity;
      for (var i = 0; i < deferred.length; i++) {
        var [chunkIds, fn, priority] = deferred[i];
        var fulfilled = true;
        for (var j = 0; j < chunkIds.length; j++) {
          if (
            (priority & (1 === 0) || notFulfilled >= priority) &&
            Object.keys(__webpack_require__.O).every((key) =>
              __webpack_require__.O[key](chunkIds[j])
            )
          ) {
            chunkIds.splice(j--, 1);
          } else {
            fulfilled = false;
            if (priority < notFulfilled) notFulfilled = priority;
          }
        }
        if (fulfilled) {
          deferred.splice(i--, 1);
          var r = fn();
          if (r !== undefined) result = r;
        }
      }
      return result;
    };
  })();
  // webpack/runtime/startup_chunk_dependencies
  (() => {
    var next = __webpack_require__.x;
    __webpack_require__.x = () => {
      __webpack_require__.e('889');
      return next();
    };
  })();
  // webpack/runtime/require_chunk_loading
  (() => {
    var installedChunks = { 67: 1 };
    __webpack_require__.O.require = (chunkId) => installedChunks[chunkId]; // object to store loaded chunks
    // "1" means "loaded", otherwise not loaded yet
    var installChunk = (chunk) => {
      var moreModules = chunk.modules,
        chunkIds = chunk.ids,
        runtime = chunk.runtime;
      for (var moduleId in moreModules) {
        if (__webpack_require__.o(moreModules, moduleId)) {
          __webpack_require__.m[moduleId] = moreModules[moduleId];
        }
      }
      if (runtime) runtime(__webpack_require__);
      for (var i = 0; i < chunkIds.length; i++) installedChunks[chunkIds[i]] = 1;
      __webpack_require__.O();
    }; // require() chunk loading for javascript
    __webpack_require__.f.require = (chunkId, promises) => {
      // "1" is the signal for "already loaded"
      if (!installedChunks[chunkId]) {
        if (true) {
          installChunk(require('../chunks/' + __webpack_require__.u(chunkId)));
        } else installedChunks[chunkId] = 1;
      }
    };
  })();
  /***/
  // run startup
  var __webpack_exports__ = __webpack_require__.x();
  module.exports = __webpack_exports__;
})();
