'use strict';
exports.ids = ['170'];
exports.modules = {
  8137: function (module, __unused_webpack_exports, __webpack_require__) {
    module.exports =
      __webpack_require__(5057) /* .vendored["react-ssr"].ReactJsxDevRuntime */.vendored[
        'react-ssr'
      ].ReactJsxDevRuntime;

    //# sourceMappingURL=react-jsx-dev-runtime.js.map
  },
  4097: function (__unused_webpack_module, exports, __webpack_require__) {
    var __webpack_unused_export__;
    /* eslint-disable import/no-extraneous-dependencies */
    __webpack_unused_export__ = {
      value: true,
    };
    Object.defineProperty(exports, 'registerServerReference', {
      enumerable: true,
      get: function () {
        return _serveredge.registerServerReference;
      },
    });
    const _serveredge = __webpack_require__(7322);

    //# sourceMappingURL=server-reference.js.map
  },
  6220: function (__unused_webpack_module, exports, __webpack_require__) {
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
      arrayBufferToString: function () {
        return arrayBufferToString;
      },
      decrypt: function () {
        return decrypt;
      },
      encrypt: function () {
        return encrypt;
      },
      getActionEncryptionKey: function () {
        return getActionEncryptionKey;
      },
      getClientReferenceManifestForRsc: function () {
        return getClientReferenceManifestForRsc;
      },
      getServerModuleMap: function () {
        return getServerModuleMap;
      },
      setReferenceManifestsSingleton: function () {
        return setReferenceManifestsSingleton;
      },
      stringToUint8Array: function () {
        return stringToUint8Array;
      },
    });
    const _invarianterror = __webpack_require__(9288);
    const _apppaths = __webpack_require__(189);
    const _workasyncstorageexternal = __webpack_require__(9348);
    let __next_loaded_action_key;
    function arrayBufferToString(buffer) {
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      // @anonrig: V8 has a limit of 65535 arguments in a function.
      // For len < 65535, this is faster.
      // https://github.com/vercel/next.js/pull/56377#pullrequestreview-1656181623
      if (len < 65535) {
        return String.fromCharCode.apply(null, bytes);
      }
      let binary = '';
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return binary;
    }
    function stringToUint8Array(binary) {
      const len = binary.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        arr[i] = binary.charCodeAt(i);
      }
      return arr;
    }
    function encrypt(key, iv, data) {
      return crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        key,
        data
      );
    }
    function decrypt(key, iv, data) {
      return crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        key,
        data
      );
    }
    // This is a global singleton that is used to encode/decode the action bound args from
    // the closure. This can't be using a AsyncLocalStorage as it might happen on the module
    // level. Since the client reference manifest won't be mutated, let's use a global singleton
    // to keep it.
    const SERVER_ACTION_MANIFESTS_SINGLETON = Symbol.for('next.server.action-manifests');
    function setReferenceManifestsSingleton({
      page,
      clientReferenceManifest,
      serverActionsManifest,
      serverModuleMap,
    }) {
      var _globalThis_SERVER_ACTION_MANIFESTS_SINGLETON;
      // @ts-expect-error
      const clientReferenceManifestsPerPage =
        (_globalThis_SERVER_ACTION_MANIFESTS_SINGLETON =
          globalThis[SERVER_ACTION_MANIFESTS_SINGLETON]) == null
          ? void 0
          : _globalThis_SERVER_ACTION_MANIFESTS_SINGLETON.clientReferenceManifestsPerPage;
      // @ts-expect-error
      globalThis[SERVER_ACTION_MANIFESTS_SINGLETON] = {
        clientReferenceManifestsPerPage: {
          ...clientReferenceManifestsPerPage,
          [(0, _apppaths.normalizeAppPath)(page)]: clientReferenceManifest,
        },
        serverActionsManifest,
        serverModuleMap,
      };
    }
    function getServerModuleMap() {
      const serverActionsManifestSingleton =
        globalThis[SERVER_ACTION_MANIFESTS_SINGLETON];
      if (!serverActionsManifestSingleton) {
        throw Object.defineProperty(
          new _invarianterror.InvariantError('Missing manifest for Server Actions.'),
          '__NEXT_ERROR_CODE',
          {
            value: 'E606',
            enumerable: false,
            configurable: true,
          }
        );
      }
      return serverActionsManifestSingleton.serverModuleMap;
    }
    function getClientReferenceManifestForRsc() {
      const serverActionsManifestSingleton =
        globalThis[SERVER_ACTION_MANIFESTS_SINGLETON];
      if (!serverActionsManifestSingleton) {
        throw Object.defineProperty(
          new _invarianterror.InvariantError('Missing manifest for Server Actions.'),
          '__NEXT_ERROR_CODE',
          {
            value: 'E606',
            enumerable: false,
            configurable: true,
          }
        );
      }
      const { clientReferenceManifestsPerPage } = serverActionsManifestSingleton;
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      if (!workStore) {
        // If there's no work store defined, we can assume that a client reference
        // manifest is needed during module evaluation, e.g. to create a server
        // action using a higher-order function. This might also use client
        // components which need to be serialized by Flight, and therefore client
        // references need to be resolvable. To make this work, we're returning a
        // merged manifest across all pages. This is fine as long as the module IDs
        // are not page specific, which they are not for Webpack. TODO: Fix this in
        // Turbopack.
        return mergeClientReferenceManifests(clientReferenceManifestsPerPage);
      }
      const clientReferenceManifest = clientReferenceManifestsPerPage[workStore.route];
      if (!clientReferenceManifest) {
        throw Object.defineProperty(
          new _invarianterror.InvariantError(
            `Missing Client Reference Manifest for ${workStore.route}.`
          ),
          '__NEXT_ERROR_CODE',
          {
            value: 'E570',
            enumerable: false,
            configurable: true,
          }
        );
      }
      return clientReferenceManifest;
    }
    async function getActionEncryptionKey() {
      if (__next_loaded_action_key) {
        return __next_loaded_action_key;
      }
      const serverActionsManifestSingleton =
        globalThis[SERVER_ACTION_MANIFESTS_SINGLETON];
      if (!serverActionsManifestSingleton) {
        throw Object.defineProperty(
          new _invarianterror.InvariantError('Missing manifest for Server Actions.'),
          '__NEXT_ERROR_CODE',
          {
            value: 'E606',
            enumerable: false,
            configurable: true,
          }
        );
      }
      const rawKey =
        process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ||
        serverActionsManifestSingleton.serverActionsManifest.encryptionKey;
      if (rawKey === undefined) {
        throw Object.defineProperty(
          new _invarianterror.InvariantError('Missing encryption key for Server Actions'),
          '__NEXT_ERROR_CODE',
          {
            value: 'E571',
            enumerable: false,
            configurable: true,
          }
        );
      }
      __next_loaded_action_key = await crypto.subtle.importKey(
        'raw',
        stringToUint8Array(atob(rawKey)),
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
      );
      return __next_loaded_action_key;
    }
    function mergeClientReferenceManifests(clientReferenceManifestsPerPage) {
      const clientReferenceManifests = Object.values(clientReferenceManifestsPerPage);
      const mergedClientReferenceManifest = {
        clientModules: {},
        edgeRscModuleMapping: {},
        rscModuleMapping: {},
      };
      for (const clientReferenceManifest of clientReferenceManifests) {
        mergedClientReferenceManifest.clientModules = {
          ...mergedClientReferenceManifest.clientModules,
          ...clientReferenceManifest.clientModules,
        };
        mergedClientReferenceManifest.edgeRscModuleMapping = {
          ...mergedClientReferenceManifest.edgeRscModuleMapping,
          ...clientReferenceManifest.edgeRscModuleMapping,
        };
        mergedClientReferenceManifest.rscModuleMapping = {
          ...mergedClientReferenceManifest.rscModuleMapping,
          ...clientReferenceManifest.rscModuleMapping,
        };
      }
      return mergedClientReferenceManifest;
    } //# sourceMappingURL=encryption-utils.js.map
  },
  7896: function (__unused_webpack_module, exports, __webpack_require__) {
    /* eslint-disable import/no-extraneous-dependencies */
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
      decryptActionBoundArgs: function () {
        return decryptActionBoundArgs;
      },
      encryptActionBoundArgs: function () {
        return encryptActionBoundArgs;
      },
    });
    __webpack_require__(5760);
    const _serveredge = __webpack_require__(7322);
    const _clientedge = __webpack_require__(4999);
    const _nodewebstreamshelper = __webpack_require__(227);
    const _encryptionutils = __webpack_require__(6220);
    const _workunitasyncstorageexternal = __webpack_require__(412);
    const _dynamicrendering = __webpack_require__(7811);
    const _react = /*#__PURE__*/ _interop_require_default(__webpack_require__(8516));
    function _interop_require_default(obj) {
      return obj && obj.__esModule
        ? obj
        : {
            default: obj,
          };
    }
    const isEdgeRuntime = 'nodejs' === 'edge';
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    /** Decrypt the serialized string with the action id as the salt. */ async function decodeActionBoundArg(
      actionId,
      arg
    ) {
      const key = await (0, _encryptionutils.getActionEncryptionKey)();
      if (typeof key === 'undefined') {
        throw Object.defineProperty(
          new Error(`Missing encryption key for Server Action. This is a bug in Next.js`),
          '__NEXT_ERROR_CODE',
          {
            value: 'E65',
            enumerable: false,
            configurable: true,
          }
        );
      }
      // Get the iv (16 bytes) and the payload from the arg.
      const originalPayload = atob(arg);
      const ivValue = originalPayload.slice(0, 16);
      const payload = originalPayload.slice(16);
      const decrypted = textDecoder.decode(
        await (0, _encryptionutils.decrypt)(
          key,
          (0, _encryptionutils.stringToUint8Array)(ivValue),
          (0, _encryptionutils.stringToUint8Array)(payload)
        )
      );
      if (!decrypted.startsWith(actionId)) {
        throw Object.defineProperty(
          new Error('Invalid Server Action payload: failed to decrypt.'),
          '__NEXT_ERROR_CODE',
          {
            value: 'E191',
            enumerable: false,
            configurable: true,
          }
        );
      }
      return decrypted.slice(actionId.length);
    }
    /**
     * Encrypt the serialized string with the action id as the salt. Add a prefix to later
     * ensure that the payload is correctly decrypted, similar to a checksum.
     */ async function encodeActionBoundArg(actionId, arg) {
      const key = await (0, _encryptionutils.getActionEncryptionKey)();
      if (key === undefined) {
        throw Object.defineProperty(
          new Error(`Missing encryption key for Server Action. This is a bug in Next.js`),
          '__NEXT_ERROR_CODE',
          {
            value: 'E65',
            enumerable: false,
            configurable: true,
          }
        );
      }
      // Get 16 random bytes as iv.
      const randomBytes = new Uint8Array(16);
      _workunitasyncstorageexternal.workUnitAsyncStorage.exit(() =>
        crypto.getRandomValues(randomBytes)
      );
      const ivValue = (0, _encryptionutils.arrayBufferToString)(randomBytes.buffer);
      const encrypted = await (0, _encryptionutils.encrypt)(
        key,
        randomBytes,
        textEncoder.encode(actionId + arg)
      );
      return btoa(ivValue + (0, _encryptionutils.arrayBufferToString)(encrypted));
    }
    const encryptActionBoundArgs = _react.default.cache(
      async function encryptActionBoundArgs(actionId, ...args) {
        const { clientModules } = (0,
        _encryptionutils.getClientReferenceManifestForRsc)();
        // Create an error before any asynchronous calls, to capture the original
        // call stack in case we need it when the serialization errors.
        const error = new Error();
        Error.captureStackTrace(error, encryptActionBoundArgs);
        let didCatchError = false;
        const workUnitStore =
          _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
        const hangingInputAbortSignal =
          (workUnitStore == null ? void 0 : workUnitStore.type) === 'prerender'
            ? (0, _dynamicrendering.createHangingInputAbortSignal)(workUnitStore)
            : undefined;
        // Using Flight to serialize the args into a string.
        const serialized = await (0, _nodewebstreamshelper.streamToString)(
          (0, _serveredge.renderToReadableStream)(args, clientModules, {
            signal: hangingInputAbortSignal,
            onError(err) {
              if (
                hangingInputAbortSignal == null ? void 0 : hangingInputAbortSignal.aborted
              ) {
                return;
              }
              // We're only reporting one error at a time, starting with the first.
              if (didCatchError) {
                return;
              }
              didCatchError = true;
              // Use the original error message together with the previously created
              // stack, because err.stack is a useless Flight Server call stack.
              error.message = err instanceof Error ? err.message : String(err);
            },
          }), // We pass the abort signal to `streamToString` so that no chunks are
          // included that are emitted after the signal was already aborted. This
          // ensures that we can encode hanging promises.
          hangingInputAbortSignal
        );
        if (didCatchError) {
          if (true) {
            // Logging the error is needed for server functions that are passed to the
            // client where the decryption is not done during rendering. Console
            // replaying allows us to still show the error dev overlay in this case.
            console.error(error);
          }
          throw error;
        }
        if (!workUnitStore) {
          return encodeActionBoundArg(actionId, serialized);
        }
        const prerenderResumeDataCache = (0,
        _workunitasyncstorageexternal.getPrerenderResumeDataCache)(workUnitStore);
        const renderResumeDataCache = (0,
        _workunitasyncstorageexternal.getRenderResumeDataCache)(workUnitStore);
        const cacheKey = actionId + serialized;
        const cachedEncrypted =
          (prerenderResumeDataCache == null
            ? void 0
            : prerenderResumeDataCache.encryptedBoundArgs.get(cacheKey)) ??
          (renderResumeDataCache == null
            ? void 0
            : renderResumeDataCache.encryptedBoundArgs.get(cacheKey));
        if (cachedEncrypted) {
          return cachedEncrypted;
        }
        const cacheSignal =
          workUnitStore.type === 'prerender' ? workUnitStore.cacheSignal : undefined;
        cacheSignal == null ? void 0 : cacheSignal.beginRead();
        const encrypted = await encodeActionBoundArg(actionId, serialized);
        cacheSignal == null ? void 0 : cacheSignal.endRead();
        prerenderResumeDataCache == null
          ? void 0
          : prerenderResumeDataCache.encryptedBoundArgs.set(cacheKey, encrypted);
        return encrypted;
      }
    );
    async function decryptActionBoundArgs(actionId, encryptedPromise) {
      const encrypted = await encryptedPromise;
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      let decrypted;
      if (workUnitStore) {
        const cacheSignal =
          workUnitStore.type === 'prerender' ? workUnitStore.cacheSignal : undefined;
        const prerenderResumeDataCache = (0,
        _workunitasyncstorageexternal.getPrerenderResumeDataCache)(workUnitStore);
        const renderResumeDataCache = (0,
        _workunitasyncstorageexternal.getRenderResumeDataCache)(workUnitStore);
        decrypted =
          (prerenderResumeDataCache == null
            ? void 0
            : prerenderResumeDataCache.decryptedBoundArgs.get(encrypted)) ??
          (renderResumeDataCache == null
            ? void 0
            : renderResumeDataCache.decryptedBoundArgs.get(encrypted));
        if (!decrypted) {
          cacheSignal == null ? void 0 : cacheSignal.beginRead();
          decrypted = await decodeActionBoundArg(actionId, encrypted);
          cacheSignal == null ? void 0 : cacheSignal.endRead();
          prerenderResumeDataCache == null
            ? void 0
            : prerenderResumeDataCache.decryptedBoundArgs.set(encrypted, decrypted);
        }
      } else {
        decrypted = await decodeActionBoundArg(actionId, encrypted);
      }
      const { edgeRscModuleMapping, rscModuleMapping } = (0,
      _encryptionutils.getClientReferenceManifestForRsc)();
      // Using Flight to deserialize the args from the string.
      const deserialized = await (0, _clientedge.createFromReadableStream)(
        new ReadableStream({
          start(controller) {
            controller.enqueue(textEncoder.encode(decrypted));
            if ((workUnitStore == null ? void 0 : workUnitStore.type) === 'prerender') {
              // Explicitly don't close the stream here (until prerendering is
              // complete) so that hanging promises are not rejected.
              if (workUnitStore.renderSignal.aborted) {
                controller.close();
              } else {
                workUnitStore.renderSignal.addEventListener(
                  'abort',
                  () => controller.close(),
                  {
                    once: true,
                  }
                );
              }
            } else {
              controller.close();
            }
          },
        }),
        {
          serverConsumerManifest: {
            // moduleLoading must be null because we don't want to trigger preloads of ClientReferences
            // to be added to the current execution. Instead, we'll wait for any ClientReference
            // to be emitted which themselves will handle the preloading.
            moduleLoading: null,
            moduleMap: isEdgeRuntime ? edgeRscModuleMapping : rscModuleMapping,
            serverModuleMap: (0, _encryptionutils.getServerModuleMap)(),
          },
        }
      );
      return deserialized;
    }

    //# sourceMappingURL=encryption.js.map
  },
  1008: function (__unused_webpack_module, exports) {
    /**
     * For a given page path, this function ensures that there is a leading slash. If
     * there is not a leading slash, one is added, otherwise it is noop.
     */
    Object.defineProperty(exports, '__esModule', {
      value: true,
    });
    Object.defineProperty(exports, 'ensureLeadingSlash', {
      enumerable: true,
      get: function () {
        return ensureLeadingSlash;
      },
    });
    function ensureLeadingSlash(path) {
      return path.startsWith('/') ? path : '/' + path;
    } //# sourceMappingURL=ensure-leading-slash.js.map
  },
  189: function (__unused_webpack_module, exports, __webpack_require__) {
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
      normalizeAppPath: function () {
        return normalizeAppPath;
      },
      normalizeRscURL: function () {
        return normalizeRscURL;
      },
    });
    const _ensureleadingslash = __webpack_require__(1008);
    const _segment = __webpack_require__(7099);
    function normalizeAppPath(route) {
      return (0, _ensureleadingslash.ensureLeadingSlash)(
        route.split('/').reduce((pathname, segment, index, segments) => {
          // Empty segments are ignored.
          if (!segment) {
            return pathname;
          }
          // Groups are ignored.
          if ((0, _segment.isGroupSegment)(segment)) {
            return pathname;
          }
          // Parallel segments are ignored.
          if (segment[0] === '@') {
            return pathname;
          }
          // The last segment (if it's a leaf) should be ignored.
          if (
            (segment === 'page' || segment === 'route') &&
            index === segments.length - 1
          ) {
            return pathname;
          }
          return pathname + '/' + segment;
        }, '')
      );
    }
    function normalizeRscURL(url) {
      return url.replace(/\.rsc($|\?)/, '$1');
    } //# sourceMappingURL=app-paths.js.map
  },
};
