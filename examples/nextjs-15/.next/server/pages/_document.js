(() => {
  // webpackBootstrap
  'use strict';
  var __webpack_modules__ = {
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
      return __webpack_require__(5843);
    });
    __webpack_exports__ = __webpack_require__.O(__webpack_exports__);
    return __webpack_exports__;
  };

  /***/
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
    var installedChunks = { 547: 1 };
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
