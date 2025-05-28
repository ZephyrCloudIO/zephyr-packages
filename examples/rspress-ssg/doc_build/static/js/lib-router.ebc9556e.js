/*! For license information please see lib-router.ebc9556e.js.LICENSE.txt */
'use strict';
(self.webpackChunkrspress_ssg = self.webpackChunkrspress_ssg || []).push([
  ['118'],
  {
    5231: function (e, t, r) {
      var a, n, i, o;
      function l() {
        return (l = Object.assign
          ? Object.assign.bind()
          : function (e) {
              for (var t = 1; t < arguments.length; t++) {
                var r = arguments[t];
                for (var a in r)
                  Object.prototype.hasOwnProperty.call(r, a) && (e[a] = r[a]);
              }
              return e;
            }).apply(this, arguments);
      }
      r.d(t, {
        J0: () => c,
        LX: () => b,
        RQ: () => x,
        X3: () => _,
        Zn: () => R,
        aU: () => a,
        cP: () => v,
        cm: () => w,
        fp: () => m,
        lX: () => u,
        pC: () => P,
      }),
        ((i = a || (a = {})).Pop = 'POP'),
        (i.Push = 'PUSH'),
        (i.Replace = 'REPLACE');
      let s = 'popstate';
      function u(e) {
        return (
          void 0 === e && (e = {}),
          (function (e, t, r, n) {
            void 0 === n && (n = {});
            let { window: i = document.defaultView, v5Compat: o = !1 } = n,
              u = i.history,
              h = a.Pop,
              v = null,
              m = g();
            function g() {
              return (u.state || { idx: null }).idx;
            }
            function y() {
              h = a.Pop;
              let e = g(),
                t = null == e ? null : e - m;
              (m = e), v && v({ action: h, location: R.location, delta: t });
            }
            function b(e) {
              let t = 'null' !== i.location.origin ? i.location.origin : i.location.href,
                r = 'string' == typeof e ? e : f(e);
              return (
                c(
                  t,
                  'No window.location.(origin|href) available to create URL for href: ' +
                    (r = r.replace(/ $/, '%20'))
                ),
                new URL(r, t)
              );
            }
            null == m && ((m = 0), u.replaceState(l({}, u.state, { idx: m }), ''));
            let R = {
              get action() {
                return h;
              },
              get location() {
                return e(i, u);
              },
              listen(e) {
                if (v) throw Error('A history only accepts one active listener');
                return (
                  i.addEventListener(s, y),
                  (v = e),
                  () => {
                    i.removeEventListener(s, y), (v = null);
                  }
                );
              },
              createHref: (e) => t(i, e),
              createURL: b,
              encodeLocation(e) {
                let t = b(e);
                return { pathname: t.pathname, search: t.search, hash: t.hash };
              },
              push: function (e, t) {
                h = a.Push;
                let r = d(R.location, e, t),
                  n = p(r, (m = g() + 1)),
                  l = R.createHref(r);
                try {
                  u.pushState(n, '', l);
                } catch (e) {
                  if (e instanceof DOMException && 'DataCloneError' === e.name) throw e;
                  i.location.assign(l);
                }
                o && v && v({ action: h, location: R.location, delta: 1 });
              },
              replace: function (e, t) {
                h = a.Replace;
                let n = d(R.location, e, t);
                r && r(n, e);
                let i = p(n, (m = g())),
                  l = R.createHref(n);
                u.replaceState(i, '', l),
                  o && v && v({ action: h, location: R.location, delta: 0 });
              },
              go: (e) => u.go(e),
            };
            return R;
          })(
            function (e, t) {
              let { pathname: r, search: a, hash: n } = e.location;
              return d(
                '',
                { pathname: r, search: a, hash: n },
                (t.state && t.state.usr) || null,
                (t.state && t.state.key) || 'default'
              );
            },
            function (e, t) {
              return 'string' == typeof t ? t : f(t);
            },
            null,
            e
          )
        );
      }
      function c(e, t) {
        if (!1 === e || null == e) throw Error(t);
      }
      function h(e, t) {
        if (!e) {
          'undefined' != typeof console && console.warn(t);
          try {
            throw Error(t);
          } catch (e) {}
        }
      }
      function p(e, t) {
        return { usr: e.state, key: e.key, idx: t };
      }
      function d(e, t, r, a) {
        return (
          void 0 === r && (r = null),
          l(
            { pathname: 'string' == typeof e ? e : e.pathname, search: '', hash: '' },
            'string' == typeof t ? v(t) : t,
            {
              state: r,
              key: (t && t.key) || a || Math.random().toString(36).substr(2, 8),
            }
          )
        );
      }
      function f(e) {
        let { pathname: t = '/', search: r = '', hash: a = '' } = e;
        return (
          r && '?' !== r && (t += '?' === r.charAt(0) ? r : '?' + r),
          a && '#' !== a && (t += '#' === a.charAt(0) ? a : '#' + a),
          t
        );
      }
      function v(e) {
        let t = {};
        if (e) {
          let r = e.indexOf('#');
          r >= 0 && ((t.hash = e.substr(r)), (e = e.substr(0, r)));
          let a = e.indexOf('?');
          a >= 0 && ((t.search = e.substr(a)), (e = e.substr(0, a))),
            e && (t.pathname = e);
        }
        return t;
      }
      function m(e, t, r) {
        return (
          void 0 === r && (r = '/'),
          (function (e, t, r, a) {
            let n = R(('string' == typeof t ? v(t) : t).pathname || '/', r);
            if (null == n) return null;
            let i = (function e(t, r, a, n) {
              void 0 === r && (r = []),
                void 0 === a && (a = []),
                void 0 === n && (n = '');
              let i = (t, i, o) => {
                let l = {
                  relativePath: void 0 === o ? t.path || '' : o,
                  caseSensitive: !0 === t.caseSensitive,
                  childrenIndex: i,
                  route: t,
                };
                l.relativePath.startsWith('/') &&
                  (c(
                    l.relativePath.startsWith(n),
                    'Absolute route path "' +
                      l.relativePath +
                      '" nested under path "' +
                      n +
                      '" is not valid. An absolute child route path must start with the combined path of all its parent routes.'
                  ),
                  (l.relativePath = l.relativePath.slice(n.length)));
                let s = x([n, l.relativePath]),
                  u = a.concat(l);
                if (
                  (t.children &&
                    t.children.length > 0 &&
                    (c(
                      !0 !== t.index,
                      'Index routes must not have child routes. Please remove all child routes from route path "' +
                        s +
                        '".'
                    ),
                    e(t.children, r, u, s)),
                  null != t.path || t.index)
                ) {
                  var h, p;
                  let e, a;
                  r.push({
                    path: s,
                    score:
                      ((h = s),
                      (p = t.index),
                      (a = (e = h.split('/')).length),
                      e.some(y) && (a += -2),
                      p && (a += 2),
                      e
                        .filter((e) => !y(e))
                        .reduce((e, t) => e + (g.test(t) ? 3 : '' === t ? 1 : 10), a)),
                    routesMeta: u,
                  });
                }
              };
              return (
                t.forEach((e, t) => {
                  var r;
                  if ('' !== e.path && null != (r = e.path) && r.includes('?'))
                    for (let r of (function e(t) {
                      let r = t.split('/');
                      if (0 === r.length) return [];
                      let [a, ...n] = r,
                        i = a.endsWith('?'),
                        o = a.replace(/\?$/, '');
                      if (0 === n.length) return i ? [o, ''] : [o];
                      let l = e(n.join('/')),
                        s = [];
                      return (
                        s.push(...l.map((e) => ('' === e ? o : [o, e].join('/')))),
                        i && s.push(...l),
                        s.map((e) => (t.startsWith('/') && '' === e ? '/' : e))
                      );
                    })(e.path))
                      i(e, t, r);
                  else i(e, t);
                }),
                r
              );
            })(e);
            (function (e) {
              e.sort((e, t) => {
                var r, a;
                return e.score !== t.score
                  ? t.score - e.score
                  : ((r = e.routesMeta.map((e) => e.childrenIndex)),
                    (a = t.routesMeta.map((e) => e.childrenIndex)),
                    r.length === a.length && r.slice(0, -1).every((e, t) => e === a[t])
                      ? r[r.length - 1] - a[a.length - 1]
                      : 0);
              });
            })(i);
            let o = null;
            for (let e = 0; null == o && e < i.length; ++e) {
              let t = (function (e) {
                try {
                  return e
                    .split('/')
                    .map((e) => decodeURIComponent(e).replace(/\//g, '%2F'))
                    .join('/');
                } catch (t) {
                  return (
                    h(
                      !1,
                      'The URL path "' +
                        e +
                        '" could not be decoded because it is is a malformed URL segment. This is probably due to a bad percent encoding (' +
                        t +
                        ').'
                    ),
                    e
                  );
                }
              })(n);
              o = (function (e, t, r) {
                void 0 === r && (r = !1);
                let { routesMeta: a } = e,
                  n = {},
                  i = '/',
                  o = [];
                for (let e = 0; e < a.length; ++e) {
                  let l = a[e],
                    s = e === a.length - 1,
                    u = '/' === i ? t : t.slice(i.length) || '/',
                    c = b(
                      { path: l.relativePath, caseSensitive: l.caseSensitive, end: s },
                      u
                    ),
                    h = l.route;
                  if (
                    (!c &&
                      s &&
                      r &&
                      !a[a.length - 1].route.index &&
                      (c = b(
                        { path: l.relativePath, caseSensitive: l.caseSensitive, end: !1 },
                        u
                      )),
                    !c)
                  )
                    return null;
                  Object.assign(n, c.params),
                    o.push({
                      params: n,
                      pathname: x([i, c.pathname]),
                      pathnameBase: U(x([i, c.pathnameBase])),
                      route: h,
                    }),
                    '/' !== c.pathnameBase && (i = x([i, c.pathnameBase]));
                }
                return o;
              })(i[e], t, a);
            }
            return o;
          })(e, t, r, !1)
        );
      }
      ((o = n || (n = {})).data = 'data'),
        (o.deferred = 'deferred'),
        (o.redirect = 'redirect'),
        (o.error = 'error');
      let g = /^:[\w-]+$/,
        y = (e) => '*' === e;
      function b(e, t) {
        var r, a, n;
        let i, o;
        'string' == typeof e && (e = { path: e, caseSensitive: !1, end: !0 });
        let [l, s] =
            ((r = e.path),
            (a = e.caseSensitive),
            (n = e.end),
            void 0 === a && (a = !1),
            void 0 === n && (n = !0),
            h(
              '*' === r || !r.endsWith('*') || r.endsWith('/*'),
              'Route path "' +
                r +
                '" will be treated as if it were "' +
                r.replace(/\*$/, '/*') +
                '" because the `*` character must always follow a `/` in the pattern. To get rid of this warning, please change the route path to "' +
                r.replace(/\*$/, '/*') +
                '".'
            ),
            (i = []),
            (o =
              '^' +
              r
                .replace(/\/*\*?$/, '')
                .replace(/^\/*/, '/')
                .replace(/[\\.*+^${}|()[\]]/g, '\\$&')
                .replace(
                  /\/:([\w-]+)(\?)?/g,
                  (e, t, r) => (
                    i.push({ paramName: t, isOptional: null != r }),
                    r ? '/?([^\\/]+)?' : '/([^\\/]+)'
                  )
                )),
            r.endsWith('*')
              ? (i.push({ paramName: '*' }),
                (o += '*' === r || '/*' === r ? '(.*)$' : '(?:\\/(.+)|\\/*)$'))
              : n
                ? (o += '\\/*$')
                : '' !== r && '/' !== r && (o += '(?:(?=\\/|$))'),
            [new RegExp(o, a ? void 0 : 'i'), i]),
          u = t.match(l);
        if (!u) return null;
        let c = u[0],
          p = c.replace(/(.)\/+$/, '$1'),
          d = u.slice(1);
        return {
          params: s.reduce((e, t, r) => {
            let { paramName: a, isOptional: n } = t;
            if ('*' === a) {
              let e = d[r] || '';
              p = c.slice(0, c.length - e.length).replace(/(.)\/+$/, '$1');
            }
            let i = d[r];
            return n && !i ? (e[a] = void 0) : (e[a] = (i || '').replace(/%2F/g, '/')), e;
          }, {}),
          pathname: c,
          pathnameBase: p,
          pattern: e,
        };
      }
      function R(e, t) {
        if ('/' === t) return e;
        if (!e.toLowerCase().startsWith(t.toLowerCase())) return null;
        let r = t.endsWith('/') ? t.length - 1 : t.length,
          a = e.charAt(r);
        return a && '/' !== a ? null : e.slice(r) || '/';
      }
      function S(e, t, r, a) {
        return (
          "Cannot include a '" +
          e +
          "' character in a manually specified " +
          ('`to.' + t + '` field [') +
          JSON.stringify(a) +
          '].  Please separate it out to the `to.' +
          r +
          '` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.'
        );
      }
      function w(e, t) {
        let r = e.filter((e, t) => 0 === t || (e.route.path && e.route.path.length > 0));
        return t
          ? r.map((e, t) => (t === r.length - 1 ? e.pathname : e.pathnameBase))
          : r.map((e) => e.pathnameBase);
      }
      function P(e, t, r, a) {
        let n, i;
        void 0 === a && (a = !1),
          'string' == typeof e
            ? (n = v(e))
            : (c(
                !(n = l({}, e)).pathname || !n.pathname.includes('?'),
                S('?', 'pathname', 'search', n)
              ),
              c(!n.pathname || !n.pathname.includes('#'), S('#', 'pathname', 'hash', n)),
              c(!n.search || !n.search.includes('#'), S('#', 'search', 'hash', n)));
        let o = '' === e || '' === n.pathname,
          s = o ? '/' : n.pathname;
        if (null == s) i = r;
        else {
          let e = t.length - 1;
          if (!a && s.startsWith('..')) {
            let t = s.split('/');
            for (; '..' === t[0]; ) t.shift(), (e -= 1);
            n.pathname = t.join('/');
          }
          i = e >= 0 ? t[e] : '/';
        }
        let u = (function (e, t) {
            var r;
            let a;
            void 0 === t && (t = '/');
            let {
              pathname: n,
              search: i = '',
              hash: o = '',
            } = 'string' == typeof e ? v(e) : e;
            return {
              pathname: n
                ? n.startsWith('/')
                  ? n
                  : ((r = n),
                    (a = t.replace(/\/+$/, '').split('/')),
                    r.split('/').forEach((e) => {
                      '..' === e ? a.length > 1 && a.pop() : '.' !== e && a.push(e);
                    }),
                    a.length > 1 ? a.join('/') : '/')
                : t,
              search: C(i),
              hash: E(o),
            };
          })(n, i),
          h = s && '/' !== s && s.endsWith('/'),
          p = (o || '.' === s) && r.endsWith('/');
        return !u.pathname.endsWith('/') && (h || p) && (u.pathname += '/'), u;
      }
      let x = (e) => e.join('/').replace(/\/\/+/g, '/'),
        U = (e) => e.replace(/\/+$/, '').replace(/^\/*/, '/'),
        C = (e) => (e && '?' !== e ? (e.startsWith('?') ? e : '?' + e) : ''),
        E = (e) => (e && '#' !== e ? (e.startsWith('#') ? e : '#' + e) : '');
      class _ extends Error {}
      Symbol('deferred');
    },
    5598: function (e, t, r) {
      r.d(t, { VK: () => v, lr: () => m });
      var a,
        n,
        i,
        o,
        l,
        s,
        u = r(4194),
        c = r(6321),
        h = r(8125),
        p = r(5231);
      function d(e) {
        return (
          void 0 === e && (e = ''),
          new URLSearchParams(
            'string' == typeof e || Array.isArray(e) || e instanceof URLSearchParams
              ? e
              : Object.keys(e).reduce((t, r) => {
                  let a = e[r];
                  return t.concat(Array.isArray(a) ? a.map((e) => [r, e]) : [[r, a]]);
                }, [])
          )
        );
      }
      try {
        window.__reactRouterVersion = '6';
      } catch (e) {}
      let f = (i || (i = r.t(u, 2))).startTransition;
      function v(e) {
        let { basename: t, children: r, future: a, window: n } = e,
          i = u.useRef();
        null == i.current && (i.current = (0, p.lX)({ window: n, v5Compat: !0 }));
        let o = i.current,
          [l, s] = u.useState({ action: o.action, location: o.location }),
          { v7_startTransition: c } = a || {},
          d = u.useCallback(
            (e) => {
              c && f ? f(() => s(e)) : s(e);
            },
            [s, c]
          );
        return (
          u.useLayoutEffect(() => o.listen(d), [o, d]),
          u.useEffect(() => (0, h.$A)(a), [a]),
          u.createElement(h.F0, {
            basename: t,
            children: r,
            location: l.location,
            navigationType: l.action,
            navigator: o,
            future: a,
          })
        );
      }
      function m(e) {
        let t = u.useRef(d(e)),
          r = u.useRef(!1),
          a = (0, h.TH)(),
          n = u.useMemo(() => {
            var e, n;
            let i;
            return (
              (e = a.search),
              (n = r.current ? null : t.current),
              (i = d(e)),
              n &&
                n.forEach((e, t) => {
                  i.has(t) ||
                    n.getAll(t).forEach((e) => {
                      i.append(t, e);
                    });
                }),
              i
            );
          }, [a.search]),
          i = (0, h.s0)(),
          o = u.useCallback(
            (e, t) => {
              let a = d('function' == typeof e ? e(n) : e);
              (r.current = !0), i('?' + a, t);
            },
            [i, n]
          );
        return [n, o];
      }
      (o || (o = r.t(c, 2))).flushSync,
        (i || (i = r.t(u, 2))).useId,
        'undefined' != typeof window &&
          void 0 !== window.document &&
          window.document.createElement,
        ((a = l || (l = {})).UseScrollRestoration = 'useScrollRestoration'),
        (a.UseSubmit = 'useSubmit'),
        (a.UseSubmitFetcher = 'useSubmitFetcher'),
        (a.UseFetcher = 'useFetcher'),
        (a.useViewTransitionState = 'useViewTransitionState'),
        ((n = s || (s = {})).UseFetcher = 'useFetcher'),
        (n.UseFetchers = 'useFetchers'),
        (n.UseScrollRestoration = 'useScrollRestoration');
    },
    8125: function (e, t, r) {
      r.d(t, { $A: () => S, F0: () => w, TH: () => v, s0: () => g });
      var a,
        n,
        i,
        o,
        l = r(4194),
        s = r(5231);
      function u() {
        return (u = Object.assign
          ? Object.assign.bind()
          : function (e) {
              for (var t = 1; t < arguments.length; t++) {
                var r = arguments[t];
                for (var a in r)
                  Object.prototype.hasOwnProperty.call(r, a) && (e[a] = r[a]);
              }
              return e;
            }).apply(this, arguments);
      }
      let c = l.createContext(null),
        h = l.createContext(null),
        p = l.createContext(null),
        d = l.createContext({ outlet: null, matches: [], isDataRoute: !1 });
      function f() {
        return null != l.useContext(p);
      }
      function v() {
        return f() || (0, s.J0)(!1), l.useContext(p).location;
      }
      function m(e) {
        l.useContext(h).static || l.useLayoutEffect(e);
      }
      function g() {
        let { isDataRoute: e } = l.useContext(d);
        return e
          ? (function () {
              var e, t;
              let r, a, n, i;
              let { router: o } =
                  (y.UseNavigateStable, (r = l.useContext(c)) || (0, s.J0)(!1), r),
                h =
                  (b.UseNavigateStable,
                  (i = ((a = l.useContext(d)) || (0, s.J0)(!1), (n = a)).matches[
                    n.matches.length - 1
                  ]).route.id || (0, s.J0)(!1),
                  i.route.id),
                p = l.useRef(!1);
              return (
                m(() => {
                  p.current = !0;
                }),
                l.useCallback(
                  function (e, t) {
                    void 0 === t && (t = {}),
                      p.current &&
                        ('number' == typeof e
                          ? o.navigate(e)
                          : o.navigate(e, u({ fromRouteId: h }, t)));
                  },
                  [o, h]
                )
              );
            })()
          : (function () {
              f() || (0, s.J0)(!1);
              let e = l.useContext(c),
                { basename: t, future: r, navigator: a } = l.useContext(h),
                { matches: n } = l.useContext(d),
                { pathname: i } = v(),
                o = JSON.stringify((0, s.cm)(n, r.v7_relativeSplatPath)),
                u = l.useRef(!1);
              return (
                m(() => {
                  u.current = !0;
                }),
                l.useCallback(
                  function (r, n) {
                    if ((void 0 === n && (n = {}), !u.current)) return;
                    if ('number' == typeof r) {
                      a.go(r);
                      return;
                    }
                    let l = (0, s.pC)(r, JSON.parse(o), i, 'path' === n.relative);
                    null == e &&
                      '/' !== t &&
                      (l.pathname = '/' === l.pathname ? t : (0, s.RQ)([t, l.pathname])),
                      (n.replace ? a.replace : a.push)(l, n.state, n);
                  },
                  [t, a, o, i, e]
                )
              );
            })();
      }
      l.Component;
      var y =
          (((a = y || {}).UseBlocker = 'useBlocker'),
          (a.UseRevalidator = 'useRevalidator'),
          (a.UseNavigateStable = 'useNavigate'),
          a),
        b =
          (((n = b || {}).UseBlocker = 'useBlocker'),
          (n.UseLoaderData = 'useLoaderData'),
          (n.UseActionData = 'useActionData'),
          (n.UseRouteError = 'useRouteError'),
          (n.UseNavigation = 'useNavigation'),
          (n.UseRouteLoaderData = 'useRouteLoaderData'),
          (n.UseMatches = 'useMatches'),
          (n.UseRevalidator = 'useRevalidator'),
          (n.UseNavigateStable = 'useNavigate'),
          (n.UseRouteId = 'useRouteId'),
          n);
      let R = (e, t, r) => {};
      function S(e, t) {
        (null == e ? void 0 : e.v7_startTransition) === void 0 &&
          R(
            'v7_startTransition',
            'React Router will begin wrapping state updates in `React.startTransition` in v7',
            'https://reactrouter.com/v6/upgrading/future#v7_starttransition'
          ),
          (null == e ? void 0 : e.v7_relativeSplatPath) !== void 0 ||
            (t && t.v7_relativeSplatPath) ||
            R(
              'v7_relativeSplatPath',
              'Relative route resolution within Splat routes is changing in v7',
              'https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath'
            ),
          t &&
            (void 0 === t.v7_fetcherPersist &&
              R(
                'v7_fetcherPersist',
                'The persistence behavior of fetchers is changing in v7',
                'https://reactrouter.com/v6/upgrading/future#v7_fetcherpersist'
              ),
            void 0 === t.v7_normalizeFormMethod &&
              R(
                'v7_normalizeFormMethod',
                'Casing of `formMethod` fields is being normalized to uppercase in v7',
                'https://reactrouter.com/v6/upgrading/future#v7_normalizeformmethod'
              ),
            void 0 === t.v7_partialHydration &&
              R(
                'v7_partialHydration',
                '`RouterProvider` hydration behavior is changing in v7',
                'https://reactrouter.com/v6/upgrading/future#v7_partialhydration'
              ),
            void 0 === t.v7_skipActionErrorRevalidation &&
              R(
                'v7_skipActionErrorRevalidation',
                'The revalidation behavior after 4xx/5xx `action` responses is changing in v7',
                'https://reactrouter.com/v6/upgrading/future#v7_skipactionerrorrevalidation'
              ));
      }
      function w(e) {
        let {
          basename: t = '/',
          children: r = null,
          location: a,
          navigationType: n = s.aU.Pop,
          navigator: i,
          static: o = !1,
          future: c,
        } = e;
        f() && (0, s.J0)(!1);
        let d = t.replace(/^\/*/, '/'),
          v = l.useMemo(
            () => ({
              basename: d,
              navigator: i,
              static: o,
              future: u({ v7_relativeSplatPath: !1 }, c),
            }),
            [d, c, i, o]
          );
        'string' == typeof a && (a = (0, s.cP)(a));
        let {
            pathname: m = '/',
            search: g = '',
            hash: y = '',
            state: b = null,
            key: R = 'default',
          } = a,
          S = l.useMemo(() => {
            let e = (0, s.Zn)(m, d);
            return null == e
              ? null
              : {
                  location: { pathname: e, search: g, hash: y, state: b, key: R },
                  navigationType: n,
                };
          }, [d, m, g, y, b, R, n]);
        return null == S
          ? null
          : l.createElement(
              h.Provider,
              { value: v },
              l.createElement(p.Provider, { children: r, value: S })
            );
      }
      (o || (o = r.t(l, 2))).startTransition;
      var P =
        (((i = P || {})[(i.pending = 0)] = 'pending'),
        (i[(i.success = 1)] = 'success'),
        (i[(i.error = 2)] = 'error'),
        i);
      new Promise(() => {}), l.Component;
    },
  },
]);
