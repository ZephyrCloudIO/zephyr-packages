(() => {
  'use strict';
  var e = { 3073: function () {} },
    r = {};
  function t(o) {
    var n = r[o];
    if (void 0 !== n) return n.exports;
    var a = (r[o] = { exports: {} });
    return e[o].call(a.exports, a, a.exports, t), a.exports;
  }
  (t.m = e),
    (t.n = (e) => {
      var r = e && e.__esModule ? () => e.default : () => e;
      return t.d(r, { a: r }), r;
    }),
    (() => {
      var e,
        r = Object.getPrototypeOf ? (e) => Object.getPrototypeOf(e) : (e) => e.__proto__;
      t.t = function (o, n) {
        if (
          (1 & n && (o = this(o)),
          8 & n ||
            ('object' == typeof o &&
              o &&
              ((4 & n && o.__esModule) || (16 & n && 'function' == typeof o.then))))
        )
          return o;
        var a = Object.create(null);
        t.r(a);
        var i = {};
        e = e || [null, r({}), r([]), r(r)];
        for (var u = 2 & n && o; 'object' == typeof u && !~e.indexOf(u); u = r(u))
          Object.getOwnPropertyNames(u).forEach((e) => {
            i[e] = () => o[e];
          });
        return (i.default = () => o), t.d(a, i), a;
      };
    })(),
    (t.d = (e, r) => {
      for (var o in r)
        t.o(r, o) &&
          !t.o(e, o) &&
          Object.defineProperty(e, o, { enumerable: !0, get: r[o] });
    }),
    (t.f = {}),
    (t.e = (e) => Promise.all(Object.keys(t.f).reduce((r, o) => (t.f[o](e, r), r), []))),
    (t.u = (e) =>
      'static/js/async/' +
      e +
      '.' +
      { 465: '1b2a5779', 747: 'ff82c490', 853: 'f45c9585' }[e] +
      '.js'),
    (t.miniCssF = (e) => '' + e + '.css'),
    (t.h = () => '692b4c15409c2353'),
    (() => {
      t.g = (() => {
        if ('object' == typeof globalThis) return globalThis;
        try {
          return this || Function('return this')();
        } catch (e) {
          if ('object' == typeof window) return window;
        }
      })();
    })(),
    (t.o = (e, r) => Object.prototype.hasOwnProperty.call(e, r)),
    (() => {
      var e = {},
        r = 'rspress-ssg:';
      t.l = function (o, n, a, i) {
        if (e[o]) {
          e[o].push(n);
          return;
        }
        if (void 0 !== a)
          for (
            var u, s, c = document.getElementsByTagName('script'), f = 0;
            f < c.length;
            f++
          ) {
            var l = c[f];
            if (l.getAttribute('src') == o || l.getAttribute('data-webpack') == r + a) {
              u = l;
              break;
            }
          }
        u ||
          ((s = !0),
          ((u = document.createElement('script')).charset = 'utf-8'),
          (u.timeout = 120),
          t.nc && u.setAttribute('nonce', t.nc),
          u.setAttribute('data-webpack', r + a),
          (u.src = o)),
          (e[o] = [n]);
        var d = function (r, t) {
            (u.onerror = u.onload = null), clearTimeout(p);
            var n = e[o];
            if (
              (delete e[o],
              u.parentNode && u.parentNode.removeChild(u),
              n &&
                n.forEach(function (e) {
                  return e(t);
                }),
              r)
            )
              return r(t);
          },
          p = setTimeout(d.bind(null, void 0, { type: 'timeout', target: u }), 12e4);
        (u.onerror = d.bind(null, u.onerror)),
          (u.onload = d.bind(null, u.onload)),
          s && document.head.appendChild(u);
      };
    })(),
    (t.r = (e) => {
      'undefined' != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
        Object.defineProperty(e, '__esModule', { value: !0 });
    }),
    (() => {
      var e = [];
      t.O = (r, o, n, a) => {
        if (o) {
          a = a || 0;
          for (var i = e.length; i > 0 && e[i - 1][2] > a; i--) e[i] = e[i - 1];
          e[i] = [o, n, a];
          return;
        }
        for (var u = 1 / 0, i = 0; i < e.length; i++) {
          for (var [o, n, a] = e[i], s = !0, c = 0; c < o.length; c++)
            (!1 & a || u >= a) && Object.keys(t.O).every((e) => t.O[e](o[c]))
              ? o.splice(c--, 1)
              : ((s = !1), a < u && (u = a));
          if (s) {
            e.splice(i--, 1);
            var f = n();
            void 0 !== f && (r = f);
          }
        }
        return r;
      };
    })(),
    (t.p = '/'),
    (t.rv = () => '1.2.8'),
    (() => {
      var e = { 980: 0 };
      (t.f.j = function (r, o) {
        var n = t.o(e, r) ? e[r] : void 0;
        if (0 !== n) {
          if (n) o.push(n[2]);
          else {
            var a = new Promise((t, o) => (n = e[r] = [t, o]));
            o.push((n[2] = a));
            var i = t.p + t.u(r),
              u = Error();
            t.l(
              i,
              function (o) {
                if (t.o(e, r) && (0 !== (n = e[r]) && (e[r] = void 0), n)) {
                  var a = o && ('load' === o.type ? 'missing' : o.type),
                    i = o && o.target && o.target.src;
                  (u.message = 'Loading chunk ' + r + ' failed.\n(' + a + ': ' + i + ')'),
                    (u.name = 'ChunkLoadError'),
                    (u.type = a),
                    (u.request = i),
                    n[1](u);
                }
              },
              'chunk-' + r,
              r
            );
          }
        }
      }),
        (t.O.j = (r) => 0 === e[r]);
      var r = (r, o) => {
          var n,
            a,
            [i, u, s] = o,
            c = 0;
          if (i.some((r) => 0 !== e[r])) {
            for (n in u) t.o(u, n) && (t.m[n] = u[n]);
            if (s) var f = s(t);
          }
          for (r && r(o); c < i.length; c++)
            (a = i[c]), t.o(e, a) && e[a] && e[a][0](), (e[a] = 0);
          return t.O(f);
        },
        o = (self.webpackChunkrspress_ssg = self.webpackChunkrspress_ssg || []);
      o.forEach(r.bind(null, 0)), (o.push = r.bind(null, o.push.bind(o)));
    })(),
    (t.ruid = 'bundler=rspack@1.2.8');
  var o = t.O(void 0, ['212', '361', '118', '774'], function () {
    return t(5363);
  });
  o = t.O(o);
})();
