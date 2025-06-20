(() => {
  // webpackBootstrap
  var __webpack_modules__ = {
    6693: function (module) {
      'use strict';
      module.exports = require('next/dist/compiled/next-server/app-page.runtime.dev.js');
    },
    209: function (module) {
      'use strict';
      module.exports = require('next/dist/server/app-render/action-async-storage.external.js');
    },
    5673: function (module) {
      'use strict';
      module.exports = require('next/dist/server/app-render/after-task-async-storage.external.js');
    },
    9348: function (module) {
      'use strict';
      module.exports = require('next/dist/server/app-render/work-async-storage.external.js');
    },
    412: function (module) {
      'use strict';
      module.exports = require('next/dist/server/app-render/work-unit-async-storage.external.js');
    },
    5315: function (module) {
      'use strict';
      module.exports = require('path');
    },
    945: function (__unused_webpack_module, __webpack_exports__, __webpack_require__) {
      'use strict';
      __webpack_require__.r(__webpack_exports__);
      __webpack_require__.d(__webpack_exports__, {
        GlobalError: () =>
          /* reexport default from dynamic */ next_dist_client_components_error_boundary__WEBPACK_IMPORTED_MODULE_2___default.a,
        __next_app__: () => __next_app__,
        pages: () => pages,
        routeModule: () => routeModule,
        tree: () => tree,
      });
      /* ESM import */ var next_dist_server_route_modules_app_page_module_compiled__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(4095);
      /* ESM import */ var next_dist_server_route_modules_app_page_module_compiled__WEBPACK_IMPORTED_MODULE_0___default =
        /*#__PURE__*/ __webpack_require__.n(
          next_dist_server_route_modules_app_page_module_compiled__WEBPACK_IMPORTED_MODULE_0__
        );
      /* ESM import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(2312);
      /* ESM import */ var next_dist_client_components_error_boundary__WEBPACK_IMPORTED_MODULE_2__ =
        __webpack_require__(1985);
      /* ESM import */ var next_dist_client_components_error_boundary__WEBPACK_IMPORTED_MODULE_2___default =
        /*#__PURE__*/ __webpack_require__.n(
          next_dist_client_components_error_boundary__WEBPACK_IMPORTED_MODULE_2__
        );
      /* ESM import */ var next_dist_server_app_render_entry_base__WEBPACK_IMPORTED_MODULE_3__ =
        __webpack_require__(6925);
      /* ESM import */ var next_dist_server_app_render_entry_base__WEBPACK_IMPORTED_MODULE_3___default =
        /*#__PURE__*/ __webpack_require__.n(
          next_dist_server_app_render_entry_base__WEBPACK_IMPORTED_MODULE_3__
        );

      /* ESM reexport (unknown) */ var __WEBPACK_REEXPORT_OBJECT__ = {};
      /* ESM reexport (unknown) */ for (var __WEBPACK_IMPORT_KEY__ in next_dist_server_app_render_entry_base__WEBPACK_IMPORTED_MODULE_3__)
        if (
          [
            'tree',
            '__next_app__',
            'default',
            'GlobalError',
            'routeModule',
            'pages',
          ].indexOf(__WEBPACK_IMPORT_KEY__) < 0
        )
          __WEBPACK_REEXPORT_OBJECT__[__WEBPACK_IMPORT_KEY__] = function (key) {
            return next_dist_server_app_render_entry_base__WEBPACK_IMPORTED_MODULE_3__[
              key
            ];
          }.bind(0, __WEBPACK_IMPORT_KEY__);
      /* ESM reexport (unknown) */ __webpack_require__.d(
        __webpack_exports__,
        __WEBPACK_REEXPORT_OBJECT__
      );
      const notFound0 = () =>
        Promise.resolve(/* import() eager */).then(
          __webpack_require__.t.bind(__webpack_require__, 2435, 23)
        );
      const module1 = () =>
        Promise.resolve(/* import() eager */).then(
          __webpack_require__.bind(__webpack_require__, 8483)
        );
      const module2 = () =>
        Promise.resolve(/* import() eager */).then(
          __webpack_require__.t.bind(__webpack_require__, 2435, 23)
        );
      const module3 = () =>
        Promise.resolve(/* import() eager */).then(
          __webpack_require__.t.bind(__webpack_require__, 6595, 23)
        );
      const module4 = () =>
        Promise.resolve(/* import() eager */).then(
          __webpack_require__.t.bind(__webpack_require__, 2621, 23)
        );

      // We inject the tree and pages here so that we can use them in the route
      // module.
      const tree = {
        children: [
          '',
          {
            children: [
              '/_not-found',
              {
                children: [
                  '__PAGE__',
                  {},
                  {
                    page: [notFound0, 'next/dist/client/components/not-found-error'],
                  },
                ],
              },
              {},
            ],
          },
          {
            layout: [
              module1,
              '/Users/lois/Documents/Github/work/repos/zephyr-packages/examples/nextjs-15/app/layout.tsx',
            ],
            'not-found': [module2, 'next/dist/client/components/not-found-error'],
            forbidden: [module3, 'next/dist/client/components/forbidden-error'],
            unauthorized: [module4, 'next/dist/client/components/unauthorized-error'],
          },
        ],
      }.children;
      const pages = [];

      const __next_app_require__ = __webpack_require__;
      const __next_app_load_chunk__ = () => Promise.resolve();
      const __next_app__ = {
        require: __next_app_require__,
        loadChunk: __next_app_load_chunk__,
      };

      // Create and export the route module that will be consumed.
      const routeModule =
        new next_dist_server_route_modules_app_page_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppPageRouteModule(
          {
            definition: {
              kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind
                .APP_PAGE,
              page: '/_not-found/page',
              pathname: '/_not-found',
              // The following aren't used in production.
              bundlePath: '',
              filename: '',
              appPaths: [],
            },
            userland: {
              loaderTree: tree,
            },
          }
        );

      //# sourceMappingURL=app-page.js.map
    },
    921: function (
      __unused_webpack_module,
      __unused_webpack_exports,
      __webpack_require__
    ) {
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 5940, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 2326, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 1985, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 1285, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 6662, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 7158, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 9967, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 147, 23)
      );
    },
    4084: function (
      __unused_webpack_module,
      __unused_webpack_exports,
      __webpack_require__
    ) {
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 8306, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 7210, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 5534, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 8419, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 1413, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 6604, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 6432, 23)
      );
      Promise.resolve(/* import() eager */).then(
        __webpack_require__.t.bind(__webpack_require__, 5783, 23)
      );
    },
    5943: function () {},
    6536: function () {},
    8483: function (__unused_webpack_module, __webpack_exports__, __webpack_require__) {
      'use strict';
      __webpack_require__.r(__webpack_exports__);
      __webpack_require__.d(__webpack_exports__, {
        default: () => RootLayout,
        metadata: () => metadata,
      });
      /* ESM import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(6493);
      /* ESM import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default =
        /*#__PURE__*/ __webpack_require__.n(
          react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__
        );

      const metadata = {
        title: 'With Rspack',
        description: 'Next.js example with rspack.',
      };
      function RootLayout({ children }) {
        return /*#__PURE__*/ (0,
        react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(
          'html',
          {
            lang: 'en',
            children: /*#__PURE__*/ (0,
            react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(
              'body',
              {
                children: children,
              },
              void 0,
              false,
              {
                fileName:
                  '/Users/lois/Documents/Github/work/repos/zephyr-packages/examples/nextjs-15/app/layout.tsx',
                lineNumber: 15,
                columnNumber: 7,
              },
              this
            ),
          },
          void 0,
          false,
          {
            fileName:
              '/Users/lois/Documents/Github/work/repos/zephyr-packages/examples/nextjs-15/app/layout.tsx',
            lineNumber: 14,
            columnNumber: 5,
          },
          this
        );
      }
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
      id: moduleId,
      loaded: false,
      exports: {},
    });
    // Execute the module function
    try {
      __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    } catch (e) {
      module.error = e;
      throw e;
    }
    // Flag the module as loaded
    module.loaded = true;
    // Return the exports of the module
    return module.exports;
  }

  // expose the modules object (__webpack_modules__)
  __webpack_require__.m = __webpack_modules__;

  // the startup function
  __webpack_require__.x = () => {
    // Load entry module and return exports
    // This entry module depends on other loaded chunks and execution need to be delayed
    var __webpack_exports__ = __webpack_require__.O(undefined, ['457'], function () {
      return __webpack_require__(945);
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
  // webpack/runtime/create_fake_namespace_object
  (() => {
    var getProto = Object.getPrototypeOf
      ? (obj) => Object.getPrototypeOf(obj)
      : (obj) => obj.__proto__;
    var leafPrototypes;
    // create a fake namespace object
    // mode & 1: value is a module id, require it
    // mode & 2: merge all properties of value into the ns
    // mode & 4: return value when already ns object
    // mode & 16: return value when it's Promise-like
    // mode & 8|1: behave like require
    __webpack_require__.t = function (value, mode) {
      if (mode & 1) value = this(value);
      if (mode & 8) return value;
      if (typeof value === 'object' && value) {
        if (mode & 4 && value.__esModule) return value;
        if (mode & 16 && typeof value.then === 'function') return value;
      }
      var ns = Object.create(null);
      __webpack_require__.r(ns);
      var def = {};
      leafPrototypes = leafPrototypes || [
        null,
        getProto({}),
        getProto([]),
        getProto(getProto),
      ];
      for (
        var current = mode & 2 && value;
        typeof current == 'object' && !~leafPrototypes.indexOf(current);
        current = getProto(current)
      ) {
        Object.getOwnPropertyNames(current).forEach((key) => {
          def[key] = () => value[key];
        });
      }
      def['default'] = () => value;
      __webpack_require__.d(ns, def);
      return ns;
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
  // webpack/runtime/get_full_hash
  (() => {
    __webpack_require__.h = () => '8155c0b519226f58';
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
  // webpack/runtime/node_module_decorator
  (() => {
    __webpack_require__.nmd = (module) => {
      module.paths = [];
      if (!module.children) module.children = [];
      return module;
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
      __webpack_require__.e('457');
      return next();
    };
  })();
  // webpack/runtime/require_chunk_loading
  (() => {
    var installedChunks = { 458: 1 };
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
          installChunk(require('../../chunks/' + __webpack_require__.u(chunkId)));
        } else installedChunks[chunkId] = 1;
      }
    };
  })();
  /***/
  // run startup
  var __webpack_exports__ = __webpack_require__.x();
  module.exports = __webpack_exports__;
})();
