/*! For license information please see 473.6b5bf1e3.js.LICENSE.txt */
(self.webpackChunkrspress_ssg = self.webpackChunkrspress_ssg || []).push([
  ['473'],
  {
    5549: function (e, t) {
      'use strict';
      t.parse = function (e) {
        for (var t, n = [], r = String(e || ''), a = r.indexOf(','), i = 0, o = !1; !o; )
          -1 === a && ((a = r.length), (o = !0)),
            ((t = r.slice(i, a).trim()) || !o) && n.push(t),
            (i = a + 1),
            (a = r.indexOf(',', i));
        return n;
      };
    },
    9585: function (e, t, n) {
      'use strict';
      var r = n(9687),
        a = { 'text/plain': 'Text', 'text/html': 'Url', default: 'Text' };
      e.exports = function (e, t) {
        var n,
          i,
          o,
          s,
          l,
          u,
          c,
          d,
          h = !1;
        t || (t = {}), (o = t.debug || !1);
        try {
          if (
            ((l = r()),
            (u = document.createRange()),
            (c = document.getSelection()),
            ((d = document.createElement('span')).textContent = e),
            (d.ariaHidden = 'true'),
            (d.style.all = 'unset'),
            (d.style.position = 'fixed'),
            (d.style.top = 0),
            (d.style.clip = 'rect(0, 0, 0, 0)'),
            (d.style.whiteSpace = 'pre'),
            (d.style.webkitUserSelect = 'text'),
            (d.style.MozUserSelect = 'text'),
            (d.style.msUserSelect = 'text'),
            (d.style.userSelect = 'text'),
            d.addEventListener('copy', function (n) {
              if ((n.stopPropagation(), t.format))
                if ((n.preventDefault(), void 0 === n.clipboardData)) {
                  o && console.warn('unable to use e.clipboardData'),
                    o && console.warn('trying IE specific stuff'),
                    window.clipboardData.clearData();
                  var r = a[t.format] || a.default;
                  window.clipboardData.setData(r, e);
                } else n.clipboardData.clearData(), n.clipboardData.setData(t.format, e);
              t.onCopy && (n.preventDefault(), t.onCopy(n.clipboardData));
            }),
            document.body.appendChild(d),
            u.selectNodeContents(d),
            c.addRange(u),
            !document.execCommand('copy'))
          )
            throw Error('copy command was unsuccessful');
          h = !0;
        } catch (r) {
          o && console.error('unable to copy using execCommand: ', r),
            o && console.warn('trying IE specific stuff');
          try {
            window.clipboardData.setData(t.format || 'text', e),
              t.onCopy && t.onCopy(window.clipboardData),
              (h = !0);
          } catch (r) {
            o && console.error('unable to copy using clipboardData: ', r),
              o && console.error('falling back to prompt'),
              (n = 'message' in t ? t.message : 'Copy to clipboard: #{key}, Enter'),
              (i = (/mac os x/i.test(navigator.userAgent) ? '⌘' : 'Ctrl') + '+C'),
              (s = n.replace(/#{\s*key\s*}/g, i)),
              window.prompt(s, e);
          }
        } finally {
          c &&
            ('function' == typeof c.removeRange ? c.removeRange(u) : c.removeAllRanges()),
            d && document.body.removeChild(d),
            l();
        }
        return h;
      };
    },
    5365: function (e) {
      'use strict';
      e.exports = function (e, n) {
        for (var r, a, i, o = e || '', s = n || 'div', l = {}, u = 0; u < o.length; )
          (t.lastIndex = u),
            (i = t.exec(o)),
            (r = o.slice(u, i ? i.index : o.length)) &&
              (a
                ? '#' === a
                  ? (l.id = r)
                  : l.className
                    ? l.className.push(r)
                    : (l.className = [r])
                : (s = r),
              (u += r.length)),
            i && ((a = i[0]), u++);
        return { type: 'element', tagName: s, properties: l, children: [] };
      };
      var t = /[#.]/g;
    },
    246: function (e, t, n) {
      'use strict';
      var r = n(4352),
        a = n(3912),
        i = n(5365),
        o = n(645).parse,
        s = n(5549).parse;
      e.exports = function (e, t, n) {
        var a = n
          ? (function (e) {
              for (var t, n = e.length, r = -1, a = {}; ++r < n; )
                a[(t = e[r]).toLowerCase()] = t;
              return a;
            })(n)
          : null;
        return function (n, c) {
          var d,
            h,
            f,
            p,
            m,
            g,
            v = i(n, t),
            x = Array.prototype.slice.call(arguments, 2),
            y = v.tagName.toLowerCase();
          if (
            ((v.tagName = a && l.call(a, y) ? a[y] : y),
            c &&
              ((d = c),
              (h = v),
              'string' == typeof d ||
                'length' in d ||
                ((f = h.tagName),
                (m = (p = d).type),
                'input' !== f &&
                  m &&
                  'string' == typeof m &&
                  (('object' == typeof p.children && 'length' in p.children) ||
                    (((m = m.toLowerCase()), 'button' === f)
                      ? 'menu' !== m && 'submit' !== m && 'reset' !== m && 'button' !== m
                      : 'value' in p)))) &&
              (x.unshift(c), (c = null)),
            c)
          )
            for (g in c)
              !(function (t, n, a) {
                var i, l, c;
                null != a &&
                  a == a &&
                  ((l = (i = r(e, n)).property),
                  'string' == typeof (c = a) &&
                    (i.spaceSeparated
                      ? (c = o(c))
                      : i.commaSeparated
                        ? (c = s(c))
                        : i.commaOrSpaceSeparated && (c = o(s(c).join(' ')))),
                  'style' === l &&
                    'string' != typeof a &&
                    (c = (function (e) {
                      var t,
                        n = [];
                      for (t in e) n.push([t, e[t]].join(': '));
                      return n.join('; ');
                    })(c)),
                  'className' === l && t.className && (c = t.className.concat(c)),
                  (t[l] = (function (e, t, n) {
                    var r, a, i;
                    if ('object' != typeof n || !('length' in n)) return u(e, t, n);
                    for (a = n.length, r = -1, i = []; ++r < a; ) i[r] = u(e, t, n[r]);
                    return i;
                  })(i, l, c)));
              })(v.properties, g, c[g]);
          return (
            (function e(t, n) {
              var r, a;
              if ('string' == typeof n || 'number' == typeof n)
                return void t.push({ type: 'text', value: String(n) });
              if ('object' == typeof n && 'length' in n) {
                for (r = -1, a = n.length; ++r < a; ) e(t, n[r]);
                return;
              }
              if ('object' != typeof n || !('type' in n))
                throw Error('Expected node, nodes, or string, got `' + n + '`');
              t.push(n);
            })(v.children, x),
            'template' === v.tagName &&
              ((v.content = { type: 'root', children: v.children }), (v.children = [])),
            v
          );
        };
      };
      var l = {}.hasOwnProperty;
      function u(e, t, n) {
        var r = n;
        return (
          e.number || e.positiveNumber
            ? isNaN(r) || '' === r || (r = Number(r))
            : (e.boolean || e.overloadedBoolean) &&
              'string' == typeof r &&
              ('' === r || a(n) === a(t)) &&
              (r = !0),
          r
        );
      }
    },
    3503: function (e, t, n) {
      'use strict';
      var r = n(3622),
        a = n(246)(r, 'div');
      (a.displayName = 'html'), (e.exports = a);
    },
    8632: function (e, t, n) {
      'use strict';
      e.exports = n(3503);
    },
    7903: function (e, t, n) {
      e.exports = (function (e) {
        'use strict';
        function t(e) {
          return e.replace(/(-|:)(.)/g, function (e, t, n) {
            return n.toUpperCase();
          });
        }
        e = e && e.hasOwnProperty('default') ? e.default : e;
        var n = ['table', 'tbody', 'thead', 'tfoot', 'tr'],
          r = {
            for: 'htmlFor',
            class: 'className',
            allowfullscreen: ['allowFullScreen', 'allowFullscreen'],
            autocomplete: 'autoComplete',
            autofocus: ['autoFocus'],
            contenteditable: 'contentEditable',
            spellcheck: 'spellCheck',
            srcdoc: 'srcDoc',
            srcset: 'srcSet',
            itemscope: 'itemScope',
            itemprop: 'itemProp',
            itemtype: 'itemType',
          };
        function a(e, t) {
          var n = r[t],
            a = document.createElement(e);
          if (n)
            return {
              name: Array.isArray(n) ? n[0] : n,
              isBoolean: i(a, Array.isArray(n) ? n[1] || t : n),
            };
          for (var o in a)
            if (o.toLowerCase() === t.toLowerCase())
              return { name: o, isBoolean: i(a, o) };
          return { name: t, isBoolean: i(a, t) };
        }
        function i(e, t) {
          return e.setAttribute(t, ''), !0 === e[t] || o.indexOf(t) > -1;
        }
        var o = ['itemScope'];
        function s(t, n, r, a) {
          void 0 === a && (a = null);
          var i = r[t],
            o = r._;
          return i ? e.createElement(i, n, a) : o ? o(t, n, a) : e.createElement(t, n, a);
        }
        return function (e, r) {
          if ((void 0 === r && (r = {}), 'string' != typeof e))
            throw TypeError('Expected HTML string');
          var i = document.createElement('div');
          i.innerHTML = e.trim();
          var o = Array.from(i.childNodes)
            .map(function (e, i) {
              return (function e(r, i, o) {
                var l,
                  u = o.transform || {},
                  c = o.preserveAttributes || [],
                  d = o.dangerouslySetChildren || ['style'],
                  h = u._;
                if (8 === r.nodeType) return null;
                if (3 === r.nodeType) {
                  var f = r.textContent;
                  return h ? h(f) : f;
                }
                for (var p = {}, m = r.attributes, g = 0; g < m.length; g++)
                  p[m[g].name] = m[g].value;
                p.key = i.toString();
                var v = r.tagName.toLowerCase(),
                  x =
                    (void 0 === (l = p) && (l = {}),
                    Object.keys(l).reduce(function (e, n) {
                      if (/^on.*/.test(n)) return e;
                      var r = n;
                      /^(data|aria)-/.test(n) ||
                        (0 ===
                          c.filter(function (e) {
                            return e instanceof RegExp ? e.test(n) : e === n;
                          }).length &&
                          (r = t(n)));
                      var i,
                        o,
                        s = a(v, r);
                      if ('style' === s.name)
                        e[s.name] =
                          ((i = l.style),
                          (o = {}),
                          i
                            .split(';')
                            .filter(function (e) {
                              return '' !== e.trim();
                            })
                            .forEach(function (e) {
                              var n,
                                r = e.split(':');
                              if (r.length > 1) {
                                var a,
                                  i =
                                    ((a = r[0].trim()),
                                    /^-ms-/.test(a) && (a = a.substr(1)),
                                    a.startsWith('--') ? a : t(a)),
                                  s =
                                    ((n = r.slice(1).join(':').trim()),
                                    /^\d+$/.test(n) ? Number(n) : n.replace(/'/g, '"'));
                                o[i] = s;
                              }
                            }),
                          o);
                      else {
                        var u = l[n],
                          d = '' === u || String(u).toLowerCase() === r.toLowerCase();
                        e[s.name] = s.isBoolean ? d : u;
                      }
                      return e;
                    }, {})),
                  y = Array.from(r.childNodes)
                    .map(function (t, r) {
                      return n.indexOf(v) > -1 &&
                        3 === t.nodeType &&
                        ((t.textContent = t.textContent.trim()), '' === t.textContent)
                        ? null
                        : e(t, i + '.' + r, o);
                    })
                    .filter(Boolean);
                if (d.indexOf(v) > -1) {
                  var b = r.innerHTML;
                  return (
                    b &&
                      ('style' !== v && 'script' !== v && (b = b.replace(/"/g, '&quot;')),
                      (x.dangerouslySetInnerHTML = { __html: b.trim() })),
                    s(v, x, u)
                  );
                }
                return s(v, x, u, 0 === y.length ? null : y);
              })(e, String(i), r);
            })
            .filter(Boolean);
          return 1 === o.length ? o[0] : o;
        };
      })(n(2155));
    },
    2018: function (e) {
      'use strict';
      e.exports = function (e, t, n, r, a, i, o, s) {
        if (!e) {
          var l;
          if (void 0 === t)
            l = Error(
              'Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.'
            );
          else {
            var u = [n, r, a, i, o, s],
              c = 0;
            (l = Error(
              t.replace(/%s/g, function () {
                return u[c++];
              })
            )).name = 'Invariant Violation';
          }
          throw ((l.framesToPop = 1), l);
        }
      };
    },
    6633: function (e) {
      'use strict';
      e.exports = function (e) {
        var t = 'string' == typeof e ? e.charCodeAt(0) : e;
        return (t >= 97 && t <= 122) || (t >= 65 && t <= 90);
      };
    },
    6837: function (e, t, n) {
      'use strict';
      var r = n(6633),
        a = n(7101);
      e.exports = function (e) {
        return r(e) || a(e);
      };
    },
    7101: function (e) {
      'use strict';
      e.exports = function (e) {
        var t = 'string' == typeof e ? e.charCodeAt(0) : e;
        return t >= 48 && t <= 57;
      };
    },
    9749: function (e) {
      'use strict';
      e.exports = function (e) {
        var t = 'string' == typeof e ? e.charCodeAt(0) : e;
        return (t >= 97 && t <= 102) || (t >= 65 && t <= 70) || (t >= 48 && t <= 57);
      };
    },
    7747: function (e) {
      var t;
      (t = function () {
        var e,
          t,
          n,
          r = {};
        r.version = '0.2.0';
        var a = (r.settings = {
          minimum: 0.08,
          easing: 'ease',
          positionUsing: '',
          speed: 200,
          trickle: !0,
          trickleRate: 0.02,
          trickleSpeed: 800,
          showSpinner: !0,
          barSelector: '[role="bar"]',
          spinnerSelector: '[role="spinner"]',
          parent: 'body',
          template:
            '<div class="bar" role="bar"><div class="peg"></div></div><div class="spinner" role="spinner"><div class="spinner-icon"></div></div>',
        });
        function i(e, t, n) {
          return e < t ? t : e > n ? n : e;
        }
        (r.configure = function (e) {
          var t, n;
          for (t in e) void 0 !== (n = e[t]) && e.hasOwnProperty(t) && (a[t] = n);
          return this;
        }),
          (r.status = null),
          (r.set = function (e) {
            var t = r.isStarted();
            r.status = 1 === (e = i(e, a.minimum, 1)) ? null : e;
            var n = r.render(!t),
              l = n.querySelector(a.barSelector),
              u = a.speed,
              c = a.easing;
            return (
              n.offsetWidth,
              o(function (t) {
                var i, o, d, h;
                '' === a.positionUsing && (a.positionUsing = r.getPositioningCSS()),
                  s(
                    l,
                    ((i = e),
                    (o = u),
                    (d = c),
                    ((h =
                      'translate3d' === a.positionUsing
                        ? { transform: 'translate3d(' + (-1 + i) * 100 + '%,0,0)' }
                        : 'translate' === a.positionUsing
                          ? { transform: 'translate(' + (-1 + i) * 100 + '%,0)' }
                          : { 'margin-left': (-1 + i) * 100 + '%' }).transition =
                      'all ' + o + 'ms ' + d),
                    h)
                  ),
                  1 === e
                    ? (s(n, { transition: 'none', opacity: 1 }),
                      n.offsetWidth,
                      setTimeout(function () {
                        s(n, { transition: 'all ' + u + 'ms linear', opacity: 0 }),
                          setTimeout(function () {
                            r.remove(), t();
                          }, u);
                      }, u))
                    : setTimeout(t, u);
              }),
              this
            );
          }),
          (r.isStarted = function () {
            return 'number' == typeof r.status;
          }),
          (r.start = function () {
            r.status || r.set(0);
            var e = function () {
              setTimeout(function () {
                r.status && (r.trickle(), e());
              }, a.trickleSpeed);
            };
            return a.trickle && e(), this;
          }),
          (r.done = function (e) {
            return e || r.status ? r.inc(0.3 + 0.5 * Math.random()).set(1) : this;
          }),
          (r.inc = function (e) {
            var t = r.status;
            return t
              ? ('number' != typeof e && (e = (1 - t) * i(Math.random() * t, 0.1, 0.95)),
                (t = i(t + e, 0, 0.994)),
                r.set(t))
              : r.start();
          }),
          (r.trickle = function () {
            return r.inc(Math.random() * a.trickleRate);
          }),
          (e = 0),
          (t = 0),
          (r.promise = function (n) {
            return (
              n &&
                'resolved' !== n.state() &&
                (0 === t && r.start(),
                e++,
                t++,
                n.always(function () {
                  0 == --t ? ((e = 0), r.done()) : r.set((e - t) / e);
                })),
              this
            );
          }),
          (r.render = function (e) {
            if (r.isRendered()) return document.getElementById('nprogress');
            u(document.documentElement, 'nprogress-busy');
            var t = document.createElement('div');
            (t.id = 'nprogress'), (t.innerHTML = a.template);
            var n,
              i = t.querySelector(a.barSelector),
              o = e ? '-100' : (-1 + (r.status || 0)) * 100,
              l = document.querySelector(a.parent);
            return (
              s(i, {
                transition: 'all 0 linear',
                transform: 'translate3d(' + o + '%,0,0)',
              }),
              !a.showSpinner && (n = t.querySelector(a.spinnerSelector)) && h(n),
              l != document.body && u(l, 'nprogress-custom-parent'),
              l.appendChild(t),
              t
            );
          }),
          (r.remove = function () {
            c(document.documentElement, 'nprogress-busy'),
              c(document.querySelector(a.parent), 'nprogress-custom-parent');
            var e = document.getElementById('nprogress');
            e && h(e);
          }),
          (r.isRendered = function () {
            return !!document.getElementById('nprogress');
          }),
          (r.getPositioningCSS = function () {
            var e = document.body.style,
              t =
                'WebkitTransform' in e
                  ? 'Webkit'
                  : 'MozTransform' in e
                    ? 'Moz'
                    : 'msTransform' in e
                      ? 'ms'
                      : 'OTransform' in e
                        ? 'O'
                        : '';
            return t + 'Perspective' in e
              ? 'translate3d'
              : t + 'Transform' in e
                ? 'translate'
                : 'margin';
          });
        var o =
            ((n = []),
            function (e) {
              n.push(e),
                1 == n.length &&
                  (function e() {
                    var t = n.shift();
                    t && t(e);
                  })();
            }),
          s = (function () {
            var e = ['Webkit', 'O', 'Moz', 'ms'],
              t = {};
            function n(n, r, a) {
              var i;
              (r =
                t[
                  (i = (i = r)
                    .replace(/^-ms-/, 'ms-')
                    .replace(/-([\da-z])/gi, function (e, t) {
                      return t.toUpperCase();
                    }))
                ] ||
                (t[i] = (function (t) {
                  var n = document.body.style;
                  if (t in n) return t;
                  for (
                    var r, a = e.length, i = t.charAt(0).toUpperCase() + t.slice(1);
                    a--;

                  )
                    if ((r = e[a] + i) in n) return r;
                  return t;
                })(i))),
                (n.style[r] = a);
            }
            return function (e, t) {
              var r,
                a,
                i = arguments;
              if (2 == i.length)
                for (r in t) void 0 !== (a = t[r]) && t.hasOwnProperty(r) && n(e, r, a);
              else n(e, i[1], i[2]);
            };
          })();
        function l(e, t) {
          return ('string' == typeof e ? e : d(e)).indexOf(' ' + t + ' ') >= 0;
        }
        function u(e, t) {
          var n = d(e),
            r = n + t;
          l(n, t) || (e.className = r.substring(1));
        }
        function c(e, t) {
          var n,
            r = d(e);
          l(e, t) &&
            (e.className = (n = r.replace(' ' + t + ' ', ' ')).substring(
              1,
              n.length - 1
            ));
        }
        function d(e) {
          return (' ' + (e.className || '') + ' ').replace(/\s+/gi, ' ');
        }
        function h(e) {
          e && e.parentNode && e.parentNode.removeChild(e);
        }
        return r;
      }),
        'function' == typeof define && define.amd ? define(t) : (e.exports = t());
    },
    7940: function (e) {
      'use strict';
      var t;
      e.exports = function (e) {
        var n,
          r = '&' + e + ';';
        return (
          ((t = t || document.createElement('i')).innerHTML = r),
          (59 !== (n = t.textContent).charCodeAt(n.length - 1) || 'semi' === e) &&
            n !== r &&
            n
        );
      };
    },
    2516: function (e, t, n) {
      'use strict';
      var r = n(3209),
        a = n(5109),
        i = n(7101),
        o = n(9749),
        s = n(6837),
        l = n(7940);
      e.exports = function (e, t) {
        var n,
          i,
          o = {};
        for (i in (t || (t = {}), h)) (n = t[i]), (o[i] = null == n ? h[i] : n);
        return (
          (o.position.indent || o.position.start) &&
            ((o.indent = o.position.indent || []), (o.position = o.position.start)),
          (function (e, t) {
            var n,
              i,
              o,
              h,
              y,
              b,
              D,
              F,
              w,
              C,
              j,
              E,
              A,
              k,
              S,
              N,
              T,
              B,
              L,
              O,
              P,
              _ = t.additional,
              $ = t.nonTerminated,
              M = t.text,
              I = t.reference,
              z = t.warning,
              R = t.textContext,
              H = t.referenceContext,
              W = t.warningContext,
              U = t.position,
              q = t.indent || [],
              V = e.length,
              G = 0,
              Z = -1,
              Y = U.column || 1,
              K = U.line || 1,
              X = '',
              J = [];
            for (
              'string' == typeof _ && (_ = _.charCodeAt(0)),
                B = Q(),
                C = z
                  ? function (e, t) {
                      var n = Q();
                      (n.column += t), (n.offset += t), z.call(W, x[e], n, e);
                    }
                  : d,
                G--,
                V++;
              ++G < V;

            )
              if ((10 === D && (Y = q[Z] || 1), 38 === (D = e.charCodeAt(G)))) {
                if (
                  9 === (w = e.charCodeAt(G + 1)) ||
                  10 === w ||
                  12 === w ||
                  32 === w ||
                  38 === w ||
                  60 === w ||
                  w != w ||
                  (_ && w === _)
                ) {
                  (X += c(D)), Y++;
                  continue;
                }
                for (
                  k = S = G + 1,
                    P = S,
                    35 === w
                      ? ((P = ++k),
                        88 === (w = e.charCodeAt(P)) || 120 === w
                          ? ((N = p), (P = ++k))
                          : (N = m))
                      : (N = f),
                    o = '',
                    A = '',
                    b = '',
                    T = v[N],
                    P--;
                  ++P < V && T((w = e.charCodeAt(P)));

                )
                  (b += c(w)), N === f && u.call(r, b) && ((o = b), (A = r[b]));
                if (
                  ((y = 59 === e.charCodeAt(P)) &&
                    (P++, (h = N === f && l(b)) && ((o = b), (A = h))),
                  (O = 1 + P - S),
                  y || $)
                ) {
                  b
                    ? N === f
                      ? (y && !A
                          ? C(5, 1)
                          : (o !== b && ((O = 1 + (P = k + o.length) - k), (y = !1)),
                            y ||
                              ((j = o ? 1 : 3),
                              t.attribute
                                ? 61 === (w = e.charCodeAt(P))
                                  ? (C(j, O), (A = null))
                                  : s(w)
                                    ? (A = null)
                                    : C(j, O)
                                : C(j, O))),
                        (F = A))
                      : (y || C(2, O),
                        ((n = F = parseInt(b, g[N])) >= 55296 && n <= 57343) ||
                        n > 1114111
                          ? (C(7, O), (F = c(65533)))
                          : F in a
                            ? (C(6, O), (F = a[F]))
                            : ((E = ''),
                              (((i = F) >= 1 && i <= 8) ||
                                11 === i ||
                                (i >= 13 && i <= 31) ||
                                (i >= 127 && i <= 159) ||
                                (i >= 64976 && i <= 65007) ||
                                (65535 & i) == 65535 ||
                                (65535 & i) == 65534) &&
                                C(6, O),
                              F > 65535 &&
                                ((F -= 65536),
                                (E += c((F >>> 10) | 55296)),
                                (F = 56320 | (1023 & F))),
                              (F = E + c(F))))
                    : N !== f && C(4, O);
                }
                F
                  ? (ee(),
                    (B = Q()),
                    (G = P - 1),
                    (Y += P - S + 1),
                    J.push(F),
                    (L = Q()),
                    L.offset++,
                    I && I.call(H, F, { start: B, end: L }, e.slice(S - 1, P)),
                    (B = L))
                  : ((b = e.slice(S - 1, P)), (X += b), (Y += b.length), (G = P - 1));
              } else 10 === D && (K++, Z++, (Y = 0)), D == D ? ((X += c(D)), Y++) : ee();
            return J.join('');
            function Q() {
              return { line: K, column: Y, offset: G + (U.offset || 0) };
            }
            function ee() {
              X && (J.push(X), M && M.call(R, X, { start: B, end: Q() }), (X = ''));
            }
          })(e, o)
        );
      };
      var u = {}.hasOwnProperty,
        c = String.fromCharCode,
        d = Function.prototype,
        h = {
          warning: null,
          reference: null,
          text: null,
          warningContext: null,
          referenceContext: null,
          textContext: null,
          position: {},
          additional: null,
          attribute: !1,
          nonTerminated: !0,
        },
        f = 'named',
        p = 'hexadecimal',
        m = 'decimal',
        g = {};
      (g[p] = 16), (g[m] = 10);
      var v = {};
      (v[f] = s), (v[m] = i), (v[p] = o);
      var x = {};
      (x[1] = 'Named character references must be terminated by a semicolon'),
        (x[2] = 'Numeric character references must be terminated by a semicolon'),
        (x[3] = 'Named character references cannot be empty'),
        (x[4] = 'Numeric character references cannot be empty'),
        (x[5] = 'Named character references must be known'),
        (x[6] = 'Numeric character references cannot be disallowed'),
        (x[7] =
          'Numeric character references cannot be outside the permissible Unicode range');
    },
    5398: function (e, t, n) {
      var r = (function (e) {
        var t = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i,
          n = 0,
          r = {},
          a = {
            manual: e.Prism && e.Prism.manual,
            disableWorkerMessageHandler: e.Prism && e.Prism.disableWorkerMessageHandler,
            util: {
              encode: function e(t) {
                return t instanceof i
                  ? new i(t.type, e(t.content), t.alias)
                  : Array.isArray(t)
                    ? t.map(e)
                    : t
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/\u00a0/g, ' ');
              },
              type: function (e) {
                return Object.prototype.toString.call(e).slice(8, -1);
              },
              objId: function (e) {
                return e.__id || Object.defineProperty(e, '__id', { value: ++n }), e.__id;
              },
              clone: function e(t, n) {
                var r, i;
                switch (((n = n || {}), a.util.type(t))) {
                  case 'Object':
                    if (n[(i = a.util.objId(t))]) return n[i];
                    for (var o in ((r = {}), (n[i] = r), t))
                      t.hasOwnProperty(o) && (r[o] = e(t[o], n));
                    return r;
                  case 'Array':
                    if (n[(i = a.util.objId(t))]) return n[i];
                    return (
                      (r = []),
                      (n[i] = r),
                      t.forEach(function (t, a) {
                        r[a] = e(t, n);
                      }),
                      r
                    );
                  default:
                    return t;
                }
              },
              getLanguage: function (e) {
                for (; e; ) {
                  var n = t.exec(e.className);
                  if (n) return n[1].toLowerCase();
                  e = e.parentElement;
                }
                return 'none';
              },
              setLanguage: function (e, n) {
                (e.className = e.className.replace(RegExp(t, 'gi'), '')),
                  e.classList.add('language-' + n);
              },
              currentScript: function () {
                if ('undefined' == typeof document) return null;
                if (
                  document.currentScript &&
                  'SCRIPT' === document.currentScript.tagName &&
                  1
                )
                  return document.currentScript;
                try {
                  throw Error();
                } catch (r) {
                  var e = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(r.stack) || [])[1];
                  if (e) {
                    var t = document.getElementsByTagName('script');
                    for (var n in t) if (t[n].src == e) return t[n];
                  }
                  return null;
                }
              },
              isActive: function (e, t, n) {
                for (var r = 'no-' + t; e; ) {
                  var a = e.classList;
                  if (a.contains(t)) return !0;
                  if (a.contains(r)) return !1;
                  e = e.parentElement;
                }
                return !!n;
              },
            },
            languages: {
              plain: r,
              plaintext: r,
              text: r,
              txt: r,
              extend: function (e, t) {
                var n = a.util.clone(a.languages[e]);
                for (var r in t) n[r] = t[r];
                return n;
              },
              insertBefore: function (e, t, n, r) {
                var i = (r = r || a.languages)[e],
                  o = {};
                for (var s in i)
                  if (i.hasOwnProperty(s)) {
                    if (s == t) for (var l in n) n.hasOwnProperty(l) && (o[l] = n[l]);
                    n.hasOwnProperty(s) || (o[s] = i[s]);
                  }
                var u = r[e];
                return (
                  (r[e] = o),
                  a.languages.DFS(a.languages, function (t, n) {
                    n === u && t != e && (this[t] = o);
                  }),
                  o
                );
              },
              DFS: function e(t, n, r, i) {
                i = i || {};
                var o = a.util.objId;
                for (var s in t)
                  if (t.hasOwnProperty(s)) {
                    n.call(t, s, t[s], r || s);
                    var l = t[s],
                      u = a.util.type(l);
                    'Object' !== u || i[o(l)]
                      ? 'Array' !== u || i[o(l)] || ((i[o(l)] = !0), e(l, n, s, i))
                      : ((i[o(l)] = !0), e(l, n, null, i));
                  }
              },
            },
            plugins: {},
            highlightAll: function (e, t) {
              a.highlightAllUnder(document, e, t);
            },
            highlightAllUnder: function (e, t, n) {
              var r = {
                callback: n,
                container: e,
                selector:
                  'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code',
              };
              a.hooks.run('before-highlightall', r),
                (r.elements = Array.prototype.slice.apply(
                  r.container.querySelectorAll(r.selector)
                )),
                a.hooks.run('before-all-elements-highlight', r);
              for (var i, o = 0; (i = r.elements[o++]); )
                a.highlightElement(i, !0 === t, r.callback);
            },
            highlightElement: function (t, n, r) {
              var i = a.util.getLanguage(t),
                o = a.languages[i];
              a.util.setLanguage(t, i);
              var s = t.parentElement;
              s && 'pre' === s.nodeName.toLowerCase() && a.util.setLanguage(s, i);
              var l = t.textContent,
                u = { element: t, language: i, grammar: o, code: l };
              function c(e) {
                (u.highlightedCode = e),
                  a.hooks.run('before-insert', u),
                  (u.element.innerHTML = u.highlightedCode),
                  a.hooks.run('after-highlight', u),
                  a.hooks.run('complete', u),
                  r && r.call(u.element);
              }
              if (
                (a.hooks.run('before-sanity-check', u),
                (s = u.element.parentElement) &&
                  'pre' === s.nodeName.toLowerCase() &&
                  !s.hasAttribute('tabindex') &&
                  s.setAttribute('tabindex', '0'),
                !u.code)
              ) {
                a.hooks.run('complete', u), r && r.call(u.element);
                return;
              }
              if ((a.hooks.run('before-highlight', u), !u.grammar))
                return void c(a.util.encode(u.code));
              if (n && e.Worker) {
                var d = new Worker(a.filename);
                (d.onmessage = function (e) {
                  c(e.data);
                }),
                  d.postMessage(
                    JSON.stringify({
                      language: u.language,
                      code: u.code,
                      immediateClose: !0,
                    })
                  );
              } else c(a.highlight(u.code, u.grammar, u.language));
            },
            highlight: function (e, t, n) {
              var r = { code: e, grammar: t, language: n };
              if ((a.hooks.run('before-tokenize', r), !r.grammar))
                throw Error('The language "' + r.language + '" has no grammar.');
              return (
                (r.tokens = a.tokenize(r.code, r.grammar)),
                a.hooks.run('after-tokenize', r),
                i.stringify(a.util.encode(r.tokens), r.language)
              );
            },
            tokenize: function (e, t) {
              var n = t.rest;
              if (n) {
                for (var r in n) t[r] = n[r];
                delete t.rest;
              }
              var u = new s();
              return (
                l(u, u.head, e),
                (function e(t, n, r, s, u, c) {
                  for (var d in r)
                    if (r.hasOwnProperty(d) && r[d]) {
                      var h = r[d];
                      h = Array.isArray(h) ? h : [h];
                      for (var f = 0; f < h.length; ++f) {
                        if (c && c.cause == d + ',' + f) return;
                        var p = h[f],
                          m = p.inside,
                          g = !!p.lookbehind,
                          v = !!p.greedy,
                          x = p.alias;
                        if (v && !p.pattern.global) {
                          var y = p.pattern.toString().match(/[imsuy]*$/)[0];
                          p.pattern = RegExp(p.pattern.source, y + 'g');
                        }
                        for (
                          var b = p.pattern || p, D = s.next, F = u;
                          D !== n.tail && (!c || !(F >= c.reach));
                          F += D.value.length, D = D.next
                        ) {
                          var w,
                            C = D.value;
                          if (n.length > t.length) return;
                          if (!(C instanceof i)) {
                            var j = 1;
                            if (v) {
                              if (!(w = o(b, F, t, g)) || w.index >= t.length) break;
                              var E = w.index,
                                A = w.index + w[0].length,
                                k = F;
                              for (k += D.value.length; E >= k; )
                                k += (D = D.next).value.length;
                              if (((k -= D.value.length), (F = k), D.value instanceof i))
                                continue;
                              for (
                                var S = D;
                                S !== n.tail && (k < A || 'string' == typeof S.value);
                                S = S.next
                              )
                                j++, (k += S.value.length);
                              j--, (C = t.slice(F, k)), (w.index -= F);
                            } else if (!(w = o(b, 0, C, g))) continue;
                            var E = w.index,
                              N = w[0],
                              T = C.slice(0, E),
                              B = C.slice(E + N.length),
                              L = F + C.length;
                            c && L > c.reach && (c.reach = L);
                            var O = D.prev;
                            if (
                              (T && ((O = l(n, O, T)), (F += T.length)),
                              (function (e, t, n) {
                                for (var r = t.next, a = 0; a < n && r !== e.tail; a++)
                                  r = r.next;
                                (t.next = r), (r.prev = t), (e.length -= a);
                              })(n, O, j),
                              (D = l(n, O, new i(d, m ? a.tokenize(N, m) : N, x, N))),
                              B && l(n, D, B),
                              j > 1)
                            ) {
                              var P = { cause: d + ',' + f, reach: L };
                              e(t, n, r, D.prev, F, P),
                                c && P.reach > c.reach && (c.reach = P.reach);
                            }
                          }
                        }
                      }
                    }
                })(e, u, t, u.head, 0),
                (function (e) {
                  for (var t = [], n = e.head.next; n !== e.tail; )
                    t.push(n.value), (n = n.next);
                  return t;
                })(u)
              );
            },
            hooks: {
              all: {},
              add: function (e, t) {
                var n = a.hooks.all;
                (n[e] = n[e] || []), n[e].push(t);
              },
              run: function (e, t) {
                var n = a.hooks.all[e];
                if (n && n.length) for (var r, i = 0; (r = n[i++]); ) r(t);
              },
            },
            Token: i,
          };
        function i(e, t, n, r) {
          (this.type = e),
            (this.content = t),
            (this.alias = n),
            (this.length = 0 | (r || '').length);
        }
        function o(e, t, n, r) {
          e.lastIndex = t;
          var a = e.exec(n);
          if (a && r && a[1]) {
            var i = a[1].length;
            (a.index += i), (a[0] = a[0].slice(i));
          }
          return a;
        }
        function s() {
          var e = { value: null, prev: null, next: null },
            t = { value: null, prev: e, next: null };
          (e.next = t), (this.head = e), (this.tail = t), (this.length = 0);
        }
        function l(e, t, n) {
          var r = t.next,
            a = { value: n, prev: t, next: r };
          return (t.next = a), (r.prev = a), e.length++, a;
        }
        if (
          ((e.Prism = a),
          (i.stringify = function e(t, n) {
            if ('string' == typeof t) return t;
            if (Array.isArray(t)) {
              var r = '';
              return (
                t.forEach(function (t) {
                  r += e(t, n);
                }),
                r
              );
            }
            var i = {
                type: t.type,
                content: e(t.content, n),
                tag: 'span',
                classes: ['token', t.type],
                attributes: {},
                language: n,
              },
              o = t.alias;
            o &&
              (Array.isArray(o)
                ? Array.prototype.push.apply(i.classes, o)
                : i.classes.push(o)),
              a.hooks.run('wrap', i);
            var s = '';
            for (var l in i.attributes)
              s += ' ' + l + '="' + (i.attributes[l] || '').replace(/"/g, '&quot;') + '"';
            return (
              '<' +
              i.tag +
              ' class="' +
              i.classes.join(' ') +
              '"' +
              s +
              '>' +
              i.content +
              '</' +
              i.tag +
              '>'
            );
          }),
          !e.document)
        )
          return (
            e.addEventListener &&
              (a.disableWorkerMessageHandler ||
                e.addEventListener(
                  'message',
                  function (t) {
                    var n = JSON.parse(t.data),
                      r = n.language,
                      i = n.code,
                      o = n.immediateClose;
                    e.postMessage(a.highlight(i, a.languages[r], r)), o && e.close();
                  },
                  !1
                )),
            a
          );
        var u = a.util.currentScript();
        function c() {
          a.manual || a.highlightAll();
        }
        if (
          (u && ((a.filename = u.src), u.hasAttribute('data-manual') && (a.manual = !0)),
          !a.manual)
        ) {
          var d = document.readyState;
          'loading' === d || ('interactive' === d && u && u.defer)
            ? document.addEventListener('DOMContentLoaded', c)
            : window.requestAnimationFrame
              ? window.requestAnimationFrame(c)
              : window.setTimeout(c, 16);
        }
        return a;
      })(
        'undefined' != typeof window
          ? window
          : 'undefined' != typeof WorkerGlobalScope && self instanceof WorkerGlobalScope
            ? self
            : {}
      );
      e.exports && (e.exports = r), void 0 !== n.g && (n.g.Prism = r);
    },
    7265: function (e, t, n) {
      'use strict';
      var r = n(3034);
      function a() {}
      function i() {}
      (i.resetWarningCache = a),
        (e.exports = function () {
          function e(e, t, n, a, i, o) {
            if (o !== r) {
              var s = Error(
                'Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types'
              );
              throw ((s.name = 'Invariant Violation'), s);
            }
          }
          function t() {
            return e;
          }
          e.isRequired = e;
          var n = {
            array: e,
            bigint: e,
            bool: e,
            func: e,
            number: e,
            object: e,
            string: e,
            symbol: e,
            any: e,
            arrayOf: t,
            element: e,
            elementType: e,
            instanceOf: t,
            node: e,
            objectOf: t,
            oneOf: t,
            oneOfType: t,
            shape: t,
            exact: t,
            checkPropTypes: i,
            resetWarningCache: a,
          };
          return (n.PropTypes = n), n;
        });
    },
    5821: function (e, t, n) {
      e.exports = n(7265)();
    },
    3034: function (e) {
      'use strict';
      e.exports = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';
    },
    4352: function (e, t, n) {
      'use strict';
      var r = n(3912),
        a = n(5898),
        i = n(178),
        o = 'data';
      e.exports = function (e, t) {
        var n,
          h,
          f,
          p = r(t),
          m = t,
          g = i;
        return p in e.normal
          ? e.property[e.normal[p]]
          : (p.length > 4 &&
              p.slice(0, 4) === o &&
              s.test(t) &&
              ('-' === t.charAt(4)
                ? (m =
                    o +
                    (n = t.slice(5).replace(l, d)).charAt(0).toUpperCase() +
                    n.slice(1))
                : ((f = (h = t).slice(4)),
                  (t = l.test(f)
                    ? h
                    : ('-' !== (f = f.replace(u, c)).charAt(0) && (f = '-' + f), o + f))),
              (g = a)),
            new g(m, t));
      };
      var s = /^data[-\w.:]+$/i,
        l = /-[a-z]/g,
        u = /[A-Z]/g;
      function c(e) {
        return '-' + e.toLowerCase();
      }
      function d(e) {
        return e.charAt(1).toUpperCase();
      }
    },
    3622: function (e, t, n) {
      'use strict';
      var r = n(1088),
        a = n(4775);
      e.exports = r([n(4690), a, n(7005), n(6678), n(7558)]);
    },
    6678: function (e, t, n) {
      'use strict';
      var r = n(6249),
        a = n(4282),
        i = r.booleanish,
        o = r.number,
        s = r.spaceSeparated;
      e.exports = a({
        transform: function (e, t) {
          return 'role' === t ? t : 'aria-' + t.slice(4).toLowerCase();
        },
        properties: {
          ariaActiveDescendant: null,
          ariaAtomic: i,
          ariaAutoComplete: null,
          ariaBusy: i,
          ariaChecked: i,
          ariaColCount: o,
          ariaColIndex: o,
          ariaColSpan: o,
          ariaControls: s,
          ariaCurrent: null,
          ariaDescribedBy: s,
          ariaDetails: null,
          ariaDisabled: i,
          ariaDropEffect: s,
          ariaErrorMessage: null,
          ariaExpanded: i,
          ariaFlowTo: s,
          ariaGrabbed: i,
          ariaHasPopup: null,
          ariaHidden: i,
          ariaInvalid: null,
          ariaKeyShortcuts: null,
          ariaLabel: null,
          ariaLabelledBy: s,
          ariaLevel: o,
          ariaLive: null,
          ariaModal: i,
          ariaMultiLine: i,
          ariaMultiSelectable: i,
          ariaOrientation: null,
          ariaOwns: s,
          ariaPlaceholder: null,
          ariaPosInSet: o,
          ariaPressed: i,
          ariaReadOnly: i,
          ariaRelevant: null,
          ariaRequired: i,
          ariaRoleDescription: s,
          ariaRowCount: o,
          ariaRowIndex: o,
          ariaRowSpan: o,
          ariaSelected: i,
          ariaSetSize: o,
          ariaSort: null,
          ariaValueMax: o,
          ariaValueMin: o,
          ariaValueNow: o,
          ariaValueText: null,
          role: null,
        },
      });
    },
    7558: function (e, t, n) {
      'use strict';
      var r = n(6249),
        a = n(4282),
        i = n(9363),
        o = r.boolean,
        s = r.overloadedBoolean,
        l = r.booleanish,
        u = r.number,
        c = r.spaceSeparated,
        d = r.commaSeparated;
      e.exports = a({
        space: 'html',
        attributes: {
          acceptcharset: 'accept-charset',
          classname: 'class',
          htmlfor: 'for',
          httpequiv: 'http-equiv',
        },
        transform: i,
        mustUseProperty: ['checked', 'multiple', 'muted', 'selected'],
        properties: {
          abbr: null,
          accept: d,
          acceptCharset: c,
          accessKey: c,
          action: null,
          allow: null,
          allowFullScreen: o,
          allowPaymentRequest: o,
          allowUserMedia: o,
          alt: null,
          as: null,
          async: o,
          autoCapitalize: null,
          autoComplete: c,
          autoFocus: o,
          autoPlay: o,
          capture: o,
          charSet: null,
          checked: o,
          cite: null,
          className: c,
          cols: u,
          colSpan: null,
          content: null,
          contentEditable: l,
          controls: o,
          controlsList: c,
          coords: u | d,
          crossOrigin: null,
          data: null,
          dateTime: null,
          decoding: null,
          default: o,
          defer: o,
          dir: null,
          dirName: null,
          disabled: o,
          download: s,
          draggable: l,
          encType: null,
          enterKeyHint: null,
          form: null,
          formAction: null,
          formEncType: null,
          formMethod: null,
          formNoValidate: o,
          formTarget: null,
          headers: c,
          height: u,
          hidden: o,
          high: u,
          href: null,
          hrefLang: null,
          htmlFor: c,
          httpEquiv: c,
          id: null,
          imageSizes: null,
          imageSrcSet: d,
          inputMode: null,
          integrity: null,
          is: null,
          isMap: o,
          itemId: null,
          itemProp: c,
          itemRef: c,
          itemScope: o,
          itemType: c,
          kind: null,
          label: null,
          lang: null,
          language: null,
          list: null,
          loading: null,
          loop: o,
          low: u,
          manifest: null,
          max: null,
          maxLength: u,
          media: null,
          method: null,
          min: null,
          minLength: u,
          multiple: o,
          muted: o,
          name: null,
          nonce: null,
          noModule: o,
          noValidate: o,
          onAbort: null,
          onAfterPrint: null,
          onAuxClick: null,
          onBeforePrint: null,
          onBeforeUnload: null,
          onBlur: null,
          onCancel: null,
          onCanPlay: null,
          onCanPlayThrough: null,
          onChange: null,
          onClick: null,
          onClose: null,
          onContextMenu: null,
          onCopy: null,
          onCueChange: null,
          onCut: null,
          onDblClick: null,
          onDrag: null,
          onDragEnd: null,
          onDragEnter: null,
          onDragExit: null,
          onDragLeave: null,
          onDragOver: null,
          onDragStart: null,
          onDrop: null,
          onDurationChange: null,
          onEmptied: null,
          onEnded: null,
          onError: null,
          onFocus: null,
          onFormData: null,
          onHashChange: null,
          onInput: null,
          onInvalid: null,
          onKeyDown: null,
          onKeyPress: null,
          onKeyUp: null,
          onLanguageChange: null,
          onLoad: null,
          onLoadedData: null,
          onLoadedMetadata: null,
          onLoadEnd: null,
          onLoadStart: null,
          onMessage: null,
          onMessageError: null,
          onMouseDown: null,
          onMouseEnter: null,
          onMouseLeave: null,
          onMouseMove: null,
          onMouseOut: null,
          onMouseOver: null,
          onMouseUp: null,
          onOffline: null,
          onOnline: null,
          onPageHide: null,
          onPageShow: null,
          onPaste: null,
          onPause: null,
          onPlay: null,
          onPlaying: null,
          onPopState: null,
          onProgress: null,
          onRateChange: null,
          onRejectionHandled: null,
          onReset: null,
          onResize: null,
          onScroll: null,
          onSecurityPolicyViolation: null,
          onSeeked: null,
          onSeeking: null,
          onSelect: null,
          onSlotChange: null,
          onStalled: null,
          onStorage: null,
          onSubmit: null,
          onSuspend: null,
          onTimeUpdate: null,
          onToggle: null,
          onUnhandledRejection: null,
          onUnload: null,
          onVolumeChange: null,
          onWaiting: null,
          onWheel: null,
          open: o,
          optimum: u,
          pattern: null,
          ping: c,
          placeholder: null,
          playsInline: o,
          poster: null,
          preload: null,
          readOnly: o,
          referrerPolicy: null,
          rel: c,
          required: o,
          reversed: o,
          rows: u,
          rowSpan: u,
          sandbox: c,
          scope: null,
          scoped: o,
          seamless: o,
          selected: o,
          shape: null,
          size: u,
          sizes: null,
          slot: null,
          span: u,
          spellCheck: l,
          src: null,
          srcDoc: null,
          srcLang: null,
          srcSet: d,
          start: u,
          step: null,
          style: null,
          tabIndex: u,
          target: null,
          title: null,
          translate: null,
          type: null,
          typeMustMatch: o,
          useMap: null,
          value: l,
          width: u,
          wrap: null,
          align: null,
          aLink: null,
          archive: c,
          axis: null,
          background: null,
          bgColor: null,
          border: u,
          borderColor: null,
          bottomMargin: u,
          cellPadding: null,
          cellSpacing: null,
          char: null,
          charOff: null,
          classId: null,
          clear: null,
          code: null,
          codeBase: null,
          codeType: null,
          color: null,
          compact: o,
          declare: o,
          event: null,
          face: null,
          frame: null,
          frameBorder: null,
          hSpace: u,
          leftMargin: u,
          link: null,
          longDesc: null,
          lowSrc: null,
          marginHeight: u,
          marginWidth: u,
          noResize: o,
          noHref: o,
          noShade: o,
          noWrap: o,
          object: null,
          profile: null,
          prompt: null,
          rev: null,
          rightMargin: u,
          rules: null,
          scheme: null,
          scrolling: l,
          standby: null,
          summary: null,
          text: null,
          topMargin: u,
          valueType: null,
          version: null,
          vAlign: null,
          vLink: null,
          vSpace: u,
          allowTransparency: null,
          autoCorrect: null,
          autoSave: null,
          disablePictureInPicture: o,
          disableRemotePlayback: o,
          prefix: null,
          property: null,
          results: u,
          security: null,
          unselectable: null,
        },
      });
    },
    9363: function (e, t, n) {
      'use strict';
      var r = n(7426);
      e.exports = function (e, t) {
        return r(e, t.toLowerCase());
      };
    },
    7426: function (e) {
      'use strict';
      e.exports = function (e, t) {
        return t in e ? e[t] : t;
      };
    },
    4282: function (e, t, n) {
      'use strict';
      var r = n(3912),
        a = n(9805),
        i = n(5898);
      e.exports = function (e) {
        var t,
          n,
          o = e.space,
          s = e.mustUseProperty || [],
          l = e.attributes || {},
          u = e.properties,
          c = e.transform,
          d = {},
          h = {};
        for (t in u)
          (n = new i(t, c(l, t), u[t], o)),
            -1 !== s.indexOf(t) && (n.mustUseProperty = !0),
            (d[t] = n),
            (h[r(t)] = t),
            (h[r(n.attribute)] = t);
        return new a(d, h, o);
      };
    },
    5898: function (e, t, n) {
      'use strict';
      var r = n(178),
        a = n(6249);
      (e.exports = s), (s.prototype = new r()), (s.prototype.defined = !0);
      var i = [
          'boolean',
          'booleanish',
          'overloadedBoolean',
          'number',
          'commaSeparated',
          'spaceSeparated',
          'commaOrSpaceSeparated',
        ],
        o = i.length;
      function s(e, t, n, s) {
        var l,
          u,
          c,
          d,
          h,
          f,
          p = -1;
        for (l = this, (u = s) && (l.space = u), r.call(this, e, t); ++p < o; ) {
          (c = this), (d = f = i[p]), (h = (n & a[f]) === a[f]) && (c[d] = h);
        }
      }
    },
    178: function (e) {
      'use strict';
      e.exports = n;
      var t = n.prototype;
      function n(e, t) {
        (this.property = e), (this.attribute = t);
      }
      (t.space = null),
        (t.attribute = null),
        (t.property = null),
        (t.boolean = !1),
        (t.booleanish = !1),
        (t.overloadedBoolean = !1),
        (t.number = !1),
        (t.commaSeparated = !1),
        (t.spaceSeparated = !1),
        (t.commaOrSpaceSeparated = !1),
        (t.mustUseProperty = !1),
        (t.defined = !1);
    },
    1088: function (e, t, n) {
      'use strict';
      var r = n(5918),
        a = n(9805);
      e.exports = function (e) {
        for (var t, n, i = e.length, o = [], s = [], l = -1; ++l < i; )
          (t = e[l]), o.push(t.property), s.push(t.normal), (n = t.space);
        return new a(r.apply(null, o), r.apply(null, s), n);
      };
    },
    9805: function (e) {
      'use strict';
      e.exports = n;
      var t = n.prototype;
      function n(e, t, n) {
        (this.property = e), (this.normal = t), n && (this.space = n);
      }
      (t.space = null), (t.normal = {}), (t.property = {});
    },
    6249: function (e, t) {
      'use strict';
      var n = 0;
      function r() {
        return Math.pow(2, ++n);
      }
      (t.boolean = r()),
        (t.booleanish = r()),
        (t.overloadedBoolean = r()),
        (t.number = r()),
        (t.spaceSeparated = r()),
        (t.commaSeparated = r()),
        (t.commaOrSpaceSeparated = r());
    },
    4775: function (e, t, n) {
      'use strict';
      e.exports = n(4282)({
        space: 'xlink',
        transform: function (e, t) {
          return 'xlink:' + t.slice(5).toLowerCase();
        },
        properties: {
          xLinkActuate: null,
          xLinkArcRole: null,
          xLinkHref: null,
          xLinkRole: null,
          xLinkShow: null,
          xLinkTitle: null,
          xLinkType: null,
        },
      });
    },
    4690: function (e, t, n) {
      'use strict';
      e.exports = n(4282)({
        space: 'xml',
        transform: function (e, t) {
          return 'xml:' + t.slice(3).toLowerCase();
        },
        properties: { xmlLang: null, xmlBase: null, xmlSpace: null },
      });
    },
    7005: function (e, t, n) {
      'use strict';
      e.exports = n(4282)({
        space: 'xmlns',
        attributes: { xmlnsxlink: 'xmlns:xlink' },
        transform: n(9363),
        properties: { xmlns: null, xmlnsXLink: null },
      });
    },
    3912: function (e) {
      'use strict';
      e.exports = function (e) {
        return e.toLowerCase();
      };
    },
    8727: function (e) {
      var t = 'undefined' != typeof Element,
        n = 'function' == typeof Map,
        r = 'function' == typeof Set,
        a = 'function' == typeof ArrayBuffer && !!ArrayBuffer.isView;
      e.exports = function (e, i) {
        try {
          return (function e(i, o) {
            if (i === o) return !0;
            if (i && o && 'object' == typeof i && 'object' == typeof o) {
              var s, l, u, c;
              if (i.constructor !== o.constructor) return !1;
              if (Array.isArray(i)) {
                if ((s = i.length) != o.length) return !1;
                for (l = s; 0 != l--; ) if (!e(i[l], o[l])) return !1;
                return !0;
              }
              if (n && i instanceof Map && o instanceof Map) {
                if (i.size !== o.size) return !1;
                for (c = i.entries(); !(l = c.next()).done; )
                  if (!o.has(l.value[0])) return !1;
                for (c = i.entries(); !(l = c.next()).done; )
                  if (!e(l.value[1], o.get(l.value[0]))) return !1;
                return !0;
              }
              if (r && i instanceof Set && o instanceof Set) {
                if (i.size !== o.size) return !1;
                for (c = i.entries(); !(l = c.next()).done; )
                  if (!o.has(l.value[0])) return !1;
                return !0;
              }
              if (a && ArrayBuffer.isView(i) && ArrayBuffer.isView(o)) {
                if ((s = i.length) != o.length) return !1;
                for (l = s; 0 != l--; ) if (i[l] !== o[l]) return !1;
                return !0;
              }
              if (i.constructor === RegExp)
                return i.source === o.source && i.flags === o.flags;
              if (
                i.valueOf !== Object.prototype.valueOf &&
                'function' == typeof i.valueOf &&
                'function' == typeof o.valueOf
              )
                return i.valueOf() === o.valueOf();
              if (
                i.toString !== Object.prototype.toString &&
                'function' == typeof i.toString &&
                'function' == typeof o.toString
              )
                return i.toString() === o.toString();
              if ((s = (u = Object.keys(i)).length) !== Object.keys(o).length) return !1;
              for (l = s; 0 != l--; )
                if (!Object.prototype.hasOwnProperty.call(o, u[l])) return !1;
              if (t && i instanceof Element) return !1;
              for (l = s; 0 != l--; )
                if (
                  (('_owner' !== u[l] && '__v' !== u[l] && '__o' !== u[l]) ||
                    !i.$$typeof) &&
                  !e(i[u[l]], o[u[l]])
                )
                  return !1;
              return !0;
            }
            return i != i && o != o;
          })(e, i);
        } catch (e) {
          if ((e.message || '').match(/stack|recursion/i))
            return console.warn('react-fast-compare cannot handle circular refs'), !1;
          throw e;
        }
      };
    },
    8269: function (e, t, n) {
      'use strict';
      t.lazyWithPreload = void 0;
      var r = n(2155);
      t.lazyWithPreload = function (e) {
        var t,
          n,
          a = (0, r.lazy)(e),
          i = (0, r.forwardRef)(function (e, n) {
            var i = (0, r.useRef)(null != t ? t : a);
            return (0, r.createElement)(i.current, Object.assign(n ? { ref: n } : {}, e));
          });
        return (
          (i.preload = function () {
            return (
              n ||
                (n = e().then(function (e) {
                  return (t = e.default);
                })),
              n
            );
          }),
          i
        );
      };
    },
    2068: function (e, t, n) {
      'use strict';
      var r = n(9402);
      (t.default = void 0), (t.default = r(n(317)).default);
    },
    8509: function (e, t, n) {
      'use strict';
      var r = n(9402);
      (t.default = void 0), (t.default = r(n(2827)).default);
    },
    429: function (e, t, n) {
      'use strict';
      var r = n(9402);
      (t.default = void 0), (t.default = r(n(7687)).default);
    },
    8823: function (e, t, n) {
      'use strict';
      var r = n(9402);
      (t.default = void 0), (t.default = r(n(285)).default);
    },
    815: function (e, t, n) {
      'use strict';
      var r = n(9402);
      (t.default = void 0), (t.default = r(n(3049)).default);
    },
    9984: function (e, t, n) {
      'use strict';
      var r,
        a,
        i =
          'object' == typeof globalThis
            ? globalThis
            : 'object' == typeof self
              ? self
              : 'object' == typeof window
                ? window
                : 'object' == typeof n.g
                  ? n.g
                  : {},
        o =
          ((a = (r = 'Prism' in i) ? i.Prism : void 0),
          function () {
            r ? (i.Prism = a) : delete i.Prism, (r = void 0), (a = void 0);
          });
      i.Prism = { manual: !0, disableWorkerMessageHandler: !0 };
      var s = n(8632),
        l = n(2516),
        u = n(5398),
        c = n(8078),
        d = n(3191),
        h = n(1562),
        f = n(317);
      o();
      var p = {}.hasOwnProperty;
      function m() {}
      m.prototype = u;
      var g = new m();
      function v(e) {
        if ('function' != typeof e || !e.displayName)
          throw Error('Expected `function` for `grammar`, got `' + e + '`');
        void 0 === g.languages[e.displayName] && e(g);
      }
      (e.exports = g),
        (g.highlight = function (e, t) {
          var n,
            r = u.highlight;
          if ('string' != typeof e)
            throw Error('Expected `string` for `value`, got `' + e + '`');
          if ('Object' === g.util.type(t)) (n = t), (t = null);
          else {
            if ('string' != typeof t)
              throw Error('Expected `string` for `name`, got `' + t + '`');
            if (p.call(g.languages, t)) n = g.languages[t];
            else throw Error('Unknown language: `' + t + '` is not registered');
          }
          return r.call(this, e, n, t);
        }),
        (g.register = v),
        (g.alias = function (e, t) {
          var n,
            r,
            a,
            i,
            o = g.languages,
            s = e;
          for (n in (t && ((s = {})[e] = t), s))
            for (
              a = (r = 'string' == typeof (r = s[n]) ? [r] : r).length, i = -1;
              ++i < a;

            )
              o[r[i]] = o[n];
        }),
        (g.registered = function (e) {
          if ('string' != typeof e)
            throw Error('Expected `string` for `language`, got `' + e + '`');
          return p.call(g.languages, e);
        }),
        (g.listLanguages = function () {
          var e,
            t = g.languages,
            n = [];
          for (e in t) p.call(t, e) && 'object' == typeof t[e] && n.push(e);
          return n;
        }),
        v(c),
        v(d),
        v(h),
        v(f),
        (g.util.encode = function (e) {
          return e;
        }),
        (g.Token.stringify = function (e, t, n) {
          var r;
          return 'string' == typeof e
            ? { type: 'text', value: e }
            : 'Array' === g.util.type(e)
              ? (function (e, t) {
                  for (var n, r = [], a = e.length, i = -1; ++i < a; )
                    '' !== (n = e[i]) && null != n && r.push(n);
                  for (i = -1, a = r.length; ++i < a; )
                    (n = r[i]), (r[i] = g.Token.stringify(n, t, r));
                  return r;
                })(e, t)
              : ((r = {
                  type: e.type,
                  content: g.Token.stringify(e.content, t, n),
                  tag: 'span',
                  classes: ['token', e.type],
                  attributes: {},
                  language: t,
                  parent: n,
                }),
                e.alias && (r.classes = r.classes.concat(e.alias)),
                g.hooks.run('wrap', r),
                s(
                  r.tag + '.' + r.classes.join('.'),
                  (function (e) {
                    var t;
                    for (t in e) e[t] = l(e[t]);
                    return e;
                  })(r.attributes),
                  r.content
                ));
        });
    },
    1562: function (e) {
      'use strict';
      function t(e) {
        e.languages.clike = {
          comment: [
            { pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/, lookbehind: !0, greedy: !0 },
            { pattern: /(^|[^\\:])\/\/.*/, lookbehind: !0, greedy: !0 },
          ],
          string: {
            pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
            greedy: !0,
          },
          'class-name': {
            pattern:
              /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
            lookbehind: !0,
            inside: { punctuation: /[.\\]/ },
          },
          keyword:
            /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
          boolean: /\b(?:false|true)\b/,
          function: /\b\w+(?=\()/,
          number: /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
          operator: /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
          punctuation: /[{}[\];(),.:]/,
        };
      }
      (e.exports = t), (t.displayName = 'clike'), (t.aliases = []);
    },
    3191: function (e) {
      'use strict';
      function t(e) {
        var t, n;
        (t =
          /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/),
          (e.languages.css = {
            comment: /\/\*[\s\S]*?\*\//,
            atrule: {
              pattern: /@[\w-](?:[^;{\s]|\s+(?![\s{]))*(?:;|(?=\s*\{))/,
              inside: {
                rule: /^@[\w-]+/,
                'selector-function-argument': {
                  pattern:
                    /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
                  lookbehind: !0,
                  alias: 'selector',
                },
                keyword: {
                  pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
                  lookbehind: !0,
                },
              },
            },
            url: {
              pattern: RegExp(
                '\\burl\\((?:' +
                  t.source +
                  '|' +
                  /(?:[^\\\r\n()"']|\\[\s\S])*/.source +
                  ')\\)',
                'i'
              ),
              greedy: !0,
              inside: {
                function: /^url/i,
                punctuation: /^\(|\)$/,
                string: { pattern: RegExp('^' + t.source + '$'), alias: 'url' },
              },
            },
            selector: {
              pattern: RegExp(
                '(^|[{}\\s])[^{}\\s](?:[^{};"\'\\s]|\\s+(?![\\s{])|' +
                  t.source +
                  ')*(?=\\s*\\{)'
              ),
              lookbehind: !0,
            },
            string: { pattern: t, greedy: !0 },
            property: {
              pattern:
                /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
              lookbehind: !0,
            },
            important: /!important\b/i,
            function: { pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i, lookbehind: !0 },
            punctuation: /[(){};:,]/,
          }),
          (e.languages.css.atrule.inside.rest = e.languages.css),
          (n = e.languages.markup) &&
            (n.tag.addInlined('style', 'css'), n.tag.addAttribute('style', 'css'));
      }
      (e.exports = t), (t.displayName = 'css'), (t.aliases = []);
    },
    317: function (e) {
      'use strict';
      function t(e) {
        (e.languages.javascript = e.languages.extend('clike', {
          'class-name': [
            e.languages.clike['class-name'],
            {
              pattern:
                /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
              lookbehind: !0,
            },
          ],
          keyword: [
            { pattern: /((?:^|\})\s*)catch\b/, lookbehind: !0 },
            {
              pattern:
                /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
              lookbehind: !0,
            },
          ],
          function:
            /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
          number: {
            pattern: RegExp(
              /(^|[^\w$])/.source +
                '(?:' +
                (/NaN|Infinity/.source +
                  '|' +
                  /0[bB][01]+(?:_[01]+)*n?/.source +
                  '|' +
                  /0[oO][0-7]+(?:_[0-7]+)*n?/.source +
                  '|' +
                  /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source +
                  '|' +
                  /\d+(?:_\d+)*n/.source) +
                '|' +
                /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/
                  .source +
                ')' +
                /(?![\w$])/.source
            ),
            lookbehind: !0,
          },
          operator:
            /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/,
        })),
          (e.languages.javascript['class-name'][0].pattern =
            /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/),
          e.languages.insertBefore('javascript', 'keyword', {
            regex: {
              pattern:
                /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)\/(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/,
              lookbehind: !0,
              greedy: !0,
              inside: {
                'regex-source': {
                  pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
                  lookbehind: !0,
                  alias: 'language-regex',
                  inside: e.languages.regex,
                },
                'regex-delimiter': /^\/|\/$/,
                'regex-flags': /^[a-z]+$/,
              },
            },
            'function-variable': {
              pattern:
                /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
              alias: 'function',
            },
            parameter: [
              {
                pattern:
                  /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
                lookbehind: !0,
                inside: e.languages.javascript,
              },
              {
                pattern:
                  /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
                lookbehind: !0,
                inside: e.languages.javascript,
              },
              {
                pattern:
                  /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
                lookbehind: !0,
                inside: e.languages.javascript,
              },
              {
                pattern:
                  /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
                lookbehind: !0,
                inside: e.languages.javascript,
              },
            ],
            constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/,
          }),
          e.languages.insertBefore('javascript', 'string', {
            hashbang: { pattern: /^#!.*/, greedy: !0, alias: 'comment' },
            'template-string': {
              pattern:
                /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
              greedy: !0,
              inside: {
                'template-punctuation': { pattern: /^`|`$/, alias: 'string' },
                interpolation: {
                  pattern:
                    /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
                  lookbehind: !0,
                  inside: {
                    'interpolation-punctuation': {
                      pattern: /^\$\{|\}$/,
                      alias: 'punctuation',
                    },
                    rest: e.languages.javascript,
                  },
                },
                string: /[\s\S]+/,
              },
            },
            'string-property': {
              pattern:
                /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
              lookbehind: !0,
              greedy: !0,
              alias: 'property',
            },
          }),
          e.languages.insertBefore('javascript', 'operator', {
            'literal-property': {
              pattern:
                /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
              lookbehind: !0,
              alias: 'property',
            },
          }),
          e.languages.markup &&
            (e.languages.markup.tag.addInlined('script', 'javascript'),
            e.languages.markup.tag.addAttribute(
              /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/
                .source,
              'javascript'
            )),
          (e.languages.js = e.languages.javascript);
      }
      (e.exports = t), (t.displayName = 'javascript'), (t.aliases = ['js']);
    },
    2889: function (e) {
      'use strict';
      function t(e) {
        !(function (e) {
          var t = e.util.clone(e.languages.javascript),
            n = /(?:\s|\/\/.*(?!.)|\/\*(?:[^*]|\*(?!\/))\*\/)/.source,
            r = /(?:\{(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])*\})/.source,
            a = /(?:\{<S>*\.{3}(?:[^{}]|<BRACES>)*\})/.source;
          function i(e, t) {
            return RegExp(
              (e = e
                .replace(/<S>/g, function () {
                  return n;
                })
                .replace(/<BRACES>/g, function () {
                  return r;
                })
                .replace(/<SPREAD>/g, function () {
                  return a;
                })),
              t
            );
          }
          (a = i(a).source),
            (e.languages.jsx = e.languages.extend('markup', t)),
            (e.languages.jsx.tag.pattern = i(
              /<\/?(?:[\w.:-]+(?:<S>+(?:[\w.:$-]+(?:=(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s{'"/>=]+|<BRACES>))?|<SPREAD>))*<S>*\/?)?>/
                .source
            )),
            (e.languages.jsx.tag.inside.tag.pattern = /^<\/?[^\s>\/]*/),
            (e.languages.jsx.tag.inside['attr-value'].pattern =
              /=(?!\{)(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s'">]+)/),
            (e.languages.jsx.tag.inside.tag.inside['class-name'] =
              /^[A-Z]\w*(?:\.[A-Z]\w*)*$/),
            (e.languages.jsx.tag.inside.comment = t.comment),
            e.languages.insertBefore(
              'inside',
              'attr-name',
              { spread: { pattern: i(/<SPREAD>/.source), inside: e.languages.jsx } },
              e.languages.jsx.tag
            ),
            e.languages.insertBefore(
              'inside',
              'special-attr',
              {
                script: {
                  pattern: i(/=<BRACES>/.source),
                  alias: 'language-javascript',
                  inside: {
                    'script-punctuation': { pattern: /^=(?=\{)/, alias: 'punctuation' },
                    rest: e.languages.jsx,
                  },
                },
              },
              e.languages.jsx.tag
            );
          var o = function (e) {
              return e
                ? 'string' == typeof e
                  ? e
                  : 'string' == typeof e.content
                    ? e.content
                    : e.content.map(o).join('')
                : '';
            },
            s = function (t) {
              for (var n = [], r = 0; r < t.length; r++) {
                var a = t[r],
                  i = !1;
                if (
                  ('string' != typeof a &&
                    ('tag' === a.type && a.content[0] && 'tag' === a.content[0].type
                      ? '</' === a.content[0].content[0].content
                        ? n.length > 0 &&
                          n[n.length - 1].tagName === o(a.content[0].content[1]) &&
                          n.pop()
                        : '/>' === a.content[a.content.length - 1].content ||
                          n.push({ tagName: o(a.content[0].content[1]), openedBraces: 0 })
                      : n.length > 0 && 'punctuation' === a.type && '{' === a.content
                        ? n[n.length - 1].openedBraces++
                        : n.length > 0 &&
                            n[n.length - 1].openedBraces > 0 &&
                            'punctuation' === a.type &&
                            '}' === a.content
                          ? n[n.length - 1].openedBraces--
                          : (i = !0)),
                  (i || 'string' == typeof a) &&
                    n.length > 0 &&
                    0 === n[n.length - 1].openedBraces)
                ) {
                  var l = o(a);
                  r < t.length - 1 &&
                    ('string' == typeof t[r + 1] || 'plain-text' === t[r + 1].type) &&
                    ((l += o(t[r + 1])), t.splice(r + 1, 1)),
                    r > 0 &&
                      ('string' == typeof t[r - 1] || 'plain-text' === t[r - 1].type) &&
                      ((l = o(t[r - 1]) + l), t.splice(r - 1, 1), r--),
                    (t[r] = new e.Token('plain-text', l, null, l));
                }
                a.content && 'string' != typeof a.content && s(a.content);
              }
            };
          e.hooks.add('after-tokenize', function (e) {
            ('jsx' === e.language || 'tsx' === e.language) && s(e.tokens);
          });
        })(e);
      }
      (e.exports = t), (t.displayName = 'jsx'), (t.aliases = []);
    },
    2827: function (e) {
      'use strict';
      function t(e) {
        !(function (e) {
          var t = /(?:\\.|[^\\\n\r]|(?:\n|\r\n?)(?![\r\n]))/.source;
          function n(e) {
            return (
              (e = e.replace(/<inner>/g, function () {
                return t;
              })),
              RegExp(/((?:^|[^\\])(?:\\{2})*)/.source + '(?:' + e + ')')
            );
          }
          var r = /(?:\\.|``(?:[^`\r\n]|`(?!`))+``|`[^`\r\n]+`|[^\\|\r\n`])+/.source,
            a = /\|?__(?:\|__)+\|?(?:(?:\n|\r\n?)|(?![\s\S]))/.source.replace(
              /__/g,
              function () {
                return r;
              }
            ),
            i = /\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?(?:\n|\r\n?)/
              .source;
          (e.languages.markdown = e.languages.extend('markup', {})),
            e.languages.insertBefore('markdown', 'prolog', {
              'front-matter-block': {
                pattern: /(^(?:\s*[\r\n])?)---(?!.)[\s\S]*?[\r\n]---(?!.)/,
                lookbehind: !0,
                greedy: !0,
                inside: {
                  punctuation: /^---|---$/,
                  'front-matter': {
                    pattern: /\S+(?:\s+\S+)*/,
                    alias: ['yaml', 'language-yaml'],
                    inside: e.languages.yaml,
                  },
                },
              },
              blockquote: { pattern: /^>(?:[\t ]*>)*/m, alias: 'punctuation' },
              table: {
                pattern: RegExp('^' + a + i + '(?:' + a + ')*', 'm'),
                inside: {
                  'table-data-rows': {
                    pattern: RegExp('^(' + a + i + ')(?:' + a + ')*$'),
                    lookbehind: !0,
                    inside: {
                      'table-data': { pattern: RegExp(r), inside: e.languages.markdown },
                      punctuation: /\|/,
                    },
                  },
                  'table-line': {
                    pattern: RegExp('^(' + a + ')' + i + '$'),
                    lookbehind: !0,
                    inside: { punctuation: /\||:?-{3,}:?/ },
                  },
                  'table-header-row': {
                    pattern: RegExp('^' + a + '$'),
                    inside: {
                      'table-header': {
                        pattern: RegExp(r),
                        alias: 'important',
                        inside: e.languages.markdown,
                      },
                      punctuation: /\|/,
                    },
                  },
                },
              },
              code: [
                {
                  pattern:
                    /((?:^|\n)[ \t]*\n|(?:^|\r\n?)[ \t]*\r\n?)(?: {4}|\t).+(?:(?:\n|\r\n?)(?: {4}|\t).+)*/,
                  lookbehind: !0,
                  alias: 'keyword',
                },
                {
                  pattern: /^```[\s\S]*?^```$/m,
                  greedy: !0,
                  inside: {
                    'code-block': {
                      pattern: /^(```.*(?:\n|\r\n?))[\s\S]+?(?=(?:\n|\r\n?)^```$)/m,
                      lookbehind: !0,
                    },
                    'code-language': { pattern: /^(```).+/, lookbehind: !0 },
                    punctuation: /```/,
                  },
                },
              ],
              title: [
                {
                  pattern: /\S.*(?:\n|\r\n?)(?:==+|--+)(?=[ \t]*$)/m,
                  alias: 'important',
                  inside: { punctuation: /==+$|--+$/ },
                },
                {
                  pattern: /(^\s*)#.+/m,
                  lookbehind: !0,
                  alias: 'important',
                  inside: { punctuation: /^#+|#+$/ },
                },
              ],
              hr: {
                pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
                lookbehind: !0,
                alias: 'punctuation',
              },
              list: {
                pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
                lookbehind: !0,
                alias: 'punctuation',
              },
              'url-reference': {
                pattern:
                  /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
                inside: {
                  variable: { pattern: /^(!?\[)[^\]]+/, lookbehind: !0 },
                  string: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
                  punctuation: /^[\[\]!:]|[<>]/,
                },
                alias: 'url',
              },
              bold: {
                pattern: n(
                  /\b__(?:(?!_)<inner>|_(?:(?!_)<inner>)+_)+__\b|\*\*(?:(?!\*)<inner>|\*(?:(?!\*)<inner>)+\*)+\*\*/
                    .source
                ),
                lookbehind: !0,
                greedy: !0,
                inside: {
                  content: { pattern: /(^..)[\s\S]+(?=..$)/, lookbehind: !0, inside: {} },
                  punctuation: /\*\*|__/,
                },
              },
              italic: {
                pattern: n(
                  /\b_(?:(?!_)<inner>|__(?:(?!_)<inner>)+__)+_\b|\*(?:(?!\*)<inner>|\*\*(?:(?!\*)<inner>)+\*\*)+\*/
                    .source
                ),
                lookbehind: !0,
                greedy: !0,
                inside: {
                  content: { pattern: /(^.)[\s\S]+(?=.$)/, lookbehind: !0, inside: {} },
                  punctuation: /[*_]/,
                },
              },
              strike: {
                pattern: n(/(~~?)(?:(?!~)<inner>)+\2/.source),
                lookbehind: !0,
                greedy: !0,
                inside: {
                  content: {
                    pattern: /(^~~?)[\s\S]+(?=\1$)/,
                    lookbehind: !0,
                    inside: {},
                  },
                  punctuation: /~~?/,
                },
              },
              'code-snippet': {
                pattern:
                  /(^|[^\\`])(?:``[^`\r\n]+(?:`[^`\r\n]+)*``(?!`)|`[^`\r\n]+`(?!`))/,
                lookbehind: !0,
                greedy: !0,
                alias: ['code', 'keyword'],
              },
              url: {
                pattern: n(
                  /!?\[(?:(?!\])<inner>)+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)|[ \t]?\[(?:(?!\])<inner>)+\])/
                    .source
                ),
                lookbehind: !0,
                greedy: !0,
                inside: {
                  operator: /^!/,
                  content: { pattern: /(^\[)[^\]]+(?=\])/, lookbehind: !0, inside: {} },
                  variable: { pattern: /(^\][ \t]?\[)[^\]]+(?=\]$)/, lookbehind: !0 },
                  url: { pattern: /(^\]\()[^\s)]+/, lookbehind: !0 },
                  string: {
                    pattern: /(^[ \t]+)"(?:\\.|[^"\\])*"(?=\)$)/,
                    lookbehind: !0,
                  },
                },
              },
            }),
            ['url', 'bold', 'italic', 'strike'].forEach(function (t) {
              ['url', 'bold', 'italic', 'strike', 'code-snippet'].forEach(function (n) {
                t !== n &&
                  (e.languages.markdown[t].inside.content.inside[n] =
                    e.languages.markdown[n]);
              });
            }),
            e.hooks.add('after-tokenize', function (e) {
              ('markdown' === e.language || 'md' === e.language) &&
                (function e(t) {
                  if (t && 'string' != typeof t)
                    for (var n = 0, r = t.length; n < r; n++) {
                      var a = t[n];
                      if ('code' !== a.type) {
                        e(a.content);
                        continue;
                      }
                      var i = a.content[1],
                        o = a.content[3];
                      if (
                        i &&
                        o &&
                        'code-language' === i.type &&
                        'code-block' === o.type &&
                        'string' == typeof i.content
                      ) {
                        var s = i.content
                            .replace(/\b#/g, 'sharp')
                            .replace(/\b\+\+/g, 'pp'),
                          l =
                            'language-' +
                            (s = (/[a-z][\w-]*/i.exec(s) || [''])[0].toLowerCase());
                        o.alias
                          ? 'string' == typeof o.alias
                            ? (o.alias = [o.alias, l])
                            : o.alias.push(l)
                          : (o.alias = [l]);
                      }
                    }
                })(e.tokens);
            }),
            e.hooks.add('wrap', function (t) {
              if ('code-block' === t.type) {
                for (var n, r = '', a = 0, i = t.classes.length; a < i; a++) {
                  var u = t.classes[a],
                    c = /language-(.+)/.exec(u);
                  if (c) {
                    r = c[1];
                    break;
                  }
                }
                var d = e.languages[r];
                if (d) {
                  t.content = e.highlight(
                    (n = t.content.value.replace(o, '')).replace(
                      /&(\w{1,8}|#x?[\da-f]{1,8});/gi,
                      function (e, t) {
                        if ('#' === (t = t.toLowerCase())[0])
                          return l(
                            'x' === t[1] ? parseInt(t.slice(2), 16) : Number(t.slice(1))
                          );
                        var n = s[t];
                        return n || e;
                      }
                    ),
                    d,
                    r
                  );
                } else if (r && 'none' !== r && e.plugins.autoloader) {
                  var h =
                    'md-' + new Date().valueOf() + '-' + Math.floor(1e16 * Math.random());
                  (t.attributes.id = h),
                    e.plugins.autoloader.loadLanguages(r, function () {
                      var t = document.getElementById(h);
                      t && (t.innerHTML = e.highlight(t.textContent, e.languages[r], r));
                    });
                }
              }
            });
          var o = RegExp(e.languages.markup.tag.pattern.source, 'gi'),
            s = { amp: '&', lt: '<', gt: '>', quot: '"' },
            l = String.fromCodePoint || String.fromCharCode;
          e.languages.md = e.languages.markdown;
        })(e);
      }
      (e.exports = t), (t.displayName = 'markdown'), (t.aliases = ['md']);
    },
    8078: function (e) {
      'use strict';
      function t(e) {
        (e.languages.markup = {
          comment: { pattern: /<!--(?:(?!<!--)[\s\S])*?-->/, greedy: !0 },
          prolog: { pattern: /<\?[\s\S]+?\?>/, greedy: !0 },
          doctype: {
            pattern:
              /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
            greedy: !0,
            inside: {
              'internal-subset': {
                pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
                lookbehind: !0,
                greedy: !0,
                inside: null,
              },
              string: { pattern: /"[^"]*"|'[^']*'/, greedy: !0 },
              punctuation: /^<!|>$|[[\]]/,
              'doctype-tag': /^DOCTYPE/i,
              name: /[^\s<>'"]+/,
            },
          },
          cdata: { pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i, greedy: !0 },
          tag: {
            pattern:
              /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
            greedy: !0,
            inside: {
              tag: {
                pattern: /^<\/?[^\s>\/]+/,
                inside: { punctuation: /^<\/?/, namespace: /^[^\s>\/:]+:/ },
              },
              'special-attr': [],
              'attr-value': {
                pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
                inside: { punctuation: [{ pattern: /^=/, alias: 'attr-equals' }, /"|'/] },
              },
              punctuation: /\/?>/,
              'attr-name': {
                pattern: /[^\s>\/]+/,
                inside: { namespace: /^[^\s>\/:]+:/ },
              },
            },
          },
          entity: [
            { pattern: /&[\da-z]{1,8};/i, alias: 'named-entity' },
            /&#x?[\da-f]{1,8};/i,
          ],
        }),
          (e.languages.markup.tag.inside['attr-value'].inside.entity =
            e.languages.markup.entity),
          (e.languages.markup.doctype.inside['internal-subset'].inside =
            e.languages.markup),
          e.hooks.add('wrap', function (e) {
            'entity' === e.type &&
              (e.attributes.title = e.content.value.replace(/&amp;/, '&'));
          }),
          Object.defineProperty(e.languages.markup.tag, 'addInlined', {
            value: function (t, n) {
              var r = {};
              (r['language-' + n] = {
                pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
                lookbehind: !0,
                inside: e.languages[n],
              }),
                (r.cdata = /^<!\[CDATA\[|\]\]>$/i);
              var a = {
                'included-cdata': { pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i, inside: r },
              };
              a['language-' + n] = { pattern: /[\s\S]+/, inside: e.languages[n] };
              var i = {};
              (i[t] = {
                pattern: RegExp(
                  /(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(
                    /__/g,
                    function () {
                      return t;
                    }
                  ),
                  'i'
                ),
                lookbehind: !0,
                greedy: !0,
                inside: a,
              }),
                e.languages.insertBefore('markup', 'cdata', i);
            },
          }),
          Object.defineProperty(e.languages.markup.tag, 'addAttribute', {
            value: function (t, n) {
              e.languages.markup.tag.inside['special-attr'].push({
                pattern: RegExp(
                  /(^|["'\s])/.source +
                    '(?:' +
                    t +
                    ')' +
                    /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
                  'i'
                ),
                lookbehind: !0,
                inside: {
                  'attr-name': /^[^\s=]+/,
                  'attr-value': {
                    pattern: /=[\s\S]+/,
                    inside: {
                      value: {
                        pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                        lookbehind: !0,
                        alias: [n, 'language-' + n],
                        inside: e.languages[n],
                      },
                      punctuation: [{ pattern: /^=/, alias: 'attr-equals' }, /"|'/],
                    },
                  },
                },
              });
            },
          }),
          (e.languages.html = e.languages.markup),
          (e.languages.mathml = e.languages.markup),
          (e.languages.svg = e.languages.markup),
          (e.languages.xml = e.languages.extend('markup', {})),
          (e.languages.ssml = e.languages.xml),
          (e.languages.atom = e.languages.xml),
          (e.languages.rss = e.languages.xml);
      }
      (e.exports = t),
        (t.displayName = 'markup'),
        (t.aliases = ['html', 'mathml', 'svg', 'xml', 'ssml', 'atom', 'rss']);
    },
    7687: function (e, t, n) {
      'use strict';
      var r = n(2889),
        a = n(285);
      function i(e) {
        var t, n;
        e.register(r),
          e.register(a),
          (t = e.util.clone(e.languages.typescript)),
          (e.languages.tsx = e.languages.extend('jsx', t)),
          delete e.languages.tsx.parameter,
          delete e.languages.tsx['literal-property'],
          ((n = e.languages.tsx.tag).pattern = RegExp(
            /(^|[^\w$]|(?=<\/))/.source + '(?:' + n.pattern.source + ')',
            n.pattern.flags
          )),
          (n.lookbehind = !0);
      }
      (e.exports = i), (i.displayName = 'tsx'), (i.aliases = []);
    },
    285: function (e) {
      'use strict';
      function t(e) {
        var t;
        (e.languages.typescript = e.languages.extend('javascript', {
          'class-name': {
            pattern:
              /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
            lookbehind: !0,
            greedy: !0,
            inside: null,
          },
          builtin:
            /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/,
        })),
          e.languages.typescript.keyword.push(
            /\b(?:abstract|declare|is|keyof|readonly|require)\b/,
            /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
            /\btype\b(?=\s*(?:[\{*]|$))/
          ),
          delete e.languages.typescript.parameter,
          delete e.languages.typescript['literal-property'],
          (t = e.languages.extend('typescript', {})),
          delete t['class-name'],
          (e.languages.typescript['class-name'].inside = t),
          e.languages.insertBefore('typescript', 'function', {
            decorator: {
              pattern: /@[$\w\xA0-\uFFFF]+/,
              inside: { at: { pattern: /^@/, alias: 'operator' }, function: /^[\s\S]+/ },
            },
            'generic-function': {
              pattern:
                /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
              greedy: !0,
              inside: {
                function: /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
                generic: { pattern: /<[\s\S]+/, alias: 'class-name', inside: t },
              },
            },
          }),
          (e.languages.ts = e.languages.typescript);
      }
      (e.exports = t), (t.displayName = 'typescript'), (t.aliases = ['ts']);
    },
    3049: function (e) {
      'use strict';
      function t(e) {
        !(function (e) {
          var t = /[*&][^\s[\]{},]+/,
            n =
              /!(?:<[\w\-%#;/?:@&=+$,.!~*'()[\]]+>|(?:[a-zA-Z\d-]*!)?[\w\-%#;/?:@&=+$.~*'()]+)?/,
            r =
              '(?:' +
              n.source +
              '(?:[ 	]+' +
              t.source +
              ')?|' +
              t.source +
              '(?:[ 	]+' +
              n.source +
              ')?)',
            a =
              /(?:[^\s\x00-\x08\x0e-\x1f!"#%&'*,\-:>?@[\]`{|}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]|[?:-]<PLAIN>)(?:[ \t]*(?:(?![#:])<PLAIN>|:<PLAIN>))*/.source.replace(
                /<PLAIN>/g,
                function () {
                  return /[^\s\x00-\x08\x0e-\x1f,[\]{}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]/
                    .source;
                }
              ),
            i = /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/.source;
          function o(e, t) {
            return (
              (t = (t || '').replace(/m/g, '') + 'm'),
              RegExp(
                /([:\-,[{]\s*(?:\s<<prop>>[ \t]+)?)(?:<<value>>)(?=[ \t]*(?:$|,|\]|\}|(?:[\r\n]\s*)?#))/.source
                  .replace(/<<prop>>/g, function () {
                    return r;
                  })
                  .replace(/<<value>>/g, function () {
                    return e;
                  }),
                t
              )
            );
          }
          (e.languages.yaml = {
            scalar: {
              pattern: RegExp(
                /([\-:]\s*(?:\s<<prop>>[ \t]+)?[|>])[ \t]*(?:((?:\r?\n|\r)[ \t]+)\S[^\r\n]*(?:\2[^\r\n]+)*)/.source.replace(
                  /<<prop>>/g,
                  function () {
                    return r;
                  }
                )
              ),
              lookbehind: !0,
              alias: 'string',
            },
            comment: /#.*/,
            key: {
              pattern: RegExp(
                /((?:^|[:\-,[{\r\n?])[ \t]*(?:<<prop>>[ \t]+)?)<<key>>(?=\s*:\s)/.source
                  .replace(/<<prop>>/g, function () {
                    return r;
                  })
                  .replace(/<<key>>/g, function () {
                    return '(?:' + a + '|' + i + ')';
                  })
              ),
              lookbehind: !0,
              greedy: !0,
              alias: 'atrule',
            },
            directive: { pattern: /(^[ \t]*)%.+/m, lookbehind: !0, alias: 'important' },
            datetime: {
              pattern: o(
                /\d{4}-\d\d?-\d\d?(?:[tT]|[ \t]+)\d\d?:\d{2}:\d{2}(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d{2})?))?|\d{4}-\d{2}-\d{2}|\d\d?:\d{2}(?::\d{2}(?:\.\d*)?)?/
                  .source
              ),
              lookbehind: !0,
              alias: 'number',
            },
            boolean: {
              pattern: o(/false|true/.source, 'i'),
              lookbehind: !0,
              alias: 'important',
            },
            null: {
              pattern: o(/null|~/.source, 'i'),
              lookbehind: !0,
              alias: 'important',
            },
            string: { pattern: o(i), lookbehind: !0, greedy: !0 },
            number: {
              pattern: o(
                /[+-]?(?:0x[\da-f]+|0o[0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\.inf|\.nan)/
                  .source,
                'i'
              ),
              lookbehind: !0,
            },
            tag: n,
            important: t,
            punctuation: /---|[:[\]{}\-,|>?]|\.\.\./,
          }),
            (e.languages.yml = e.languages.yaml);
        })(e);
      }
      (e.exports = t), (t.displayName = 'yaml'), (t.aliases = ['yml']);
    },
    162: function (e) {
      e.exports = function (e, t, n, r) {
        var a = n ? n.call(r, e, t) : void 0;
        if (void 0 !== a) return !!a;
        if (e === t) return !0;
        if ('object' != typeof e || !e || 'object' != typeof t || !t) return !1;
        var i = Object.keys(e),
          o = Object.keys(t);
        if (i.length !== o.length) return !1;
        for (var s = Object.prototype.hasOwnProperty.bind(t), l = 0; l < i.length; l++) {
          var u = i[l];
          if (!s(u)) return !1;
          var c = e[u],
            d = t[u];
          if (!1 === (a = n ? n.call(r, c, d, u) : void 0) || (void 0 === a && c !== d))
            return !1;
        }
        return !0;
      };
    },
    645: function (e, t) {
      'use strict';
      t.parse = function (e) {
        var t = String(e || '').trim();
        return '' === t ? [] : t.split(n);
      };
      var n = /[ \t\n\r\f]+/g;
    },
    9687: function (e) {
      e.exports = function () {
        var e = document.getSelection();
        if (!e.rangeCount) return function () {};
        for (var t = document.activeElement, n = [], r = 0; r < e.rangeCount; r++)
          n.push(e.getRangeAt(r));
        switch (t.tagName.toUpperCase()) {
          case 'INPUT':
          case 'TEXTAREA':
            t.blur();
            break;
          default:
            t = null;
        }
        return (
          e.removeAllRanges(),
          function () {
            'Caret' === e.type && e.removeAllRanges(),
              e.rangeCount ||
                n.forEach(function (t) {
                  e.addRange(t);
                }),
              t && t.focus();
          }
        );
      };
    },
    5918: function (e) {
      e.exports = function () {
        for (var e = {}, n = 0; n < arguments.length; n++) {
          var r = arguments[n];
          for (var a in r) t.call(r, a) && (e[a] = r[a]);
        }
        return e;
      };
      var t = Object.prototype.hasOwnProperty;
    },
    8440: function (e, t, n) {
      'use strict';
      let r;
      var a,
        i,
        o,
        s,
        l = {};
      n.r(l), n.d(l, { onSearch: () => n8 });
      var u = n(316),
        c = n.t(u, 2),
        d = n(8997),
        h = n.t(d, 2),
        f = n(5723),
        p = n(2155);
      let m = (0, p.createContext)({}),
        g = (0, p.createContext)({});
      var v = n(5747);
      let x = {
        title: '',
        description: '',
        icon: '',
        route: {},
        themeConfig: {
          locales: [],
          nav: {
            default: [
              { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
              { text: 'Hello world', link: '/hello', activeMatch: '/hello' },
              { text: 'API', link: 'https://rspress.dev/api/index.html' },
            ],
          },
          sidebar: {
            '/guide': [
              { text: 'Markdown & MDX', link: '/guide/index', _fileKey: 'guide/index' },
            ],
            '/public': [],
          },
        },
        base: '/',
        lang: '',
        locales: [],
        logo: '',
        logoText: '',
        ssg: !0,
        multiVersion: { default: '', versions: [] },
        search: {},
        pages: [
          {
            title: 'Markdown & MDX',
            routePath: '/guide/',
            lang: '',
            toc: [
              { text: 'Markdown', id: 'markdown', depth: 2, charIndex: 88 },
              { text: 'Use component', id: 'use-component', depth: 2, charIndex: 198 },
              { text: 'Front matter', id: 'front-matter', depth: 2, charIndex: 336 },
              {
                text: 'Custom container',
                id: 'custom-container',
                depth: 2,
                charIndex: 768,
              },
              { text: 'Code block', id: 'code-block', depth: 2, charIndex: 1191 },
              { text: 'Basic usage', id: 'basic-usage', depth: 3, charIndex: 1205 },
              {
                text: 'Show line numbers',
                id: 'show-line-numbers',
                depth: 3,
                charIndex: 1333,
              },
              { text: 'Wrap code', id: 'wrap-code', depth: 3, charIndex: 1456 },
              {
                text: 'Line highlighting',
                id: 'line-highlighting',
                depth: 3,
                charIndex: 1581,
              },
              {
                text: 'Rustify MDX compiler',
                id: 'rustify-mdx-compiler',
                depth: 2,
                charIndex: 1713,
              },
            ],
            frontmatter: {},
            version: '',
            _relativePath: 'guide/index.md',
          },
          {
            title: 'Hello world!',
            routePath: '/hello',
            lang: '',
            toc: [{ text: 'Start', id: 'start', depth: 2, charIndex: 3 }],
            frontmatter: {},
            version: '',
            _relativePath: 'hello.md',
          },
          {
            title: '',
            routePath: '/',
            lang: '',
            toc: [],
            frontmatter: {
              pageType: 'home',
              hero: {
                name: 'My Site',
                text: 'A cool website!',
                tagline: 'This is the tagline',
                actions: [
                  { theme: 'brand', text: 'Quick Start', link: '/guide/' },
                  {
                    theme: 'alt',
                    text: 'GitHub',
                    link: 'https://github.com/web-infra-dev/rspress',
                  },
                ],
                image: { src: '/rspress-icon.png', alt: 'Logo' },
              },
              features: [
                {
                  title: 'Blazing fast build speed',
                  details:
                    'The core compilation module is based on the Rust front-end toolchain, providing a more ultimate development experience.',
                  icon: '\uD83C\uDFC3\uD83C\uDFFB‍♀️',
                },
                {
                  title: 'Support for MDX content writing',
                  details:
                    'MDX is a powerful way to write content, allowing you to use React components in Markdown.',
                  icon: '\uD83D\uDCE6',
                },
                {
                  title: 'Built-in full-text search',
                  details:
                    'Automatically generates a full-text search index for you during construction, providing out-of-the-box full-text search capabilities.',
                  icon: '\uD83C\uDFA8',
                },
                {
                  title: 'Simpler I18n solution',
                  details:
                    'With the built-in I18n solution, you can easily provide multi-language support for documents or components.',
                  icon: '\uD83C\uDF0D',
                },
                {
                  title: 'Static site generation',
                  details:
                    'In production, it automatically builds into static HTML files, which can be easily deployed anywhere.',
                  icon: '\uD83C\uDF08',
                },
                {
                  title: 'Providing multiple custom capabilities',
                  details:
                    'Through its extension mechanism, you can easily extend theme UI and build process.',
                  icon: '\uD83D\uDD25',
                },
              ],
            },
            version: '',
            _relativePath: 'index.md',
          },
        ],
        markdown: { showLineNumbers: !1, defaultWrapCode: !1, codeHighlighter: 'prism' },
      };
      var y = n(8269);
      let b = (0, y.lazyWithPreload)(() => n.e('206').then(n.bind(n, 9157))),
        D = (0, y.lazyWithPreload)(() => n.e('971').then(n.bind(n, 3766))),
        F = (0, y.lazyWithPreload)(() => n.e('3').then(n.bind(n, 1822))),
        w = [
          {
            path: '/guide/',
            element: p.createElement(b),
            filePath: 'guide/index.md',
            preload: async () => (await b.preload(), n.e('206').then(n.bind(n, 9157))),
            lang: '',
            version: '',
          },
          {
            path: '/hello',
            element: p.createElement(D),
            filePath: 'hello.md',
            preload: async () => (await D.preload(), n.e('971').then(n.bind(n, 3766))),
            lang: '',
            version: '',
          },
          {
            path: '/',
            element: p.createElement(F),
            filePath: 'index.md',
            preload: async () => (await F.preload(), n.e('3').then(n.bind(n, 1822))),
            lang: '',
            version: '',
          },
        ];
      var C = n(5996);
      function j(e) {
        return decodeURIComponent(e)
          .replace(/\.html$/, '')
          .replace(/\/index$/, '/');
      }
      let E = new Map();
      function A(e) {
        var t;
        let n = E.get(e);
        if (n) return n;
        let r = (0, C.ue)(w, j(e)),
          a = null == r || null == (t = r[0]) ? void 0 : t.route;
        return a && E.set(e, a), a;
      }
      let k = (0, p.memo)(
          function (e) {
            var t;
            let n = e.el;
            return (
              (null == x || null == (t = x.themeConfig)
                ? void 0
                : t.enableContentAnimation) &&
                (n = (function (e) {
                  let [t, n] = (0, p.useState)(e);
                  return (
                    (0, p.useLayoutEffect)(() => {
                      document.startViewTransition && t !== e
                        ? document.startViewTransition(() => {
                            (0, u.flushSync)(() => {
                              n(e);
                            }),
                              window.dispatchEvent(new Event('RspressReloadContent'));
                          })
                        : ((0, u.flushSync)(() => {
                            n(e);
                          }),
                          window.dispatchEvent(new Event('RspressReloadContent')));
                    }, [e]),
                    t
                  );
                })(e.el)),
              n
            );
          },
          (e, t) => e.el === t.el
        ),
        S = /\?.*$/s,
        N = /#.*$/s,
        T = /\.mdx?$/;
      function B(e) {
        return e.replace(/#.*$/, '');
      }
      function L(e) {
        return '/' === e.charAt(0) || $(e) ? e : `/${e}`;
      }
      function O(e) {
        return '/' === e.charAt(e.length - 1) ? e : `${e}/`;
      }
      function P(e) {
        return '/' === e.charAt(e.length - 1) ? e.slice(0, -1) : e;
      }
      function _(e) {
        return P(
          L(
            (function (e) {
              let t = e.replace(/\\/g, '/'),
                n = t.startsWith('/'),
                r = t.split('/'),
                a = [];
              for (let e of r)
                '.' === e ||
                  '' === e ||
                  ('..' === e
                    ? a.length > 0 && '..' !== a[a.length - 1]
                      ? a.pop()
                      : n && a.push('..')
                    : a.push(e));
              let i = a.join('/');
              return n && (i = `/${i}`), i;
            })(e)
          )
        );
      }
      function $(e = '') {
        return (
          e.startsWith('http://') ||
          e.startsWith('https://') ||
          e.startsWith('mailto:') ||
          e.startsWith('tel:')
        );
      }
      function M(e, t) {
        return L(e).replace(_(t), '');
      }
      function I(e, t) {
        let n = L(e),
          r = _(t);
        return n.startsWith(r) ? n : `${r}${n}`;
      }
      function z(e, t) {
        return L(e).replace(RegExp(`^${_(t)}`), '');
      }
      function R(e = '/') {
        return I(e, x.base);
      }
      function H(e) {
        var t;
        return (function (e, t = !1) {
          if (!e) return '/';
          if ($(e)) return e;
          let { url: n, hash: r } = ((e) => {
            let [t, n = ''] = e.split('#');
            return { url: t, hash: n };
          })(decodeURIComponent(e));
          return (
            t ||
              n.endsWith('.html') ||
              (n.endsWith('/') ? (n += 'index.html') : (n += '.html')),
            t && n.endsWith('/') && (n += 'index'),
            t && n.endsWith('.html') && (n = n.replace(/\.html$/, '')),
            L(r ? `${n}#${r}` : n)
          );
        })(e, !!(null == x || null == (t = x.route) ? void 0 : t.cleanUrls));
      }
      var W = n(389),
        U = n(5821),
        q = n.n(U),
        V = n(8727),
        G = n.n(V),
        Z = n(2018),
        Y = n.n(Z),
        K = n(162),
        X = n.n(K);
      function J() {
        return (J =
          Object.assign ||
          function (e) {
            for (var t = 1; t < arguments.length; t++) {
              var n = arguments[t];
              for (var r in n)
                Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
            }
            return e;
          }).apply(this, arguments);
      }
      function Q(e, t) {
        (e.prototype = Object.create(t.prototype)),
          (e.prototype.constructor = e),
          ee(e, t);
      }
      function ee(e, t) {
        return (ee =
          Object.setPrototypeOf ||
          function (e, t) {
            return (e.__proto__ = t), e;
          })(e, t);
      }
      function et(e, t) {
        if (null == e) return {};
        var n,
          r,
          a = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) t.indexOf((n = i[r])) >= 0 || (a[n] = e[n]);
        return a;
      }
      var en = {
          BASE: 'base',
          BODY: 'body',
          HEAD: 'head',
          HTML: 'html',
          LINK: 'link',
          META: 'meta',
          NOSCRIPT: 'noscript',
          SCRIPT: 'script',
          STYLE: 'style',
          TITLE: 'title',
          FRAGMENT: 'Symbol(react.fragment)',
        },
        er = { rel: ['amphtml', 'canonical', 'alternate'] },
        ea = { type: ['application/ld+json'] },
        ei = {
          charset: '',
          name: ['robots', 'description'],
          property: [
            'og:type',
            'og:title',
            'og:url',
            'og:image',
            'og:image:alt',
            'og:description',
            'twitter:url',
            'twitter:title',
            'twitter:description',
            'twitter:image',
            'twitter:image:alt',
            'twitter:card',
            'twitter:site',
          ],
        },
        eo = Object.keys(en).map(function (e) {
          return en[e];
        }),
        es = {
          accesskey: 'accessKey',
          charset: 'charSet',
          class: 'className',
          contenteditable: 'contentEditable',
          contextmenu: 'contextMenu',
          'http-equiv': 'httpEquiv',
          itemprop: 'itemProp',
          tabindex: 'tabIndex',
        },
        el = Object.keys(es).reduce(function (e, t) {
          return (e[es[t]] = t), e;
        }, {}),
        eu = function (e, t) {
          for (var n = e.length - 1; n >= 0; n -= 1) {
            var r = e[n];
            if (Object.prototype.hasOwnProperty.call(r, t)) return r[t];
          }
          return null;
        },
        ec = function (e) {
          var t = eu(e, en.TITLE),
            n = eu(e, 'titleTemplate');
          if ((Array.isArray(t) && (t = t.join('')), n && t))
            return n.replace(/%s/g, function () {
              return t;
            });
          var r = eu(e, 'defaultTitle');
          return t || r || void 0;
        },
        ed = function (e, t) {
          return t
            .filter(function (t) {
              return void 0 !== t[e];
            })
            .map(function (t) {
              return t[e];
            })
            .reduce(function (e, t) {
              return J({}, e, t);
            }, {});
        },
        eh = function (e, t, n) {
          var r = {};
          return n
            .filter(function (t) {
              return (
                !!Array.isArray(t[e]) ||
                (void 0 !== t[e] &&
                  console &&
                  'function' == typeof console.warn &&
                  console.warn(
                    'Helmet: ' +
                      e +
                      ' should be of type "Array". Instead found type "' +
                      typeof t[e] +
                      '"'
                  ),
                !1)
              );
            })
            .map(function (t) {
              return t[e];
            })
            .reverse()
            .reduce(function (e, n) {
              var a = {};
              n.filter(function (e) {
                for (var n, i = Object.keys(e), o = 0; o < i.length; o += 1) {
                  var s = i[o],
                    l = s.toLowerCase();
                  -1 === t.indexOf(l) ||
                    ('rel' === n && 'canonical' === e[n].toLowerCase()) ||
                    ('rel' === l && 'stylesheet' === e[l].toLowerCase()) ||
                    (n = l),
                    -1 === t.indexOf(s) ||
                      ('innerHTML' !== s && 'cssText' !== s && 'itemprop' !== s) ||
                      (n = s);
                }
                if (!n || !e[n]) return !1;
                var u = e[n].toLowerCase();
                return (
                  r[n] || (r[n] = {}),
                  a[n] || (a[n] = {}),
                  !r[n][u] && ((a[n][u] = !0), !0)
                );
              })
                .reverse()
                .forEach(function (t) {
                  return e.push(t);
                });
              for (var i = Object.keys(a), o = 0; o < i.length; o += 1) {
                var s = i[o],
                  l = J({}, r[s], a[s]);
                r[s] = l;
              }
              return e;
            }, [])
            .reverse();
        },
        ef = function (e, t) {
          if (Array.isArray(e) && e.length) {
            for (var n = 0; n < e.length; n += 1) if (e[n][t]) return !0;
          }
          return !1;
        },
        ep = function (e) {
          return Array.isArray(e) ? e.join('') : e;
        },
        em = function (e, t) {
          return Array.isArray(e)
            ? e.reduce(
                function (e, n) {
                  return (
                    !(function (e, t) {
                      for (var n = Object.keys(e), r = 0; r < n.length; r += 1)
                        if (t[n[r]] && t[n[r]].includes(e[n[r]])) return !0;
                      return !1;
                    })(n, t)
                      ? e.default.push(n)
                      : e.priority.push(n),
                    e
                  );
                },
                { priority: [], default: [] }
              )
            : { default: e };
        },
        eg = function (e, t) {
          var n;
          return J({}, e, (((n = {})[t] = void 0), n));
        },
        ev = [en.NOSCRIPT, en.SCRIPT, en.STYLE],
        ex = function (e, t) {
          return (
            void 0 === t && (t = !0),
            !1 === t
              ? String(e)
              : String(e)
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#x27;')
          );
        },
        ey = function (e) {
          return Object.keys(e).reduce(function (t, n) {
            var r = void 0 !== e[n] ? n + '="' + e[n] + '"' : '' + n;
            return t ? t + ' ' + r : r;
          }, '');
        },
        eb = function (e, t) {
          return (
            void 0 === t && (t = {}),
            Object.keys(e).reduce(function (t, n) {
              return (t[es[n] || n] = e[n]), t;
            }, t)
          );
        },
        eD = function (e, t) {
          return t.map(function (t, n) {
            var r,
              a = (((r = { key: n })['data-rh'] = !0), r);
            return (
              Object.keys(t).forEach(function (e) {
                var n = es[e] || e;
                'innerHTML' === n || 'cssText' === n
                  ? (a.dangerouslySetInnerHTML = { __html: t.innerHTML || t.cssText })
                  : (a[n] = t[e]);
              }),
              p.createElement(e, a)
            );
          });
        },
        eF = function (e, t, n) {
          switch (e) {
            case en.TITLE:
              return {
                toComponent: function () {
                  var e, n, r, a;
                  return (
                    (n = t.titleAttributes),
                    ((r = { key: (e = t.title) })['data-rh'] = !0),
                    (a = eb(n, r)),
                    [p.createElement(en.TITLE, a, e)]
                  );
                },
                toString: function () {
                  var r, a, i, o;
                  return (
                    (r = t.title),
                    (a = t.titleAttributes),
                    (i = ey(a)),
                    (o = ep(r)),
                    i
                      ? '<' + e + ' data-rh="true" ' + i + '>' + ex(o, n) + '</' + e + '>'
                      : '<' + e + ' data-rh="true">' + ex(o, n) + '</' + e + '>'
                  );
                },
              };
            case 'bodyAttributes':
            case 'htmlAttributes':
              return {
                toComponent: function () {
                  return eb(t);
                },
                toString: function () {
                  return ey(t);
                },
              };
            default:
              return {
                toComponent: function () {
                  return eD(e, t);
                },
                toString: function () {
                  return t.reduce(function (t, r) {
                    var a = Object.keys(r)
                        .filter(function (e) {
                          return 'innerHTML' !== e && 'cssText' !== e;
                        })
                        .reduce(function (e, t) {
                          var a = void 0 === r[t] ? t : t + '="' + ex(r[t], n) + '"';
                          return e ? e + ' ' + a : a;
                        }, ''),
                      i = r.innerHTML || r.cssText || '',
                      o = -1 === ev.indexOf(e);
                    return (
                      t +
                      '<' +
                      e +
                      ' data-rh="true" ' +
                      a +
                      (o ? '/>' : '>' + i + '</' + e + '>')
                    );
                  }, '');
                },
              };
          }
        },
        ew = function (e) {
          var t = e.baseTag,
            n = e.bodyAttributes,
            r = e.encode,
            a = e.htmlAttributes,
            i = e.noscriptTags,
            o = e.styleTags,
            s = e.title,
            l = e.titleAttributes,
            u = e.linkTags,
            c = e.metaTags,
            d = e.scriptTags,
            h = {
              toComponent: function () {},
              toString: function () {
                return '';
              },
            };
          if (e.prioritizeSeoTags) {
            var f,
              p,
              m,
              g,
              v,
              x,
              y =
                ((f = e.linkTags),
                (p = e.scriptTags),
                (m = e.encode),
                (g = em(e.metaTags, ei)),
                (v = em(f, er)),
                (x = em(p, ea)),
                {
                  priorityMethods: {
                    toComponent: function () {
                      return [].concat(
                        eD(en.META, g.priority),
                        eD(en.LINK, v.priority),
                        eD(en.SCRIPT, x.priority)
                      );
                    },
                    toString: function () {
                      return (
                        eF(en.META, g.priority, m) +
                        ' ' +
                        eF(en.LINK, v.priority, m) +
                        ' ' +
                        eF(en.SCRIPT, x.priority, m)
                      );
                    },
                  },
                  metaTags: g.default,
                  linkTags: v.default,
                  scriptTags: x.default,
                });
            (h = y.priorityMethods),
              (u = y.linkTags),
              (c = y.metaTags),
              (d = y.scriptTags);
          }
          return {
            priority: h,
            base: eF(en.BASE, t, r),
            bodyAttributes: eF('bodyAttributes', n, r),
            htmlAttributes: eF('htmlAttributes', a, r),
            link: eF(en.LINK, u, r),
            meta: eF(en.META, c, r),
            noscript: eF(en.NOSCRIPT, i, r),
            script: eF(en.SCRIPT, d, r),
            style: eF(en.STYLE, o, r),
            title: eF(en.TITLE, { title: void 0 === s ? '' : s, titleAttributes: l }, r),
          };
        },
        eC = [],
        ej = function (e, t) {
          var n = this;
          void 0 === t && (t = 'undefined' != typeof document),
            (this.instances = []),
            (this.value = {
              setHelmet: function (e) {
                n.context.helmet = e;
              },
              helmetInstances: {
                get: function () {
                  return n.canUseDOM ? eC : n.instances;
                },
                add: function (e) {
                  (n.canUseDOM ? eC : n.instances).push(e);
                },
                remove: function (e) {
                  var t = (n.canUseDOM ? eC : n.instances).indexOf(e);
                  (n.canUseDOM ? eC : n.instances).splice(t, 1);
                },
              },
            }),
            (this.context = e),
            (this.canUseDOM = t),
            t ||
              (e.helmet = ew({
                baseTag: [],
                bodyAttributes: {},
                encodeSpecialCharacters: !0,
                htmlAttributes: {},
                linkTags: [],
                metaTags: [],
                noscriptTags: [],
                scriptTags: [],
                styleTags: [],
                title: '',
                titleAttributes: {},
              }));
        },
        eE = p.createContext({}),
        eA = q().shape({
          setHelmet: q().func,
          helmetInstances: q().shape({ get: q().func, add: q().func, remove: q().func }),
        }),
        ek = 'undefined' != typeof document,
        eS = (function (e) {
          function t(n) {
            var r;
            return (
              ((r = e.call(this, n) || this).helmetData = new ej(
                r.props.context,
                t.canUseDOM
              )),
              r
            );
          }
          return (
            Q(t, e),
            (t.prototype.render = function () {
              return p.createElement(
                eE.Provider,
                { value: this.helmetData.value },
                this.props.children
              );
            }),
            t
          );
        })(p.Component);
      (eS.canUseDOM = ek),
        (eS.propTypes = {
          context: q().shape({ helmet: q().shape() }),
          children: q().node.isRequired,
        }),
        (eS.defaultProps = { context: {} }),
        (eS.displayName = 'HelmetProvider');
      var eN = function (e, t) {
          var n,
            r = document.head || document.querySelector(en.HEAD),
            a = r.querySelectorAll(e + '[data-rh]'),
            i = [].slice.call(a),
            o = [];
          return (
            t &&
              t.length &&
              t.forEach(function (t) {
                var r = document.createElement(e);
                for (var a in t)
                  Object.prototype.hasOwnProperty.call(t, a) &&
                    ('innerHTML' === a
                      ? (r.innerHTML = t.innerHTML)
                      : 'cssText' === a
                        ? r.styleSheet
                          ? (r.styleSheet.cssText = t.cssText)
                          : r.appendChild(document.createTextNode(t.cssText))
                        : r.setAttribute(a, void 0 === t[a] ? '' : t[a]));
                r.setAttribute('data-rh', 'true'),
                  i.some(function (e, t) {
                    return (n = t), r.isEqualNode(e);
                  })
                    ? i.splice(n, 1)
                    : o.push(r);
              }),
            i.forEach(function (e) {
              return e.parentNode.removeChild(e);
            }),
            o.forEach(function (e) {
              return r.appendChild(e);
            }),
            { oldTags: i, newTags: o }
          );
        },
        eT = function (e, t) {
          var n = document.getElementsByTagName(e)[0];
          if (n) {
            for (
              var r = n.getAttribute('data-rh'),
                a = r ? r.split(',') : [],
                i = [].concat(a),
                o = Object.keys(t),
                s = 0;
              s < o.length;
              s += 1
            ) {
              var l = o[s],
                u = t[l] || '';
              n.getAttribute(l) !== u && n.setAttribute(l, u),
                -1 === a.indexOf(l) && a.push(l);
              var c = i.indexOf(l);
              -1 !== c && i.splice(c, 1);
            }
            for (var d = i.length - 1; d >= 0; d -= 1) n.removeAttribute(i[d]);
            a.length === i.length
              ? n.removeAttribute('data-rh')
              : n.getAttribute('data-rh') !== o.join(',') &&
                n.setAttribute('data-rh', o.join(','));
          }
        },
        eB = function (e, t) {
          var n = e.baseTag,
            r = e.htmlAttributes,
            a = e.linkTags,
            i = e.metaTags,
            o = e.noscriptTags,
            s = e.onChangeClientState,
            l = e.scriptTags,
            u = e.styleTags,
            c = e.title,
            d = e.titleAttributes;
          eT(en.BODY, e.bodyAttributes),
            eT(en.HTML, r),
            void 0 !== c && document.title !== c && (document.title = ep(c)),
            eT(en.TITLE, d);
          var h = {
              baseTag: eN(en.BASE, n),
              linkTags: eN(en.LINK, a),
              metaTags: eN(en.META, i),
              noscriptTags: eN(en.NOSCRIPT, o),
              scriptTags: eN(en.SCRIPT, l),
              styleTags: eN(en.STYLE, u),
            },
            f = {},
            p = {};
          Object.keys(h).forEach(function (e) {
            var t = h[e],
              n = t.newTags,
              r = t.oldTags;
            n.length && (f[e] = n), r.length && (p[e] = h[e].oldTags);
          }),
            t && t(),
            s(e, f, p);
        },
        eL = null,
        eO = (function (e) {
          function t() {
            for (var t, n = arguments.length, r = Array(n), a = 0; a < n; a++)
              r[a] = arguments[a];
            return ((t = e.call.apply(e, [this].concat(r)) || this).rendered = !1), t;
          }
          Q(t, e);
          var n = t.prototype;
          return (
            (n.shouldComponentUpdate = function (e) {
              return !X()(e, this.props);
            }),
            (n.componentDidUpdate = function () {
              this.emitChange();
            }),
            (n.componentWillUnmount = function () {
              this.props.context.helmetInstances.remove(this), this.emitChange();
            }),
            (n.emitChange = function () {
              var e,
                t,
                n = this.props.context,
                r = n.setHelmet,
                a = null,
                i = {
                  baseTag:
                    ((e = ['href']),
                    (t = n.helmetInstances.get().map(function (e) {
                      var t = J({}, e.props);
                      return delete t.context, t;
                    }))
                      .filter(function (e) {
                        return void 0 !== e[en.BASE];
                      })
                      .map(function (e) {
                        return e[en.BASE];
                      })
                      .reverse()
                      .reduce(function (t, n) {
                        if (!t.length)
                          for (var r = Object.keys(n), a = 0; a < r.length; a += 1) {
                            var i = r[a].toLowerCase();
                            if (-1 !== e.indexOf(i) && n[i]) return t.concat(n);
                          }
                        return t;
                      }, [])),
                  bodyAttributes: ed('bodyAttributes', t),
                  defer: eu(t, 'defer'),
                  encode: eu(t, 'encodeSpecialCharacters'),
                  htmlAttributes: ed('htmlAttributes', t),
                  linkTags: eh(en.LINK, ['rel', 'href'], t),
                  metaTags: eh(
                    en.META,
                    ['name', 'charset', 'http-equiv', 'property', 'itemprop'],
                    t
                  ),
                  noscriptTags: eh(en.NOSCRIPT, ['innerHTML'], t),
                  onChangeClientState: eu(t, 'onChangeClientState') || function () {},
                  scriptTags: eh(en.SCRIPT, ['src', 'innerHTML'], t),
                  styleTags: eh(en.STYLE, ['cssText'], t),
                  title: ec(t),
                  titleAttributes: ed('titleAttributes', t),
                  prioritizeSeoTags: ef(t, 'prioritizeSeoTags'),
                };
              eS.canUseDOM
                ? (eL && cancelAnimationFrame(eL),
                  i.defer
                    ? (eL = requestAnimationFrame(function () {
                        eB(i, function () {
                          eL = null;
                        });
                      }))
                    : (eB(i), (eL = null)))
                : ew && (a = ew(i)),
                r(a);
            }),
            (n.init = function () {
              this.rendered ||
                ((this.rendered = !0),
                this.props.context.helmetInstances.add(this),
                this.emitChange());
            }),
            (n.render = function () {
              return this.init(), null;
            }),
            t
          );
        })(p.Component);
      (eO.propTypes = { context: eA.isRequired }), (eO.displayName = 'HelmetDispatcher');
      var eP = ['children'],
        e_ = ['children'],
        e$ = (function (e) {
          function t() {
            return e.apply(this, arguments) || this;
          }
          Q(t, e);
          var n = t.prototype;
          return (
            (n.shouldComponentUpdate = function (e) {
              return !G()(eg(this.props, 'helmetData'), eg(e, 'helmetData'));
            }),
            (n.mapNestedChildrenToProps = function (e, t) {
              if (!t) return null;
              switch (e.type) {
                case en.SCRIPT:
                case en.NOSCRIPT:
                  return { innerHTML: t };
                case en.STYLE:
                  return { cssText: t };
                default:
                  throw Error(
                    '<' +
                      e.type +
                      ' /> elements are self-closing and can not contain children. Refer to our API for more information.'
                  );
              }
            }),
            (n.flattenArrayTypeChildren = function (e) {
              var t,
                n = e.child,
                r = e.arrayTypeChildren;
              return J(
                {},
                r,
                (((t = {})[n.type] = [].concat(r[n.type] || [], [
                  J(
                    {},
                    e.newChildProps,
                    this.mapNestedChildrenToProps(n, e.nestedChildren)
                  ),
                ])),
                t)
              );
            }),
            (n.mapObjectTypeChildren = function (e) {
              var t,
                n,
                r = e.child,
                a = e.newProps,
                i = e.newChildProps,
                o = e.nestedChildren;
              switch (r.type) {
                case en.TITLE:
                  return J(
                    {},
                    a,
                    (((t = {})[r.type] = o), (t.titleAttributes = J({}, i)), t)
                  );
                case en.BODY:
                  return J({}, a, { bodyAttributes: J({}, i) });
                case en.HTML:
                  return J({}, a, { htmlAttributes: J({}, i) });
                default:
                  return J({}, a, (((n = {})[r.type] = J({}, i)), n));
              }
            }),
            (n.mapArrayTypeChildrenToProps = function (e, t) {
              var n = J({}, t);
              return (
                Object.keys(e).forEach(function (t) {
                  var r;
                  n = J({}, n, (((r = {})[t] = e[t]), r));
                }),
                n
              );
            }),
            (n.warnOnInvalidChildren = function (e, t) {
              return (
                Y()(
                  eo.some(function (t) {
                    return e.type === t;
                  }),
                  'function' == typeof e.type
                    ? 'You may be attempting to nest <Helmet> components within each other, which is not allowed. Refer to our API for more information.'
                    : 'Only elements types ' +
                        eo.join(', ') +
                        ' are allowed. Helmet does not support rendering <' +
                        e.type +
                        '> elements. Refer to our API for more information.'
                ),
                Y()(
                  !t ||
                    'string' == typeof t ||
                    (Array.isArray(t) &&
                      !t.some(function (e) {
                        return 'string' != typeof e;
                      })),
                  'Helmet expects a string as a child of <' +
                    e.type +
                    '>. Did you forget to wrap your children in braces? ( <' +
                    e.type +
                    '>{``}</' +
                    e.type +
                    '> ) Refer to our API for more information.'
                ),
                !0
              );
            }),
            (n.mapChildrenToProps = function (e, t) {
              var n = this,
                r = {};
              return (
                p.Children.forEach(e, function (e) {
                  if (e && e.props) {
                    var a = e.props,
                      i = a.children,
                      o = et(a, eP),
                      s = Object.keys(o).reduce(function (e, t) {
                        return (e[el[t] || t] = o[t]), e;
                      }, {}),
                      l = e.type;
                    switch (
                      ('symbol' == typeof l
                        ? (l = l.toString())
                        : n.warnOnInvalidChildren(e, i),
                      l)
                    ) {
                      case en.FRAGMENT:
                        t = n.mapChildrenToProps(i, t);
                        break;
                      case en.LINK:
                      case en.META:
                      case en.NOSCRIPT:
                      case en.SCRIPT:
                      case en.STYLE:
                        r = n.flattenArrayTypeChildren({
                          child: e,
                          arrayTypeChildren: r,
                          newChildProps: s,
                          nestedChildren: i,
                        });
                        break;
                      default:
                        t = n.mapObjectTypeChildren({
                          child: e,
                          newProps: t,
                          newChildProps: s,
                          nestedChildren: i,
                        });
                    }
                  }
                }),
                this.mapArrayTypeChildrenToProps(r, t)
              );
            }),
            (n.render = function () {
              var e = this.props,
                t = e.children,
                n = et(e, e_),
                r = J({}, n),
                a = n.helmetData;
              return (
                t && (r = this.mapChildrenToProps(t, r)),
                !a || a instanceof ej || (a = new ej(a.context, a.instances)),
                a
                  ? p.createElement(
                      eO,
                      J({}, r, { context: a.value, helmetData: void 0 })
                    )
                  : p.createElement(eE.Consumer, null, function (e) {
                      return p.createElement(eO, J({}, r, { context: e }));
                    })
              );
            }),
            t
          );
        })(p.Component);
      (e$.propTypes = {
        base: q().object,
        bodyAttributes: q().object,
        children: q().oneOfType([q().arrayOf(q().node), q().node]),
        defaultTitle: q().string,
        defer: q().bool,
        encodeSpecialCharacters: q().bool,
        htmlAttributes: q().object,
        link: q().arrayOf(q().object),
        meta: q().arrayOf(q().object),
        noscript: q().arrayOf(q().object),
        onChangeClientState: q().func,
        script: q().arrayOf(q().object),
        style: q().arrayOf(q().object),
        title: q().string,
        titleAttributes: q().object,
        titleTemplate: q().string,
        prioritizeSeoTags: q().bool,
        helmetData: q().object,
      }),
        (e$.defaultProps = {
          defer: !0,
          encodeSpecialCharacters: !0,
          prioritizeSeoTags: !1,
        }),
        (e$.displayName = 'Helmet');
      var eM = W.Kd,
        eI = ({ fallback: e = (0, f.jsx)(f.Fragment, {}) }) => {
          let { pathname: t } = (0, v.zy)(),
            n = A(t);
          if (!n) return (0, f.jsx)('div', {});
          let r = n.element;
          return (0, f.jsx)(p.Suspense, {
            fallback: e,
            children: (0, f.jsx)(k, { el: r }),
          });
        },
        ez = function (e) {
          let { children: t } = e,
            [n, r] = (0, p.useState)(!1);
          return ((0, p.useEffect)(() => {
            r(!0);
          }, []),
          n)
            ? (0, f.jsx)(f.Fragment, { children: t })
            : null;
        },
        eR = function (e, t) {
          return R(H(B(e))) === R(H(B(t)));
        },
        eH = C.B6;
      C.ue;
      var eW = function (e) {
          var t;
          return $((t = e)) ||
            (function (e = '') {
              return /^\s*data:/i.test(e);
            })(t) ||
            t.startsWith('//') ||
            !e.startsWith('/')
            ? e
            : R(e);
        },
        eU = function (e) {
          return z(e, x.base);
        },
        eq = v.zy,
        eV = v.Zp,
        eG = function () {
          return (0, p.useContext)(m).data;
        };
      W.ok;
      var eZ = function () {
          return (0, p.useContext)(m).data.page.version || '';
        },
        eY = function (e, t) {
          let [n, r] = (0, p.useState)({
            width: e ?? ('undefined' == typeof window ? 1 / 0 : window.innerWidth),
            height: t ?? ('undefined' == typeof window ? 1 / 0 : window.innerHeight),
          });
          return (
            (0, p.useLayoutEffect)(() => {
              let e = () => {
                r({ width: window.innerWidth, height: window.innerHeight });
              };
              return (
                window.addEventListener('resize', e),
                () => {
                  window.removeEventListener('resize', e);
                }
              );
            }, []),
            n
          );
        };
      n(9801);
      var eK = n(2915);
      let eX =
          /[\0-\x1F!-,\.\/:-@\[-\^`\{-\xA9\xAB-\xB4\xB6-\xB9\xBB-\xBF\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0378\u0379\u037E\u0380-\u0385\u0387\u038B\u038D\u03A2\u03F6\u0482\u0530\u0557\u0558\u055A-\u055F\u0589-\u0590\u05BE\u05C0\u05C3\u05C6\u05C8-\u05CF\u05EB-\u05EE\u05F3-\u060F\u061B-\u061F\u066A-\u066D\u06D4\u06DD\u06DE\u06E9\u06FD\u06FE\u0700-\u070F\u074B\u074C\u07B2-\u07BF\u07F6-\u07F9\u07FB\u07FC\u07FE\u07FF\u082E-\u083F\u085C-\u085F\u086B-\u089F\u08B5\u08C8-\u08D2\u08E2\u0964\u0965\u0970\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09F2-\u09FB\u09FD\u09FF\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF0-\u0AF8\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B54\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B70\u0B72-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BF0-\u0BFF\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5B-\u0C5F\u0C64\u0C65\u0C70-\u0C7F\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0CFF\u0D0D\u0D11\u0D45\u0D49\u0D4F-\u0D53\u0D58-\u0D5E\u0D64\u0D65\u0D70-\u0D79\u0D80\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DE5\u0DF0\u0DF1\u0DF4-\u0E00\u0E3B-\u0E3F\u0E4F\u0E5A-\u0E80\u0E83\u0E85\u0E8B\u0EA4\u0EA6\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F01-\u0F17\u0F1A-\u0F1F\u0F2A-\u0F34\u0F36\u0F38\u0F3A-\u0F3D\u0F48\u0F6D-\u0F70\u0F85\u0F98\u0FBD-\u0FC5\u0FC7-\u0FFF\u104A-\u104F\u109E\u109F\u10C6\u10C8-\u10CC\u10CE\u10CF\u10FB\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u1360-\u137F\u1390-\u139F\u13F6\u13F7\u13FE-\u1400\u166D\u166E\u1680\u169B-\u169F\u16EB-\u16ED\u16F9-\u16FF\u170D\u1715-\u171F\u1735-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17D4-\u17D6\u17D8-\u17DB\u17DE\u17DF\u17EA-\u180A\u180E\u180F\u181A-\u181F\u1879-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191F\u192C-\u192F\u193C-\u1945\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DA-\u19FF\u1A1C-\u1A1F\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1AA6\u1AA8-\u1AAF\u1AC1-\u1AFF\u1B4C-\u1B4F\u1B5A-\u1B6A\u1B74-\u1B7F\u1BF4-\u1BFF\u1C38-\u1C3F\u1C4A-\u1C4C\u1C7E\u1C7F\u1C89-\u1C8F\u1CBB\u1CBC\u1CC0-\u1CCF\u1CD3\u1CFB-\u1CFF\u1DFA\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FBD\u1FBF-\u1FC1\u1FC5\u1FCD-\u1FCF\u1FD4\u1FD5\u1FDC-\u1FDF\u1FED-\u1FF1\u1FF5\u1FFD-\u203E\u2041-\u2053\u2055-\u2070\u2072-\u207E\u2080-\u208F\u209D-\u20CF\u20F1-\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F-\u215F\u2189-\u24B5\u24EA-\u2BFF\u2C2F\u2C5F\u2CE5-\u2CEA\u2CF4-\u2CFF\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D70-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E00-\u2E2E\u2E30-\u3004\u3008-\u3020\u3030\u3036\u3037\u303D-\u3040\u3097\u3098\u309B\u309C\u30A0\u30FB\u3100-\u3104\u3130\u318F-\u319F\u31C0-\u31EF\u3200-\u33FF\u4DC0-\u4DFF\u9FFD-\u9FFF\uA48D-\uA4CF\uA4FE\uA4FF\uA60D-\uA60F\uA62C-\uA63F\uA673\uA67E\uA6F2-\uA716\uA720\uA721\uA789\uA78A\uA7C0\uA7C1\uA7CB-\uA7F4\uA828-\uA82B\uA82D-\uA83F\uA874-\uA87F\uA8C6-\uA8CF\uA8DA-\uA8DF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA954-\uA95F\uA97D-\uA97F\uA9C1-\uA9CE\uA9DA-\uA9DF\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A-\uAA5F\uAA77-\uAA79\uAAC3-\uAADA\uAADE\uAADF\uAAF0\uAAF1\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB5B\uAB6A-\uAB6F\uABEB\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uD7FF\uE000-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB29\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBB2-\uFBD2\uFD3E-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFC-\uFDFF\uFE10-\uFE1F\uFE30-\uFE32\uFE35-\uFE4C\uFE50-\uFE6F\uFE75\uFEFD-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF3E\uFF40\uFF5B-\uFF65\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDD3F\uDD75-\uDDFC\uDDFE-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEDF\uDEE1-\uDEFF\uDF20-\uDF2C\uDF4B-\uDF4F\uDF7B-\uDF7F\uDF9E\uDF9F\uDFC4-\uDFC7\uDFD0\uDFD6-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCAF\uDCD4-\uDCD7\uDCFC-\uDCFF\uDD28-\uDD2F\uDD64-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56-\uDC5F\uDC77-\uDC7F\uDC9F-\uDCDF\uDCF3\uDCF6-\uDCFF\uDD16-\uDD1F\uDD3A-\uDD7F\uDDB8-\uDDBD\uDDC0-\uDDFF\uDE04\uDE07-\uDE0B\uDE14\uDE18\uDE36\uDE37\uDE3B-\uDE3E\uDE40-\uDE5F\uDE7D-\uDE7F\uDE9D-\uDEBF\uDEC8\uDEE7-\uDEFF\uDF36-\uDF3F\uDF56-\uDF5F\uDF73-\uDF7F\uDF92-\uDFFF]|\uD803[\uDC49-\uDC7F\uDCB3-\uDCBF\uDCF3-\uDCFF\uDD28-\uDD2F\uDD3A-\uDE7F\uDEAA\uDEAD-\uDEAF\uDEB2-\uDEFF\uDF1D-\uDF26\uDF28-\uDF2F\uDF51-\uDFAF\uDFC5-\uDFDF\uDFF7-\uDFFF]|\uD804[\uDC47-\uDC65\uDC70-\uDC7E\uDCBB-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDCFF\uDD35\uDD40-\uDD43\uDD48-\uDD4F\uDD74\uDD75\uDD77-\uDD7F\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDFF\uDE12\uDE38-\uDE3D\uDE3F-\uDE7F\uDE87\uDE89\uDE8E\uDE9E\uDEA9-\uDEAF\uDEEB-\uDEEF\uDEFA-\uDEFF\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A\uDF45\uDF46\uDF49\uDF4A\uDF4E\uDF4F\uDF51-\uDF56\uDF58-\uDF5C\uDF64\uDF65\uDF6D-\uDF6F\uDF75-\uDFFF]|\uD805[\uDC4B-\uDC4F\uDC5A-\uDC5D\uDC62-\uDC7F\uDCC6\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDB6\uDDB7\uDDC1-\uDDD7\uDDDE-\uDDFF\uDE41-\uDE43\uDE45-\uDE4F\uDE5A-\uDE7F\uDEB9-\uDEBF\uDECA-\uDEFF\uDF1B\uDF1C\uDF2C-\uDF2F\uDF3A-\uDFFF]|\uD806[\uDC3B-\uDC9F\uDCEA-\uDCFE\uDD07\uDD08\uDD0A\uDD0B\uDD14\uDD17\uDD36\uDD39\uDD3A\uDD44-\uDD4F\uDD5A-\uDD9F\uDDA8\uDDA9\uDDD8\uDDD9\uDDE2\uDDE5-\uDDFF\uDE3F-\uDE46\uDE48-\uDE4F\uDE9A-\uDE9C\uDE9E-\uDEBF\uDEF9-\uDFFF]|\uD807[\uDC09\uDC37\uDC41-\uDC4F\uDC5A-\uDC71\uDC90\uDC91\uDCA8\uDCB7-\uDCFF\uDD07\uDD0A\uDD37-\uDD39\uDD3B\uDD3E\uDD48-\uDD4F\uDD5A-\uDD5F\uDD66\uDD69\uDD8F\uDD92\uDD99-\uDD9F\uDDAA-\uDEDF\uDEF7-\uDFAF\uDFB1-\uDFFF]|\uD808[\uDF9A-\uDFFF]|\uD809[\uDC6F-\uDC7F\uDD44-\uDFFF]|[\uD80A\uD80B\uD80E-\uD810\uD812-\uD819\uD824-\uD82B\uD82D\uD82E\uD830-\uD833\uD837\uD839\uD83D\uD83F\uD87B-\uD87D\uD87F\uD885-\uDB3F\uDB41-\uDBFF][\uDC00-\uDFFF]|\uD80D[\uDC2F-\uDFFF]|\uD811[\uDE47-\uDFFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDECF\uDEEE\uDEEF\uDEF5-\uDEFF\uDF37-\uDF3F\uDF44-\uDF4F\uDF5A-\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD81B[\uDC00-\uDE3F\uDE80-\uDEFF\uDF4B-\uDF4E\uDF88-\uDF8E\uDFA0-\uDFDF\uDFE2\uDFE5-\uDFEF\uDFF2-\uDFFF]|\uD821[\uDFF8-\uDFFF]|\uD823[\uDCD6-\uDCFF\uDD09-\uDFFF]|\uD82C[\uDD1F-\uDD4F\uDD53-\uDD63\uDD68-\uDD6F\uDEFC-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A-\uDC9C\uDC9F-\uDFFF]|\uD834[\uDC00-\uDD64\uDD6A-\uDD6C\uDD73-\uDD7A\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDE41\uDE45-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3\uDFCC\uDFCD]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85-\uDE9A\uDEA0\uDEB0-\uDFFF]|\uD838[\uDC07\uDC19\uDC1A\uDC22\uDC25\uDC2B-\uDCFF\uDD2D-\uDD2F\uDD3E\uDD3F\uDD4A-\uDD4D\uDD4F-\uDEBF\uDEFA-\uDFFF]|\uD83A[\uDCC5-\uDCCF\uDCD7-\uDCFF\uDD4C-\uDD4F\uDD5A-\uDFFF]|\uD83B[\uDC00-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDFFF]|\uD83C[\uDC00-\uDD2F\uDD4A-\uDD4F\uDD6A-\uDD6F\uDD8A-\uDFFF]|\uD83E[\uDC00-\uDFEF\uDFFA-\uDFFF]|\uD869[\uDEDE-\uDEFF]|\uD86D[\uDF35-\uDF3F]|\uD86E[\uDC1E\uDC1F]|\uD873[\uDEA2-\uDEAF]|\uD87A[\uDFE1-\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uD884[\uDF4B-\uDFFF]|\uDB40[\uDC00-\uDCFF\uDDF0-\uDFFF]/g,
        eJ = function (e) {
          var t = typeof e;
          return null != e && ('object' == t || 'function' == t);
        };
      var eQ = 'object' == typeof global && global && global.Object === Object && global,
        e0 = 'object' == typeof self && self && self.Object === Object && self,
        e1 = eQ || e0 || Function('return this')();
      let e2 = function () {
        return e1.Date.now();
      };
      var e4 = /\s/;
      let e3 = function (e) {
        for (var t = e.length; t-- && e4.test(e.charAt(t)); );
        return t;
      };
      var e8 = /^\s+/,
        e6 = e1.Symbol,
        e5 = Object.prototype,
        e7 = e5.hasOwnProperty,
        e9 = e5.toString,
        te = e6 ? e6.toStringTag : void 0;
      let tt = function (e) {
        var t = e7.call(e, te),
          n = e[te];
        try {
          e[te] = void 0;
          var r = !0;
        } catch (e) {}
        var a = e9.call(e);
        return r && (t ? (e[te] = n) : delete e[te]), a;
      };
      var tn = Object.prototype.toString,
        tr = e6 ? e6.toStringTag : void 0;
      let ta = function (e) {
          return null == e
            ? void 0 === e
              ? '[object Undefined]'
              : '[object Null]'
            : tr && tr in Object(e)
              ? tt(e)
              : tn.call(e);
        },
        ti = function (e) {
          return (
            'symbol' == typeof e ||
            (null != e && 'object' == typeof e && '[object Symbol]' == ta(e))
          );
        };
      var to = 0 / 0,
        ts = /^[-+]0x[0-9a-f]+$/i,
        tl = /^0b[01]+$/i,
        tu = /^0o[0-7]+$/i,
        tc = parseInt;
      let td = function (e) {
        if ('number' == typeof e) return e;
        if (ti(e)) return to;
        if (eJ(e)) {
          var t,
            n = 'function' == typeof e.valueOf ? e.valueOf() : e;
          e = eJ(n) ? n + '' : n;
        }
        if ('string' != typeof e) return 0 === e ? e : +e;
        e = (t = e) ? t.slice(0, e3(t) + 1).replace(e8, '') : t;
        var r = tl.test(e);
        return r || tu.test(e) ? tc(e.slice(2), r ? 2 : 8) : ts.test(e) ? to : +e;
      };
      var th = Math.max,
        tf = Math.min;
      let tp = function (e, t, n) {
          var r,
            a,
            i,
            o,
            s,
            l,
            u = 0,
            c = !1,
            d = !1,
            h = !0;
          if ('function' != typeof e) throw TypeError('Expected a function');
          function f(t) {
            var n = r,
              i = a;
            return (r = a = void 0), (u = t), (o = e.apply(i, n));
          }
          function p(e) {
            var n = e - l,
              r = e - u;
            return void 0 === l || n >= t || n < 0 || (d && r >= i);
          }
          function m() {
            var e,
              n,
              r,
              a = e2();
            if (p(a)) return g(a);
            s = setTimeout(
              m,
              ((e = a - l), (n = a - u), (r = t - e), d ? tf(r, i - n) : r)
            );
          }
          function g(e) {
            return ((s = void 0), h && r) ? f(e) : ((r = a = void 0), o);
          }
          function v() {
            var e,
              n = e2(),
              i = p(n);
            if (((r = arguments), (a = this), (l = n), i)) {
              if (void 0 === s) return (u = e = l), (s = setTimeout(m, t)), c ? f(e) : o;
              if (d) return clearTimeout(s), (s = setTimeout(m, t)), f(l);
            }
            return void 0 === s && (s = setTimeout(m, t)), o;
          }
          return (
            (t = td(t) || 0),
            eJ(n) &&
              ((c = !!n.leading),
              (i = (d = 'maxWait' in n) ? th(td(n.maxWait) || 0, t) : i),
              (h = 'trailing' in n ? !!n.trailing : h)),
            (v.cancel = function () {
              void 0 !== s && clearTimeout(s), (u = 0), (r = l = a = s = void 0);
            }),
            (v.flush = function () {
              return void 0 === s ? o : g(e2());
            }),
            v
          );
        },
        tm = function (e, t, n) {
          var r = !0,
            a = !0;
          if ('function' != typeof e) throw TypeError('Expected a function');
          return (
            eJ(n) &&
              ((r = 'leading' in n ? !!n.leading : r),
              (a = 'trailing' in n ? !!n.trailing : a)),
            tp(e, t, { leading: r, maxWait: t, trailing: a })
          );
        };
      var tg = n(7903);
      let tv = (e) =>
          (0, f.jsx)('svg', {
            width: '1em',
            height: '1em',
            viewBox: '0 0 32 32',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'currentColor',
              d: 'M22 16 12 26l-1.4-1.4 8.6-8.6-8.6-8.6L12 6z',
            }),
          }),
        tx = (e) =>
          (0, f.jsx)('svg', {
            width: '1em',
            height: '1em',
            viewBox: '0 0 32 32',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'currentColor',
              d: 'M4 6h24v2H4zm0 18h24v2H4zm0-12h24v2H4zm0 6h24v2H4z',
            }),
          });
      var ty = n(7747);
      n(9216);
      let tb = (e) =>
          (0, f.jsx)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: 32,
            height: 32,
            viewBox: '0 0 24 24',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'currentColor',
              d: 'M16 7H3V5h13zM3 19h13v-2H3zm19-7-4-3v2H3v2h15v2z',
            }),
          }),
        tD = (e) =>
          (0, f.jsx)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: 32,
            height: 32,
            viewBox: '0 0 24 24',
            ...e,
            children: (0, f.jsx)('path', {
              fill: '#22a041',
              d: 'M21 5H3v2h18zM3 19h7v-2H3zm0-6h15c1 0 2 .43 2 2s-1 2-2 2h-2v-2l-4 3 4 3v-2h2c2.95 0 4-1.27 4-4 0-2.72-1-4-4-4H3z',
            }),
          }),
        tF = (e) =>
          (0, f.jsxs)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: 32,
            height: 32,
            viewBox: '0 0 30 30',
            ...e,
            children: [
              (0, f.jsx)('path', {
                fill: 'currentColor',
                d: 'M28 10v18H10V10zm0-2H10a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2',
              }),
              (0, f.jsx)('path', {
                fill: 'currentColor',
                d: 'M4 18H2V4a2 2 0 0 1 2-2h14v2H4Z',
              }),
            ],
          }),
        tw = (e) =>
          (0, f.jsx)('svg', {
            width: 32,
            height: 32,
            viewBox: '0 0 30 30',
            ...e,
            children: (0, f.jsx)('path', {
              fill: '#49cd37',
              d: 'm13 24-9-9 1.414-1.414L13 21.171 26.586 7.586 28 9z',
            }),
          });
      var tC = n(9585);
      function tj(e, t) {
        (null == t || t > e.length) && (t = e.length);
        for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
        return r;
      }
      function tE(e) {
        return (
          (function (e) {
            if (Array.isArray(e)) return tj(e);
          })(e) ||
          (function (e) {
            if (
              ('undefined' != typeof Symbol && null != e[Symbol.iterator]) ||
              null != e['@@iterator']
            )
              return Array.from(e);
          })(e) ||
          (function (e, t) {
            if (e) {
              if ('string' == typeof e) return tj(e, void 0);
              var n = {}.toString.call(e).slice(8, -1);
              return (
                'Object' === n && e.constructor && (n = e.constructor.name),
                'Map' === n || 'Set' === n
                  ? Array.from(e)
                  : 'Arguments' === n ||
                      /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)
                    ? tj(e, void 0)
                    : void 0
              );
            }
          })(e) ||
          (function () {
            throw TypeError(
              'Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
            );
          })()
        );
      }
      function tA(e) {
        return (tA =
          'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
            ? function (e) {
                return typeof e;
              }
            : function (e) {
                return e &&
                  'function' == typeof Symbol &&
                  e.constructor === Symbol &&
                  e !== Symbol.prototype
                  ? 'symbol'
                  : typeof e;
              })(e);
      }
      function tk(e, t, n) {
        var r;
        return (
          ((r = (function (e, t) {
            if ('object' != tA(e) || !e) return e;
            var n = e[Symbol.toPrimitive];
            if (void 0 !== n) {
              var r = n.call(e, t || 'default');
              if ('object' != tA(r)) return r;
              throw TypeError('@@toPrimitive must return a primitive value.');
            }
            return ('string' === t ? String : Number)(e);
          })(t, 'string')),
          (t = 'symbol' == tA(r) ? r : r + '') in e)
            ? Object.defineProperty(e, t, {
                value: n,
                enumerable: !0,
                configurable: !0,
                writable: !0,
              })
            : (e[t] = n),
          e
        );
      }
      function tS() {
        return (tS = Object.assign
          ? Object.assign.bind()
          : function (e) {
              for (var t = 1; t < arguments.length; t++) {
                var n = arguments[t];
                for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
              }
              return e;
            }).apply(null, arguments);
      }
      function tN(e, t) {
        var n = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
          var r = Object.getOwnPropertySymbols(e);
          t &&
            (r = r.filter(function (t) {
              return Object.getOwnPropertyDescriptor(e, t).enumerable;
            })),
            n.push.apply(n, r);
        }
        return n;
      }
      function tT(e) {
        for (var t = 1; t < arguments.length; t++) {
          var n = null != arguments[t] ? arguments[t] : {};
          t % 2
            ? tN(Object(n), !0).forEach(function (t) {
                tk(e, t, n[t]);
              })
            : Object.getOwnPropertyDescriptors
              ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n))
              : tN(Object(n)).forEach(function (t) {
                  Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
                });
        }
        return e;
      }
      var tB = {},
        tL = [
          'language',
          'children',
          'style',
          'customStyle',
          'codeTagProps',
          'useInlineStyles',
          'showLineNumbers',
          'showInlineLineNumbers',
          'startingLineNumber',
          'lineNumberContainerStyle',
          'lineNumberStyle',
          'wrapLines',
          'wrapLongLines',
          'lineProps',
          'renderer',
          'PreTag',
          'CodeTag',
          'code',
          'astGenerator',
        ];
      function tO(e, t) {
        var n = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
          var r = Object.getOwnPropertySymbols(e);
          t &&
            (r = r.filter(function (t) {
              return Object.getOwnPropertyDescriptor(e, t).enumerable;
            })),
            n.push.apply(n, r);
        }
        return n;
      }
      function tP(e) {
        for (var t = 1; t < arguments.length; t++) {
          var n = null != arguments[t] ? arguments[t] : {};
          t % 2
            ? tO(Object(n), !0).forEach(function (t) {
                tk(e, t, n[t]);
              })
            : Object.getOwnPropertyDescriptors
              ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n))
              : tO(Object(n)).forEach(function (t) {
                  Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
                });
        }
        return e;
      }
      var t_ = /\n/g;
      function t$(e) {
        var t,
          n,
          r,
          a,
          i = e.codeString,
          o = e.codeStyle,
          s = e.containerStyle,
          l = e.numberStyle,
          u = e.startingLineNumber;
        return p.createElement(
          'code',
          {
            style: Object.assign(
              {},
              o,
              void 0 === s ? { float: 'left', paddingRight: '10px' } : s
            ),
          },
          ((n = (t = {
            lines: i.replace(/\n$/, '').split('\n'),
            style: void 0 === l ? {} : l,
            startingLineNumber: u,
          }).lines),
          (r = t.startingLineNumber),
          (a = t.style),
          n.map(function (e, t) {
            var n = t + r;
            return p.createElement(
              'span',
              {
                key: 'line-'.concat(t),
                className: 'react-syntax-highlighter-line-number',
                style: 'function' == typeof a ? a(n) : a,
              },
              ''.concat(n, '\n')
            );
          }))
        );
      }
      function tM(e, t) {
        return {
          type: 'element',
          tagName: 'span',
          properties: {
            key: 'line-number--'.concat(e),
            className: ['comment', 'linenumber', 'react-syntax-highlighter-line-number'],
            style: t,
          },
          children: [{ type: 'text', value: e }],
        };
      }
      function tI(e, t, n) {
        var r = {
            display: 'inline-block',
            minWidth: ''.concat(n.toString().length, '.25em'),
            paddingRight: '1em',
            textAlign: 'right',
            userSelect: 'none',
          },
          a = 'function' == typeof e ? e(t) : e;
        return tP(tP({}, r), a);
      }
      function tz(e) {
        var t = e.children,
          n = e.lineNumber,
          r = e.lineNumberStyle,
          a = e.largestLineNumber,
          i = e.showInlineLineNumbers,
          o = e.lineProps,
          s = void 0 === o ? {} : o,
          l = e.className,
          u = void 0 === l ? [] : l,
          c = e.showLineNumbers,
          d = e.wrapLongLines,
          h = e.wrapLines,
          f = void 0 !== h && h ? tP({}, 'function' == typeof s ? s(n) : s) : {};
        if (
          ((f.className = f.className
            ? [].concat(tE(f.className.trim().split(/\s+/)), tE(u))
            : u),
          n && i)
        ) {
          var p = tI(r, n, a);
          t.unshift(tM(n, p));
        }
        return (
          d & c && (f.style = tP({ display: 'flex' }, f.style)),
          { type: 'element', tagName: 'span', properties: f, children: t }
        );
      }
      function tR(e) {
        var t = e.rows,
          n = e.stylesheet,
          r = e.useInlineStyles;
        return t.map(function (e, t) {
          return (function e(t) {
            var n = t.node,
              r = t.stylesheet,
              a = t.style,
              i = t.useInlineStyles,
              o = t.key,
              s = n.properties,
              l = n.type,
              u = n.tagName,
              c = n.value;
            if ('text' === l) return c;
            if (u) {
              var d,
                h,
                f =
                  ((d = 0),
                  function (t) {
                    return (
                      (d += 1),
                      t.map(function (t, n) {
                        return e({
                          node: t,
                          stylesheet: r,
                          useInlineStyles: i,
                          key: 'code-segment-'.concat(d, '-').concat(n),
                        });
                      })
                    );
                  });
              if (i) {
                var m = Object.keys(r).reduce(function (e, t) {
                    return (
                      t.split('.').forEach(function (t) {
                        e.includes(t) || e.push(t);
                      }),
                      e
                    );
                  }, []),
                  g = s.className && s.className.includes('token') ? ['token'] : [],
                  v =
                    s.className &&
                    g.concat(
                      s.className.filter(function (e) {
                        return !m.includes(e);
                      })
                    );
                h = tT(
                  tT({}, s),
                  {},
                  {
                    className: v.join(' ') || void 0,
                    style: (function (e) {
                      var t =
                          arguments.length > 1 && void 0 !== arguments[1]
                            ? arguments[1]
                            : {},
                        n = arguments.length > 2 ? arguments[2] : void 0;
                      return (function (e) {
                        if (0 === e.length || 1 === e.length) return e;
                        var t,
                          n = e.join('.');
                        return (
                          tB[n] ||
                            (tB[n] =
                              0 === (t = e.length) || 1 === t
                                ? e
                                : 2 === t
                                  ? [
                                      e[0],
                                      e[1],
                                      ''.concat(e[0], '.').concat(e[1]),
                                      ''.concat(e[1], '.').concat(e[0]),
                                    ]
                                  : 3 === t
                                    ? [
                                        e[0],
                                        e[1],
                                        e[2],
                                        ''.concat(e[0], '.').concat(e[1]),
                                        ''.concat(e[0], '.').concat(e[2]),
                                        ''.concat(e[1], '.').concat(e[0]),
                                        ''.concat(e[1], '.').concat(e[2]),
                                        ''.concat(e[2], '.').concat(e[0]),
                                        ''.concat(e[2], '.').concat(e[1]),
                                        ''
                                          .concat(e[0], '.')
                                          .concat(e[1], '.')
                                          .concat(e[2]),
                                        ''
                                          .concat(e[0], '.')
                                          .concat(e[2], '.')
                                          .concat(e[1]),
                                        ''
                                          .concat(e[1], '.')
                                          .concat(e[0], '.')
                                          .concat(e[2]),
                                        ''
                                          .concat(e[1], '.')
                                          .concat(e[2], '.')
                                          .concat(e[0]),
                                        ''
                                          .concat(e[2], '.')
                                          .concat(e[0], '.')
                                          .concat(e[1]),
                                        ''
                                          .concat(e[2], '.')
                                          .concat(e[1], '.')
                                          .concat(e[0]),
                                      ]
                                    : t >= 4
                                      ? [
                                          e[0],
                                          e[1],
                                          e[2],
                                          e[3],
                                          ''.concat(e[0], '.').concat(e[1]),
                                          ''.concat(e[0], '.').concat(e[2]),
                                          ''.concat(e[0], '.').concat(e[3]),
                                          ''.concat(e[1], '.').concat(e[0]),
                                          ''.concat(e[1], '.').concat(e[2]),
                                          ''.concat(e[1], '.').concat(e[3]),
                                          ''.concat(e[2], '.').concat(e[0]),
                                          ''.concat(e[2], '.').concat(e[1]),
                                          ''.concat(e[2], '.').concat(e[3]),
                                          ''.concat(e[3], '.').concat(e[0]),
                                          ''.concat(e[3], '.').concat(e[1]),
                                          ''.concat(e[3], '.').concat(e[2]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[1], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[1], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[2], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[2], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[3], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[3], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[0], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[0], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[2], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[2], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[3], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[3], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[0], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[0], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[1], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[1], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[3], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[3], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[0], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[0], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[1], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[1], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[2], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[2], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[1], '.')
                                            .concat(e[2], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[1], '.')
                                            .concat(e[3], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[2], '.')
                                            .concat(e[1], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[2], '.')
                                            .concat(e[3], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[3], '.')
                                            .concat(e[1], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[0], '.')
                                            .concat(e[3], '.')
                                            .concat(e[2], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[0], '.')
                                            .concat(e[2], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[0], '.')
                                            .concat(e[3], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[2], '.')
                                            .concat(e[0], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[2], '.')
                                            .concat(e[3], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[3], '.')
                                            .concat(e[0], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[1], '.')
                                            .concat(e[3], '.')
                                            .concat(e[2], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[0], '.')
                                            .concat(e[1], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[0], '.')
                                            .concat(e[3], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[1], '.')
                                            .concat(e[0], '.')
                                            .concat(e[3]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[1], '.')
                                            .concat(e[3], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[3], '.')
                                            .concat(e[0], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[2], '.')
                                            .concat(e[3], '.')
                                            .concat(e[1], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[0], '.')
                                            .concat(e[1], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[0], '.')
                                            .concat(e[2], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[1], '.')
                                            .concat(e[0], '.')
                                            .concat(e[2]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[1], '.')
                                            .concat(e[2], '.')
                                            .concat(e[0]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[2], '.')
                                            .concat(e[0], '.')
                                            .concat(e[1]),
                                          ''
                                            .concat(e[3], '.')
                                            .concat(e[2], '.')
                                            .concat(e[1], '.')
                                            .concat(e[0]),
                                        ]
                                      : void 0),
                          tB[n]
                        );
                      })(
                        e.filter(function (e) {
                          return 'token' !== e;
                        })
                      ).reduce(function (e, t) {
                        return tT(tT({}, e), n[t]);
                      }, t);
                    })(s.className, Object.assign({}, s.style, void 0 === a ? {} : a), r),
                  }
                );
              } else h = tT(tT({}, s), {}, { className: s.className.join(' ') });
              var x = f(n.children);
              return p.createElement(u, tS({ key: o }, h), x);
            }
          })({
            node: e,
            stylesheet: n,
            useInlineStyles: r,
            key: 'code-segement'.concat(t),
          });
        });
      }
      function tH(e) {
        return e && void 0 !== e.highlightAuto;
      }
      var tW = n(9984),
        tU = n.n(tW),
        tq =
          ((a = tU()),
          (i = {}),
          function (e) {
            var t = e.language,
              n = e.children,
              r = e.style,
              o = void 0 === r ? i : r,
              s = e.customStyle,
              l = void 0 === s ? {} : s,
              u = e.codeTagProps,
              c =
                void 0 === u
                  ? {
                      className: t ? 'language-'.concat(t) : void 0,
                      style: tP(
                        tP({}, o['code[class*="language-"]']),
                        o['code[class*="language-'.concat(t, '"]')]
                      ),
                    }
                  : u,
              d = e.useInlineStyles,
              h = void 0 === d || d,
              f = e.showLineNumbers,
              m = void 0 !== f && f,
              g = e.showInlineLineNumbers,
              v = void 0 === g || g,
              x = e.startingLineNumber,
              y = void 0 === x ? 1 : x,
              b = e.lineNumberContainerStyle,
              D = e.lineNumberStyle,
              F = void 0 === D ? {} : D,
              w = e.wrapLines,
              C = e.wrapLongLines,
              j = void 0 !== C && C,
              E = e.lineProps,
              A = e.renderer,
              k = e.PreTag,
              S = void 0 === k ? 'pre' : k,
              N = e.CodeTag,
              T = void 0 === N ? 'code' : N,
              B = e.code,
              L = void 0 === B ? (Array.isArray(n) ? n[0] : n) || '' : B,
              O = e.astGenerator,
              P = (function (e, t) {
                if (null == e) return {};
                var n,
                  r,
                  a = (function (e, t) {
                    if (null == e) return {};
                    var n = {};
                    for (var r in e)
                      if ({}.hasOwnProperty.call(e, r)) {
                        if (-1 !== t.indexOf(r)) continue;
                        n[r] = e[r];
                      }
                    return n;
                  })(e, t);
                if (Object.getOwnPropertySymbols) {
                  var i = Object.getOwnPropertySymbols(e);
                  for (r = 0; r < i.length; r++)
                    (n = i[r]),
                      -1 === t.indexOf(n) &&
                        {}.propertyIsEnumerable.call(e, n) &&
                        (a[n] = e[n]);
                }
                return a;
              })(e, tL);
            O = O || a;
            var _ = m
                ? p.createElement(t$, {
                    containerStyle: b,
                    codeStyle: c.style || {},
                    numberStyle: F,
                    startingLineNumber: y,
                    codeString: L,
                  })
                : null,
              $ = o.hljs || o['pre[class*="language-"]'] || { backgroundColor: '#fff' },
              M = tH(O) ? 'hljs' : 'prismjs',
              I = h
                ? Object.assign({}, P, { style: Object.assign({}, $, l) })
                : Object.assign({}, P, {
                    className: P.className ? ''.concat(M, ' ').concat(P.className) : M,
                    style: Object.assign({}, l),
                  });
            if (
              (j
                ? (c.style = tP({ whiteSpace: 'pre-wrap' }, c.style))
                : (c.style = tP({ whiteSpace: 'pre' }, c.style)),
              !O)
            )
              return p.createElement(S, I, _, p.createElement(T, c, L));
            ((void 0 === w && A) || j) && (w = !0), (A = A || tR);
            var z = [{ type: 'text', value: L }],
              R = (function (e) {
                var t = e.astGenerator,
                  n = e.language,
                  r = e.code,
                  a = e.defaultCodeValue;
                if (tH(t)) {
                  var i = -1 !== t.listLanguages().indexOf(n);
                  return 'text' === n
                    ? { value: a, language: 'text' }
                    : i
                      ? t.highlight(n, r)
                      : t.highlightAuto(r);
                }
                try {
                  return n && 'text' !== n ? { value: t.highlight(r, n) } : { value: a };
                } catch (e) {
                  return { value: a };
                }
              })({ astGenerator: O, language: t, code: L, defaultCodeValue: z });
            null === R.language && (R.value = z);
            var H = R.value.length;
            1 === H &&
              'text' === R.value[0].type &&
              (H = R.value[0].value.split('\n').length);
            var W = H + y,
              U = (function (e, t, n, r, a, i, o, s, l) {
                var u,
                  c = (function e(t) {
                    for (
                      var n =
                          arguments.length > 1 && void 0 !== arguments[1]
                            ? arguments[1]
                            : [],
                        r =
                          arguments.length > 2 && void 0 !== arguments[2]
                            ? arguments[2]
                            : [],
                        a = 0;
                      a < t.length;
                      a++
                    ) {
                      var i = t[a];
                      if ('text' === i.type)
                        r.push(tz({ children: [i], className: tE(new Set(n)) }));
                      else if (i.children) {
                        var o = n.concat(i.properties.className);
                        e(i.children, o).forEach(function (e) {
                          return r.push(e);
                        });
                      }
                    }
                    return r;
                  })(e.value),
                  d = [],
                  h = -1,
                  f = 0;
                function p(e, i) {
                  var u =
                    arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : [];
                  return t || u.length > 0
                    ? (function (e, i) {
                        var u =
                          arguments.length > 2 && void 0 !== arguments[2]
                            ? arguments[2]
                            : [];
                        return tz({
                          children: e,
                          lineNumber: i,
                          lineNumberStyle: s,
                          largestLineNumber: o,
                          showInlineLineNumbers: a,
                          lineProps: n,
                          className: u,
                          showLineNumbers: r,
                          wrapLongLines: l,
                          wrapLines: t,
                        });
                      })(e, i, u)
                    : (function (e, t) {
                        if (r && t && a) {
                          var n = tI(s, t, o);
                          e.unshift(tM(t, n));
                        }
                        return e;
                      })(e, i);
                }
                for (; f < c.length; )
                  !(function () {
                    var e = c[f],
                      t = e.children[0].value;
                    if (t.match(t_)) {
                      var n = t.split('\n');
                      n.forEach(function (t, a) {
                        var o = r && d.length + i,
                          s = { type: 'text', value: ''.concat(t, '\n') };
                        if (0 === a) {
                          var l = p(
                            c
                              .slice(h + 1, f)
                              .concat(
                                tz({ children: [s], className: e.properties.className })
                              ),
                            o
                          );
                          d.push(l);
                        } else if (a === n.length - 1) {
                          var u = c[f + 1] && c[f + 1].children && c[f + 1].children[0],
                            m = { type: 'text', value: ''.concat(t) };
                          if (u) {
                            var g = tz({
                              children: [m],
                              className: e.properties.className,
                            });
                            c.splice(f + 1, 0, g);
                          } else {
                            var v = p([m], o, e.properties.className);
                            d.push(v);
                          }
                        } else {
                          var x = p([s], o, e.properties.className);
                          d.push(x);
                        }
                      }),
                        (h = f);
                    }
                    f++;
                  })();
                if (h !== c.length - 1) {
                  var m = c.slice(h + 1, c.length);
                  if (m && m.length) {
                    var g = p(m, r && d.length + i);
                    d.push(g);
                  }
                }
                return t ? d : (u = []).concat.apply(u, d);
              })(R, w, void 0 === E ? {} : E, m, v, y, W, F, j);
            return p.createElement(
              S,
              I,
              p.createElement(
                T,
                c,
                !v && _,
                A({ rows: U, stylesheet: o, useInlineStyles: h })
              )
            );
          });
      (tq.registerLanguage = function (e, t) {
        return tU().register(t);
      }),
        (tq.alias = function (e, t) {
          return tU().alias(e, t);
        });
      let tV = { javascript: ['js'], markdown: ['md'], tsx: ['mdx'], typescript: ['ts'] },
        tG = {
          javascript: n(2068).default,
          markdown: n(8509).default,
          tsx: n(429).default,
          typescript: n(8823).default,
          yaml: n(815).default,
        };
      function tZ(e) {
        return void 0 === e || e;
      }
      function tY(e) {
        let t = Array(e);
        for (let n = 0; n < e; n++) t[n] = tK();
        return t;
      }
      function tK() {
        return Object.create(null);
      }
      function tX(e, t) {
        return t.length - e.length;
      }
      function tJ(e) {
        return 'string' == typeof e;
      }
      function tQ(e) {
        return 'object' == typeof e;
      }
      function t0(e) {
        return 'function' == typeof e;
      }
      function t1(e, t) {
        var n = t2;
        if (
          e &&
          (t && (e = t8(e, t)),
          this.H && (e = t8(e, this.H)),
          this.J && 1 < e.length && (e = t8(e, this.J)),
          n || '' === n)
        )
          if (((t = e.split(n)), this.filter)) {
            (e = this.filter), (n = t.length);
            let r = [];
            for (let a = 0, i = 0; a < n; a++) {
              let n = t[a];
              n && !e[n] && (r[i++] = n);
            }
            e = r;
          } else e = t;
        return e;
      }
      let t2 = /[\p{Z}\p{S}\p{P}\p{C}]+/u,
        t4 = /[\u0300-\u036f]/g;
      function t3(e, t) {
        let n = Object.keys(e),
          r = n.length,
          a = [],
          i = '',
          o = 0;
        for (let s = 0, l, u; s < r; s++)
          (u = e[(l = n[s])])
            ? ((a[o++] = t6(t ? '(?!\\b)' + l + '(\\b|_)' : l)), (a[o++] = u))
            : (i += (i ? '|' : '') + l);
        return (
          i &&
            ((a[o++] = t6(t ? '(?!\\b)(' + i + ')(\\b|_)' : '(' + i + ')')), (a[o] = '')),
          a
        );
      }
      function t8(e, t) {
        for (let n = 0, r = t.length; n < r && (e = e.replace(t[n], t[n + 1])); n += 2);
        return e;
      }
      function t6(e) {
        return RegExp(e, 'g');
      }
      function t5(e) {
        let t = '',
          n = '';
        for (let r = 0, a = e.length, i; r < a; r++) (i = e[r]) !== n && (t += n = i);
        return t;
      }
      function t7(e) {
        return t1.call(this, ('' + e).toLowerCase(), !1);
      }
      let t9 = {},
        ne = {};
      function nt(e) {
        nn(e, 'add'), nn(e, 'append'), nn(e, 'search'), nn(e, 'update'), nn(e, 'remove');
      }
      function nn(e, t) {
        e[t + 'Async'] = function () {
          let e,
            n = this,
            r = arguments;
          var a = r[r.length - 1];
          return (
            t0(a) && ((e = a), delete r[r.length - 1]),
            (a = new Promise(function (e) {
              setTimeout(function () {
                n.async = !0;
                let a = n[t].apply(n, r);
                (n.async = !1), e(a);
              });
            })),
            e ? (a.then(e), this) : a
          );
        };
      }
      function nr(e, t, n, r) {
        let a = e.length,
          i = [],
          o,
          s,
          l = 0;
        r && (r = []);
        for (let u = a - 1; 0 <= u; u--) {
          let c = e[u],
            d = c.length,
            h = tK(),
            f = !o;
          for (let e = 0; e < d; e++) {
            let d = c[e],
              p = d.length;
            if (p)
              for (let e = 0, c, m; e < p; e++)
                if (((m = d[e]), o)) {
                  if (o[m]) {
                    if (!u) {
                      if (n) n--;
                      else if (((i[l++] = m), l === t)) return i;
                    }
                    (u || r) && (h[m] = 1), (f = !0);
                  }
                  if (r && ((c = (s[m] || 0) + 1), (s[m] = c), c < a)) {
                    let e = r[c - 2] || (r[c - 2] = []);
                    e[e.length] = m;
                  }
                } else h[m] = 1;
          }
          if (r) o || (s = h);
          else if (!f) return [];
          o = h;
        }
        if (r)
          for (let e = r.length - 1, a, s; 0 <= e; e--) {
            s = (a = r[e]).length;
            for (let e = 0, r; e < s; e++)
              if (!o[(r = a[e])]) {
                if (n) n--;
                else if (((i[l++] = r), l === t)) return i;
                o[r] = 1;
              }
          }
        return i;
      }
      function na(e) {
        (this.l = !0 !== e && e), (this.cache = tK()), (this.h = []);
      }
      function ni(e, t, n) {
        tQ(e) && (e = e.query);
        let r = this.cache.get(e);
        return r || ((r = this.search(e, t, n)), this.cache.set(e, r)), r;
      }
      (na.prototype.set = function (e, t) {
        if (!this.cache[e]) {
          var n = this.h.length;
          for (n === this.l ? delete this.cache[this.h[n - 1]] : n++, --n; 0 < n; n--)
            this.h[n] = this.h[n - 1];
          this.h[0] = e;
        }
        this.cache[e] = t;
      }),
        (na.prototype.get = function (e) {
          let t = this.cache[e];
          if (this.l && t && (e = this.h.indexOf(e))) {
            let t = this.h[e - 1];
            (this.h[e - 1] = this.h[e]), (this.h[e] = t);
          }
          return t;
        });
      let no = {
        memory: { charset: 'latin:extra', D: 3, B: 4, m: !1 },
        performance: { D: 3, B: 3, s: !1, context: { depth: 2, D: 1 } },
        match: { charset: 'latin:extra', G: 'reverse' },
        score: { charset: 'latin:advanced', D: 20, B: 3, context: { depth: 3, D: 9 } },
        default: {},
      };
      function ns(e, t, n, r, a, i, o, s) {
        setTimeout(function () {
          let l = e(n ? n + '.' + r : r, JSON.stringify(o));
          l && l.then
            ? l.then(function () {
                t.export(e, t, n, a, i + 1, s);
              })
            : t.export(e, t, n, a, i + 1, s);
        });
      }
      function nl(e, t) {
        if (!(this instanceof nl)) return new nl(e);
        if (e) {
          tJ(e) ? (e = no[e]) : (n = e.preset) && (e = Object.assign({}, n[n], e));
          var n = e.charset,
            r = e.lang;
          tJ(n) && (-1 === n.indexOf(':') && (n += ':default'), (n = ne[n])),
            tJ(r) && (r = t9[r]);
        } else e = {};
        let a,
          i,
          o = e.context || {};
        if (
          ((this.encode = e.encode || (n && n.encode) || t7),
          (this.register = t || tK()),
          (this.D = a = e.resolution || 9),
          (this.G = t = (n && n.G) || e.tokenize || 'strict'),
          (this.depth = 'strict' === t && o.depth),
          (this.l = tZ(o.bidirectional)),
          (this.s = i = tZ(e.optimize)),
          (this.m = tZ(e.fastupdate)),
          (this.B = e.minlength || 1),
          (this.C = e.boost),
          (this.map = i ? tY(a) : tK()),
          (this.A = a = o.resolution || 1),
          (this.h = i ? tY(a) : tK()),
          (this.F = (n && n.F) || e.rtl),
          (this.H = (t = e.matcher || (r && r.H)) && t3(t, !1)),
          (this.J = (t = e.stemmer || (r && r.J)) && t3(t, !0)),
          (n = t = e.filter || (r && r.filter)))
        ) {
          (n = t), (r = tK());
          for (let e = 0, t = n.length; e < t; e++) r[n[e]] = 1;
          n = r;
        }
        (this.filter = n), (this.cache = (t = e.cache) && new na(t));
      }
      function nu(e, t, n, r, a) {
        return n && 1 < e
          ? t + (r || 0) <= e
            ? n + (a || 0)
            : (((e - 1) / (t + (r || 0))) * (n + (a || 0)) + 1) | 0
          : 0;
      }
      function nc(e, t, n, r, a, i, o) {
        let s = o ? e.h : e.map;
        (!t[n] || (o && !t[n][o])) &&
          (e.s && (s = s[r]),
          o
            ? (((t = t[n] || (t[n] = tK()))[o] = 1), (s = s[o] || (s[o] = tK())))
            : (t[n] = 1),
          (s = s[n] || (s[n] = [])),
          e.s || (s = s[r] || (s[r] = [])),
          (i && s.includes(a)) ||
            ((s[s.length] = a),
            e.m && ((e = e.register[a] || (e.register[a] = []))[e.length] = s)));
      }
      function nd(e, t, n, r, a, i, o, s) {
        let l = [],
          u = s ? e.h : e.map;
        if ((e.s || (u = nf(u, o, s, e.l)), u)) {
          let n = 0,
            c = Math.min(u.length, s ? e.A : e.D);
          for (
            let t = 0, d = 0, h, f;
            t < c &&
            (!(h = u[t]) ||
              (e.s && (h = nf(h, o, s, e.l)),
              a &&
                h &&
                i &&
                ((f = h.length) <= a
                  ? ((a -= f), (h = null))
                  : ((h = h.slice(a)), (a = 0))),
              !h || ((l[n++] = h), !i || !((d += h.length) >= r))));
            t++
          );
          if (n) return i ? nh(l, r, 0) : void (t[t.length] = l);
        }
        return !n && l;
      }
      function nh(e, t, n) {
        return (
          (e = 1 === e.length ? e[0] : [].concat.apply([], e)),
          n || e.length > t ? e.slice(n, n + t) : e
        );
      }
      function nf(e, t, n, r) {
        return n ? (e = e[(r = r && t > n) ? t : n]) && e[r ? n : t] : e[t];
      }
      function np(e, t, n, r, a) {
        let i = 0;
        if (e.constructor === Array)
          if (a) -1 !== (t = e.indexOf(t)) ? 1 < e.length && (e.splice(t, 1), i++) : i++;
          else {
            a = Math.min(e.length, n);
            for (let o = 0, s; o < a; o++)
              (s = e[o]) && ((i = np(s, t, n, r, a)), r || i || delete e[o]);
          }
        else for (let o in e) (i = np(e[o], t, n, r, a)) || delete e[o];
        return i;
      }
      function nm(e) {
        e = e.data;
        var t = self._index;
        let n = e.args;
        var r = e.task;
        'init' === r
          ? ((r = e.options || {}),
            (e = e.factory),
            (t = r.encode),
            (r.cache = !1),
            t && 0 === t.indexOf('function') && (r.encode = Function('return ' + t)()),
            e
              ? (Function('return ' + e)()(self),
                (self._index = new self.FlexSearch.Index(r)),
                delete self.FlexSearch)
              : (self._index = new nl(r)))
          : ((e = e.id),
            (t = t[r].apply(t, n)),
            postMessage('search' === r ? { id: e, msg: t } : { id: e }));
      }
      ((s = nl.prototype).append = function (e, t) {
        return this.add(e, t, !0);
      }),
        (s.add = function (e, t, n, r) {
          if (t && (e || 0 === e)) {
            if (!r && !n && this.register[e]) return this.update(e, t);
            if ((r = (t = this.encode(t)).length)) {
              let u = tK(),
                c = tK(),
                d = this.depth,
                h = this.D;
              for (let f = 0; f < r; f++) {
                let p = t[this.F ? r - 1 - f : f];
                var a = p.length;
                if (p && a >= this.B && (d || !c[p])) {
                  var i = nu(h, r, f),
                    o = '';
                  switch (this.G) {
                    case 'full':
                      if (2 < a) {
                        for (i = 0; i < a; i++)
                          for (var s = a; s > i; s--)
                            if (s - i >= this.B) {
                              var l = nu(h, r, f, a, i);
                              nc(this, c, (o = p.substring(i, s)), l, e, n);
                            }
                        break;
                      }
                    case 'reverse':
                      if (1 < a) {
                        for (s = a - 1; 0 < s; s--)
                          (o = p[s] + o).length >= this.B &&
                            nc(this, c, o, nu(h, r, f, a, s), e, n);
                        o = '';
                      }
                    case 'forward':
                      if (1 < a) {
                        for (s = 0; s < a; s++)
                          (o += p[s]).length >= this.B && nc(this, c, o, i, e, n);
                        break;
                      }
                    default:
                      if (
                        (this.C && (i = Math.min((i / this.C(t, p, f)) | 0, h - 1)),
                        nc(this, c, p, i, e, n),
                        d && 1 < r && f < r - 1)
                      ) {
                        for (
                          a = tK(),
                            o = this.A,
                            i = p,
                            s = Math.min(d + 1, r - f),
                            a[i] = 1,
                            l = 1;
                          l < s;
                          l++
                        )
                          if (
                            (p = t[this.F ? r - 1 - f - l : f + l]) &&
                            p.length >= this.B &&
                            !a[p]
                          ) {
                            a[p] = 1;
                            let t = this.l && p > i;
                            nc(
                              this,
                              u,
                              t ? i : p,
                              nu(o + (r / 2 > o ? 0 : 1), r, f, s - 1, l - 1),
                              e,
                              n,
                              t ? p : i
                            );
                          }
                      }
                  }
                }
              }
              this.m || (this.register[e] = 1);
            }
          }
          return this;
        }),
        (s.search = function (e, t, n) {
          let r, a, i;
          n || (!t && tQ(e) ? (e = (n = e).query) : tQ(t) && (n = t));
          let o = [],
            s,
            l,
            u = 0;
          if (n) {
            (e = n.query || e), (t = n.limit), (u = n.offset || 0);
            var c = n.context;
            l = n.suggest;
          }
          if (e && 1 < (s = (e = this.encode('' + e)).length)) {
            n = tK();
            var d = [];
            for (let t = 0, r = 0, a; t < s; t++)
              if ((a = e[t]) && a.length >= this.B && !n[a])
                if (!this.s && !l && !this.map[a]) return o;
                else (d[r++] = a), (n[a] = 1);
            s = (e = d).length;
          }
          if (!s) return o;
          for (
            t || (t = 100),
              c = this.depth && 1 < s && !1 !== c,
              n = 0,
              c ? ((r = e[0]), (n = 1)) : 1 < s && e.sort(tX);
            n < s;
            n++
          ) {
            if (
              ((i = e[n]),
              c
                ? ((a = nd(this, o, l, t, u, 2 === s, i, r)),
                  (l && !1 === a && o.length) || (r = i))
                : (a = nd(this, o, l, t, u, 1 === s, i)),
              a)
            )
              return a;
            if (l && n === s - 1) {
              if (!(d = o.length)) {
                if (c) {
                  (c = 0), (n = -1);
                  continue;
                }
                return o;
              }
              if (1 === d) return nh(o[0], t, u);
            }
          }
          return nr(o, t, u, l);
        }),
        (s.contain = function (e) {
          return !!this.register[e];
        }),
        (s.update = function (e, t) {
          return this.remove(e).add(e, t);
        }),
        (s.remove = function (e, t) {
          let n = this.register[e];
          if (n) {
            if (this.m)
              for (let t = 0, r; t < n.length; t++) (r = n[t]).splice(r.indexOf(e), 1);
            else
              np(this.map, e, this.D, this.s),
                this.depth && np(this.h, e, this.A, this.s);
            if ((t || delete this.register[e], this.cache)) {
              t = this.cache;
              for (let n = 0, r; n < t.h.length; n++)
                (r = t.h[n]),
                  t.cache[r].includes(e) && (t.h.splice(n--, 1), delete t.cache[r]);
            }
          }
          return this;
        }),
        (s.searchCache = ni),
        (s.export = function (e, t, n, r, a, i) {
          let o,
            s,
            l = !0;
          switch (
            (void 0 === i &&
              (l = new Promise((e) => {
                i = e;
              })),
            a || (a = 0))
          ) {
            case 0:
              if (((o = 'reg'), this.m))
                for (let e in ((s = tK()), this.register)) s[e] = 1;
              else s = this.register;
              break;
            case 1:
              (o = 'cfg'), (s = { doc: 0, opt: +!!this.s });
              break;
            case 2:
              (o = 'map'), (s = this.map);
              break;
            case 3:
              (o = 'ctx'), (s = this.h);
              break;
            default:
              void 0 === n && i && i();
              return;
          }
          return ns(e, t || this, n, o, r, a, s, i), l;
        }),
        (s.import = function (e, t) {
          if (t)
            switch ((tJ(t) && (t = JSON.parse(t)), e)) {
              case 'cfg':
                this.s = !!t.opt;
                break;
              case 'reg':
                (this.m = !1), (this.register = t);
                break;
              case 'map':
                this.map = t;
                break;
              case 'ctx':
                this.h = t;
            }
        }),
        nt(nl.prototype);
      let ng = 0;
      function nv(e) {
        var t;
        if (!(this instanceof nv)) return new nv(e);
        e ? t0((t = e.encode)) && (e.encode = t.toString()) : (e = {}),
          (t = (self || window)._factory) && (t = t.toString());
        let r = 'undefined' == typeof window && self.exports,
          a = this;
        (this.o = (function (e, t, r) {
          let a;
          try {
            a = t
              ? new (n(6244).Worker)('//node/node.js')
              : e
                ? new Worker(
                    URL.createObjectURL(
                      new Blob(['onmessage=' + nm.toString()], {
                        type: 'text/javascript',
                      })
                    )
                  )
                : new Worker(tJ(r) ? r : 'worker/worker.js', { type: 'module' });
          } catch (e) {}
          return a;
        })(t, r, e.worker)),
          (this.h = tK()),
          this.o &&
            (r
              ? this.o.on('message', function (e) {
                  a.h[e.id](e.msg), delete a.h[e.id];
                })
              : (this.o.onmessage = function (e) {
                  (e = e.data), a.h[e.id](e.msg), delete a.h[e.id];
                }),
            this.o.postMessage({ task: 'init', factory: t, options: e }));
      }
      function nx(e) {
        nv.prototype[e] = nv.prototype[e + 'Async'] = function () {
          let t,
            n = this,
            r = [].slice.call(arguments);
          var a = r[r.length - 1];
          return (
            t0(a) && ((t = a), r.splice(r.length - 1, 1)),
            (a = new Promise(function (t) {
              setTimeout(function () {
                (n.h[++ng] = t), n.o.postMessage({ task: e, id: ng, args: r });
              });
            })),
            t ? (a.then(t), this) : a
          );
        };
      }
      function ny(e) {
        if (!(this instanceof ny)) return new ny(e);
        var t,
          n = e.document || e.doc || e;
        (this.K = []),
          (this.h = []),
          (this.A = []),
          (this.register = tK()),
          (this.key = ((t = n.key || n.id) && nb(t, this.A)) || 'id'),
          (this.m = tZ(e.fastupdate)),
          (this.C = (t = n.store) && !0 !== t && []),
          (this.store = t && tK()),
          (this.I = (t = n.tag) && nb(t, this.A)),
          (this.l = t && tK()),
          (this.cache = (t = e.cache) && new na(t)),
          (e.cache = !1),
          (this.o = e.worker),
          (this.async = !1),
          (t = tK());
        let r = n.index || n.field || n;
        tJ(r) && (r = [r]);
        for (let n = 0, a, i; n < r.length; n++)
          tJ((a = r[n])) || ((i = a), (a = a.field)),
            (i = tQ(i) ? Object.assign({}, e, i) : e),
            this.o && ((t[a] = new nv(i)), t[a].o || (this.o = !1)),
            this.o || (t[a] = new nl(i, this.register)),
            (this.K[n] = nb(a, this.A)),
            (this.h[n] = a);
        if (this.C)
          for (tJ((e = n.store)) && (e = [e]), n = 0; n < e.length; n++)
            this.C[n] = nb(e[n], this.A);
        this.index = t;
      }
      function nb(e, t) {
        let n = e.split(':'),
          r = 0;
        for (let a = 0; a < n.length; a++)
          0 <= (e = n[a]).indexOf('[]') &&
            (e = e.substring(0, e.length - 2)) &&
            (t[r] = !0),
            e && (n[r++] = e);
        return r < n.length && (n.length = r), 1 < r ? n : n[0];
      }
      function nD(e, t) {
        if (tJ(t)) e = e[t];
        else for (let n = 0; e && n < t.length; n++) e = e[t[n]];
        return e;
      }
      function nF(e, t, n, r) {
        let a = this.l[e],
          i = a && a.length - n;
        if (i && 0 < i)
          return (
            (i > t || n) && (a = a.slice(n, n + t)),
            r && (a = nw.call(this, a)),
            { tag: e, result: a }
          );
      }
      function nw(e) {
        let t = Array(e.length);
        for (let n = 0, r; n < e.length; n++)
          (r = e[n]), (t[n] = { id: r, doc: this.store[r] });
        return t;
      }
      nx('add'),
        nx('append'),
        nx('search'),
        nx('update'),
        nx('remove'),
        ((s = ny.prototype).add = function (e, t, n) {
          if ((tQ(e) && (e = nD((t = e), this.key)), t && (e || 0 === e))) {
            if (!n && this.register[e]) return this.update(e, t);
            for (let r = 0, a, i; r < this.h.length; r++)
              (i = this.h[r]),
                tJ((a = this.K[r])) && (a = [a]),
                (function e(t, n, r, a, i, o, s, l) {
                  if ((t = t[s]))
                    if (a === n.length - 1) {
                      if (t.constructor === Array) {
                        if (r[a]) {
                          for (n = 0; n < t.length; n++) i.add(o, t[n], !0, !0);
                          return;
                        }
                        t = t.join(' ');
                      }
                      i.add(o, t, l, !0);
                    } else if (t.constructor === Array)
                      for (s = 0; s < t.length; s++) e(t, n, r, a, i, o, s, l);
                    else (s = n[++a]), e(t, n, r, a, i, o, s, l);
                })(t, a, this.A, 0, this.index[i], e, a[0], n);
            if (this.I) {
              let r = nD(t, this.I),
                a = tK();
              tJ(r) && (r = [r]);
              for (let t = 0, i, o; t < r.length; t++)
                if (
                  !a[(i = r[t])] &&
                  ((a[i] = 1),
                  (o = this.l[i] || (this.l[i] = [])),
                  !n || !o.includes(e)) &&
                  ((o[o.length] = e), this.m)
                ) {
                  let t = this.register[e] || (this.register[e] = []);
                  t[t.length] = o;
                }
            }
            if (this.store && (!n || !this.store[e])) {
              let n;
              if (this.C) {
                n = tK();
                for (let e = 0, r; e < this.C.length; e++)
                  tJ((r = this.C[e]))
                    ? (n[r] = t[r])
                    : (function e(t, n, r, a, i) {
                        if (((t = t[i]), a === r.length - 1)) n[i] = t;
                        else if (t)
                          if (t.constructor === Array)
                            for (n = n[i] = Array(t.length), i = 0; i < t.length; i++)
                              e(t, n, r, a, i);
                          else
                            (n = n[i] || (n[i] = tK())), (i = r[++a]), e(t, n, r, a, i);
                      })(t, n, r, 0, r[0]);
              }
              this.store[e] = n || t;
            }
          }
          return this;
        }),
        (s.append = function (e, t) {
          return this.add(e, t, !0);
        }),
        (s.update = function (e, t) {
          return this.remove(e).add(e, t);
        }),
        (s.remove = function (e) {
          if ((tQ(e) && (e = nD(e, this.key)), this.register[e])) {
            for (
              var t = 0;
              t < this.h.length && (this.index[this.h[t]].remove(e, !this.o), !this.m);
              t++
            );
            if (this.I && !this.m)
              for (let n in this.l) {
                let r = (t = this.l[n]).indexOf(e);
                -1 !== r && (1 < t.length ? t.splice(r, 1) : delete this.l[n]);
              }
            this.store && delete this.store[e], delete this.register[e];
          }
          return this;
        }),
        (s.search = function (e, t, n, r) {
          n || (!t && tQ(e) ? ((n = e), (e = '')) : tQ(t) && ((n = t), (t = 0)));
          let a = [],
            i = [],
            o,
            s,
            l,
            u,
            c,
            d,
            h = 0;
          if (n)
            if (n.constructor === Array) (l = n), (n = null);
            else {
              if (
                ((e = n.query || e),
                (l = (o = n.pluck) || n.index || n.field),
                (u = n.tag),
                (s = this.store && n.enrich),
                (c = 'and' === n.bool),
                (t = n.limit || t || 100),
                (d = n.offset || 0),
                u && (tJ(u) && (u = [u]), !e))
              ) {
                for (let e = 0, n; e < u.length; e++)
                  (n = nF.call(this, u[e], t, d, s)) && ((a[a.length] = n), h++);
                return h ? a : [];
              }
              tJ(l) && (l = [l]);
            }
          l || (l = this.h), (c = c && (1 < l.length || (u && 1 < u.length)));
          let f = !r && (this.o || this.async) && [];
          for (let o = 0, p, m, g; o < l.length; o++) {
            let v;
            if (
              (tJ((m = l[o])) ||
                ((m = (v = m).field),
                (e = v.query || e),
                (t = v.limit || t),
                (s = v.enrich || s)),
              f)
            )
              f[o] = this.index[m].searchAsync(e, t, v || n);
            else {
              if (
                ((g = (p = r ? r[o] : this.index[m].search(e, t, v || n)) && p.length),
                u && g)
              ) {
                let e = [],
                  n = 0;
                c && (e[0] = [p]);
                for (let t = 0, r, a; t < u.length; t++)
                  (r = u[t]),
                    (g = (a = this.l[r]) && a.length) &&
                      (n++, (e[e.length] = c ? [a] : a));
                n &&
                  (g = (p = c
                    ? nr(e, t || 100, d || 0)
                    : (function (e, t) {
                        let n = tK(),
                          r = tK(),
                          a = [];
                        for (let t = 0; t < e.length; t++) n[e[t]] = 1;
                        for (let e = 0, i; e < t.length; e++) {
                          i = t[e];
                          for (let e = 0, t; e < i.length; e++)
                            n[(t = i[e])] && !r[t] && ((r[t] = 1), (a[a.length] = t));
                        }
                        return a;
                      })(p, e)).length);
              }
              if (g) (i[h] = m), (a[h++] = p);
              else if (c) return [];
            }
          }
          if (f) {
            let r = this;
            return new Promise(function (a) {
              Promise.all(f).then(function (i) {
                a(r.search(e, t, n, i));
              });
            });
          }
          if (!h) return [];
          if (o && (!s || !this.store)) return a[0];
          for (let e = 0, t; e < i.length; e++) {
            if (((t = a[e]).length && s && (t = nw.call(this, t)), o)) return t;
            a[e] = { field: i[e], result: t };
          }
          return a;
        }),
        (s.contain = function (e) {
          return !!this.register[e];
        }),
        (s.get = function (e) {
          return this.store[e];
        }),
        (s.set = function (e, t) {
          return (this.store[e] = t), this;
        }),
        (s.searchCache = ni),
        (s.export = function (e, t, n, r, a, i) {
          let o;
          if (
            (void 0 === i &&
              (o = new Promise((e) => {
                i = e;
              })),
            a || (a = 0),
            r || (r = 0),
            r < this.h.length)
          ) {
            let n = this.h[r],
              o = this.index[n];
            (t = this),
              setTimeout(function () {
                o.export(e, t, a ? n : '', r, a++, i) ||
                  (r++, (a = 1), t.export(e, t, n, r, a, i));
              });
          } else {
            let t, o;
            switch (a) {
              case 1:
                (t = 'tag'), (o = this.l), (n = null);
                break;
              case 2:
                (t = 'store'), (o = this.store), (n = null);
                break;
              default:
                i();
                return;
            }
            ns(e, this, n, t, r, a, o, i);
          }
          return o;
        }),
        (s.import = function (e, t) {
          if (t)
            switch ((tJ(t) && (t = JSON.parse(t)), e)) {
              case 'tag':
                this.l = t;
                break;
              case 'reg':
                (this.m = !1), (this.register = t);
                for (let e = 0, n; e < this.h.length; e++)
                  ((n = this.index[this.h[e]]).register = t), (n.m = !1);
                break;
              case 'store':
                this.store = t;
                break;
              default:
                let n = (e = e.split('.'))[0];
                (e = e[1]), n && e && this.index[n].import(e, t);
            }
        }),
        nt(ny.prototype);
      let nC = [
        t6('[\xe0\xe1\xe2\xe3\xe4\xe5]'),
        'a',
        t6('[\xe8\xe9\xea\xeb]'),
        'e',
        t6('[\xec\xed\xee\xef]'),
        'i',
        t6('[\xf2\xf3\xf4\xf5\xf6ő]'),
        'o',
        t6('[\xf9\xfa\xfb\xfcű]'),
        'u',
        t6('[\xfdŷ\xff]'),
        'y',
        t6('\xf1'),
        'n',
        t6('[\xe7c]'),
        'k',
        t6('\xdf'),
        's',
        t6(' & '),
        ' and ',
      ];
      function nj(e) {
        var t = (e = '' + e);
        return (
          t.normalize && (t = t.normalize('NFD').replace(t4, '')),
          t1.call(this, t.toLowerCase(), !e.normalize && nC)
        );
      }
      let nE = /[^a-z0-9]+/,
        nA = {
          b: 'p',
          v: 'f',
          w: 'f',
          z: 's',
          x: 's',
          ß: 's',
          d: 't',
          n: 'm',
          c: 'k',
          g: 'k',
          j: 'k',
          q: 'k',
          i: 'e',
          y: 'e',
          u: 'o',
        };
      function nk(e) {
        e = nj.call(this, e).join(' ');
        let t = [];
        if (e) {
          let n = e.split(nE),
            r = n.length;
          for (let a = 0, i, o = 0; a < r; a++)
            if ((e = n[a]) && (!this.filter || !this.filter[e])) {
              let n = nA[(i = e[0])] || i,
                r = n;
              for (let t = 1; t < e.length; t++) {
                let a = nA[(i = e[t])] || i;
                a && a !== r && ((n += a), (r = a));
              }
              t[o++] = n;
            }
        }
        return t;
      }
      let nS = [
        t6('ae'),
        'a',
        t6('oe'),
        'o',
        t6('sh'),
        's',
        t6('th'),
        't',
        t6('ph'),
        'f',
        t6('pf'),
        'f',
        t6('(?![aeo])h(?![aeo])'),
        '',
        t6('(?!^[aeo])h(?!^[aeo])'),
        '',
      ];
      function nN(e, t) {
        return (
          e &&
            (2 < (e = nk.call(this, e).join(' ')).length && (e = t8(e, nS)),
            t || (1 < e.length && (e = t5(e)), e && (e = e.split(' ')))),
          e || []
        );
      }
      let nT = t6('(?!\\b)[aeo]');
      (ne['latin:default'] = { encode: t7, F: !1, G: '' }),
        (ne['latin:simple'] = { encode: nj, F: !1, G: '' }),
        (ne['latin:balance'] = { encode: nk, F: !1, G: 'strict' }),
        (ne['latin:advanced'] = { encode: nN, F: !1, G: '' }),
        (ne['latin:extra'] = {
          encode: function (e) {
            return (
              e &&
                (1 < (e = nN.call(this, e, !0)).length && (e = e.replace(nT, '')),
                1 < e.length && (e = t5(e)),
                e && (e = e.split(' '))),
              e || []
            );
          },
          F: !1,
          G: '',
        });
      let nB = { '###': 'aa4b2a4b' },
        nL = (e) =>
          (0, f.jsxs)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: 32,
            height: 32,
            viewBox: '0 0 32 32',
            ...e,
            children: [
              (0, f.jsx)('circle', { cx: 8, cy: 16, r: 2, fill: 'currentColor' }),
              (0, f.jsx)('circle', { cx: 16, cy: 16, r: 2, fill: 'currentColor' }),
              (0, f.jsx)('circle', { cx: 24, cy: 16, r: 2, fill: 'currentColor' }),
            ],
          });
      var nO = !1;
      if ('undefined' != typeof window) {
        var nP = {
          get passive() {
            nO = !0;
            return;
          },
        };
        window.addEventListener('testPassive', null, nP),
          window.removeEventListener('testPassive', null, nP);
      }
      var n_ =
          'undefined' != typeof window &&
          window.navigator &&
          window.navigator.platform &&
          (/iP(ad|hone|od)/.test(window.navigator.platform) ||
            ('MacIntel' === window.navigator.platform &&
              window.navigator.maxTouchPoints > 1)),
        n$ = [],
        nM = !1,
        nI = -1,
        nz = void 0,
        nR = void 0,
        nH = void 0,
        nW = function (e) {
          return n$.some(function (t) {
            return !!(t.options.allowTouchMove && t.options.allowTouchMove(e));
          });
        },
        nU = function (e) {
          var t = e || window.event;
          return (
            !!nW(t.target) ||
            t.touches.length > 1 ||
            (t.preventDefault && t.preventDefault(), !1)
          );
        },
        nq = function (e) {
          if (void 0 === nH) {
            var t = !!e && !0 === e.reserveScrollBarGap,
              n = window.innerWidth - document.documentElement.clientWidth;
            if (t && n > 0) {
              var r = parseInt(
                window.getComputedStyle(document.body).getPropertyValue('padding-right'),
                10
              );
              (nH = document.body.style.paddingRight),
                (document.body.style.paddingRight = r + n + 'px');
            }
          }
          void 0 === nz &&
            ((nz = document.body.style.overflow),
            (document.body.style.overflow = 'hidden'));
        },
        nV = function () {
          void 0 !== nH && ((document.body.style.paddingRight = nH), (nH = void 0)),
            void 0 !== nz && ((document.body.style.overflow = nz), (nz = void 0));
        },
        nG = function () {
          if (void 0 !== nR) {
            var e = -parseInt(document.body.style.top, 10),
              t = -parseInt(document.body.style.left, 10);
            (document.body.style.position = nR.position),
              (document.body.style.top = nR.top),
              (document.body.style.left = nR.left),
              window.scrollTo(t, e),
              (nR = void 0);
          }
        },
        nZ = function (e, t) {
          var n = e.targetTouches[0].clientY - nI;
          return (
            !nW(e.target) &&
            (t && 0 === t.scrollTop && n > 0
              ? nU(e)
              : t && t.scrollHeight - t.scrollTop <= t.clientHeight && n < 0
                ? nU(e)
                : (e.stopPropagation(), !0))
          );
        },
        nY = function (e, t) {
          e
            ? !n$.some(function (t) {
                return t.targetElement === e;
              }) &&
              ((n$ = [].concat(
                (function (e) {
                  if (!Array.isArray(e)) return Array.from(e);
                  for (var t = 0, n = Array(e.length); t < e.length; t++) n[t] = e[t];
                  return n;
                })(n$),
                [{ targetElement: e, options: t || {} }]
              )),
              n_
                ? window.requestAnimationFrame(function () {
                    if (void 0 === nR) {
                      nR = {
                        position: document.body.style.position,
                        top: document.body.style.top,
                        left: document.body.style.left,
                      };
                      var e = window,
                        t = e.scrollY,
                        n = e.scrollX,
                        r = e.innerHeight;
                      (document.body.style.position = 'fixed'),
                        (document.body.style.top = -t),
                        (document.body.style.left = -n),
                        setTimeout(function () {
                          return window.requestAnimationFrame(function () {
                            var e = r - window.innerHeight;
                            e && t >= r && (document.body.style.top = -(t + e));
                          });
                        }, 300);
                    }
                  })
                : nq(t),
              n_ &&
                ((e.ontouchstart = function (e) {
                  1 === e.targetTouches.length && (nI = e.targetTouches[0].clientY);
                }),
                (e.ontouchmove = function (t) {
                  1 === t.targetTouches.length && nZ(t, e);
                }),
                nM ||
                  (document.addEventListener(
                    'touchmove',
                    nU,
                    nO ? { passive: !1 } : void 0
                  ),
                  (nM = !0))))
            : console.error(
                'disableBodyScroll unsuccessful - targetElement must be provided when calling disableBodyScroll on IOS devices.'
              );
        },
        nK = function () {
          n_ &&
            (n$.forEach(function (e) {
              (e.targetElement.ontouchstart = null), (e.targetElement.ontouchmove = null);
            }),
            nM &&
              (document.removeEventListener(
                'touchmove',
                nU,
                nO ? { passive: !1 } : void 0
              ),
              (nM = !1)),
            (nI = -1)),
            n_ ? nG() : nV(),
            (n$ = []);
        };
      let nX = (e) =>
          (0, f.jsx)('svg', {
            width: 18,
            height: 18,
            viewBox: '0 0 32 32',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'currentColor',
              d: 'M27.85 29H30l-6-15h-2.35l-6 15h2.15l1.6-4h6.85zm-7.65-6 2.62-6.56L25.45 23zM18 7V5h-7V2H9v3H2v2h10.74a14.7 14.7 0 0 1-3.19 6.18A13.5 13.5 0 0 1 7.26 9h-2.1a16.5 16.5 0 0 0 3 5.58A16.8 16.8 0 0 1 3 18l.75 1.86A18.5 18.5 0 0 0 9.53 16a16.9 16.9 0 0 0 5.76 3.84L16 18a14.5 14.5 0 0 1-5.12-3.37A17.64 17.64 0 0 0 14.8 7z',
            }),
          }),
        nJ = (e) =>
          (0, f.jsx)('svg', {
            width: '1em',
            height: '1em',
            viewBox: '0 0 32 32',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'currentColor',
              d: 'M16 22 6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z',
            }),
          }),
        nQ = (e) =>
          (0, f.jsx)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            'aria-hidden': 'true',
            viewBox: '0 0 24 24',
            ...e,
            children: (0, f.jsx)('path', {
              d: 'M12.1 22h-.9c-5.5-.5-9.5-5.4-9-10.9.4-4.8 4.2-8.6 9-9 .4 0 .8.2 1 .5s.2.8-.1 1.1c-2 2.7-1.4 6.4 1.3 8.4 2.1 1.6 5 1.6 7.1 0 .3-.2.7-.3 1.1-.1.3.2.5.6.5 1-.2 2.7-1.5 5.1-3.6 6.8-1.9 1.4-4.1 2.2-6.4 2.2M9.3 4.4c-2.9 1-5 3.6-5.2 6.8-.4 4.4 2.8 8.3 7.2 8.7 2.1.2 4.2-.4 5.8-1.8 1.1-.9 1.9-2.1 2.4-3.4-2.5.9-5.3.5-7.5-1.1-2.8-2.2-3.9-5.9-2.7-9.2',
            }),
          }),
        n0 = (e) =>
          (0, f.jsx)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            'aria-hidden': 'true',
            viewBox: '0 0 24 24',
            ...e,
            children: (0, f.jsx)('path', {
              d: 'M12 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6m0-10c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4M12 4c-.6 0-1-.4-1-1V1c0-.6.4-1 1-1s1 .4 1 1v2c0 .6-.4 1-1 1M12 24c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1s1 .4 1 1v2c0 .6-.4 1-1 1M5.6 6.6c-.3 0-.5-.1-.7-.3L3.5 4.9c-.4-.4-.4-1 0-1.4s1-.4 1.4 0l1.4 1.4c.4.4.4 1 0 1.4-.1.2-.4.3-.7.3M19.8 20.8c-.3 0-.5-.1-.7-.3l-1.4-1.4c-.4-.4-.4-1 0-1.4s1-.4 1.4 0l1.4 1.4c.4.4.4 1 0 1.4-.2.2-.5.3-.7.3M3 13H1c-.6 0-1-.4-1-1s.4-1 1-1h2c.6 0 1 .4 1 1s-.4 1-1 1M23 13h-2c-.6 0-1-.4-1-1s.4-1 1-1h2c.6 0 1 .4 1 1s-.4 1-1 1M4.2 20.8c-.3 0-.5-.1-.7-.3-.4-.4-.4-1 0-1.4l1.4-1.4c.4-.4 1-.4 1.4 0s.4 1 0 1.4l-1.4 1.4c-.2.2-.4.3-.7.3M18.4 6.6c-.3 0-.5-.1-.7-.3-.4-.4-.4-1 0-1.4l1.4-1.4c.4-.4 1-.4 1.4 0s.4 1 0 1.4l-1.4 1.4c-.2.2-.5.3-.7.3',
            }),
          }),
        n1 = (e) =>
          (0, f.jsx)('svg', {
            width: '1em',
            height: '1em',
            viewBox: '0 0 32 32',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'currentColor',
              d: 'M16 22 6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z',
            }),
          }),
        n2 = (e) =>
          (0, f.jsx)('svg', {
            width: 24,
            height: 24,
            viewBox: '0 0 32 32',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'var(--rp-c-gray)',
              d: 'm29 27.586-7.552-7.552a11.018 11.018 0 1 0-1.414 1.414L27.586 29ZM4 13a9 9 0 1 1 9 9 9.01 9.01 0 0 1-9-9',
            }),
          }),
        n4 = (e) =>
          (0, f.jsx)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: 24,
            height: 24,
            viewBox: '0 0 32 32',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'currentColor',
              d: 'M24 9.4 22.6 8 16 14.6 9.4 8 8 9.4l6.6 6.6L8 22.6 9.4 24l6.6-6.6 6.6 6.6 1.4-1.4-6.6-6.6z',
            }),
          }),
        n3 = (e) =>
          (0, f.jsx)('svg', {
            width: 32,
            height: 32,
            viewBox: '0 0 24 24',
            ...e,
            children: (0, f.jsxs)('g', {
              fill: 'none',
              stroke: 'var(--rp-c-brand)',
              strokeLinecap: 'round',
              strokeWidth: 2,
              children: [
                (0, f.jsx)('path', {
                  strokeDasharray: 60,
                  strokeDashoffset: 60,
                  strokeOpacity: 0.3,
                  d: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
                  children: (0, f.jsx)('animate', {
                    fill: 'freeze',
                    attributeName: 'stroke-dashoffset',
                    dur: '1.3s',
                    values: '60;0',
                  }),
                }),
                (0, f.jsxs)('path', {
                  strokeDasharray: 15,
                  strokeDashoffset: 15,
                  d: 'M12 3a9 9 0 0 1 9 9',
                  children: [
                    (0, f.jsx)('animate', {
                      fill: 'freeze',
                      attributeName: 'stroke-dashoffset',
                      dur: '0.3s',
                      values: '15;0',
                    }),
                    (0, f.jsx)('animateTransform', {
                      attributeName: 'transform',
                      dur: '1.5s',
                      repeatCount: 'indefinite',
                      type: 'rotate',
                      values: '0 12 12;360 12 12',
                    }),
                  ],
                }),
              ],
            }),
          }),
        n8 = () => {},
        n6 = (e) =>
          (0, f.jsxs)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: 48,
            height: 48,
            fill: 'none',
            viewBox: '0 0 48 48',
            ...e,
            children: [
              (0, f.jsx)('path', {
                stroke: 'currentColor',
                strokeWidth: 4,
                d: 'M24 5v6m7 1 4-4m-18 4-4-4m27 33H8a2 2 0 0 1-2-2v-8.46a2 2 0 0 1 .272-1.007l6.15-10.54A2 2 0 0 1 14.148 18H33.85a2 2 0 0 1 1.728.992l6.149 10.541A2 2 0 0 1 42 30.541V39a2 2 0 0 1-2 2Z',
              }),
              (0, f.jsx)('path', {
                stroke: 'currentColor',
                strokeWidth: 4,
                d: 'M41.5 30H28s-1 3-4 3-4-3-4-3H6.5',
              }),
            ],
          }),
        n5 = (e) =>
          (0, f.jsx)('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: 24,
            height: 24,
            viewBox: '0 0 32 32',
            ...e,
            children: (0, f.jsx)('path', {
              fill: 'currentColor',
              d: 'M13.414 17.586 18 22.172V8H8V6h10a2 2 0 0 1 2 2v14.172l4.586-4.586L26 19l-7 7-7-7Z',
            }),
          });
      function n7() {
        let {
            siteData: { themeConfig: e },
          } = eG(),
          t = e.hideNavbar ?? 'never',
          [n, r] = (0, p.useState)(!1),
          { pathname: a } = eq(),
          i = (0, p.useRef)(0);
        return (
          'never' !== t &&
          ('always' === t ||
            ((0, p.useEffect)(() => {
              r(!1);
              let e = tm(() => {
                let { scrollTop: e } = document.documentElement;
                e === i.current ||
                  (r(i.current > 0 && e - i.current > 0), (i.current = e <= 0 ? 0 : e));
              }, 200);
              return (
                window.addEventListener('scroll', e),
                () => {
                  window.removeEventListener('scroll', e);
                }
              );
            }, [a]),
            n))
        );
      }
      function n9() {
        let e = eG(),
          {
            page: { lang: t },
          } = e,
          n = e?.siteData?.themeConfig ?? {},
          r = e.siteData.lang ?? '',
          a = n?.locales;
        return a && 0 !== a.length
          ? { ...a.find((e) => e.lang === t), langRoutePrefix: t === r ? '/' : O(t) }
          : {
              nav: n.nav,
              sidebar: n.sidebar,
              prevPageText: n.prevPageText,
              nextPageText: n.nextPageText,
              sourceCodeText: n.sourceCodeText,
              searchPlaceholderText: n.searchPlaceholderText,
              searchNoResultsText: n.searchNoResultsText,
              searchSuggestedQueryText: n.searchSuggestedQueryText,
              overview: n.overview,
            };
      }
      function re() {
        let { page: e, siteData: t } = eG(),
          { frontmatter: n } = e,
          { themeConfig: r } = t,
          a = n9(),
          i = eq(),
          o = n?.overview ?? !1,
          s = () => {
            let e = 'undefined' == typeof window || window.top === window.self;
            return (n?.outline ?? r?.outline ?? e) && !o;
          },
          [l, u] = (function () {
            let {
                siteData: { themeConfig: e },
                page: { frontmatter: t = {} },
              } = eG(),
              n = (t?.navbar ?? !0) && e?.hideNavbar !== 'always',
              [r, a] = (0, p.useState)(n);
            return [r, a];
          })(),
          c = n7(),
          [d, h] = (0, p.useState)(s()),
          [f, m] = (0, p.useState)(n?.footer ?? !0),
          g = a.sidebar || {},
          v = n?.sidebar !== !1 && Object.keys(g).length > 0,
          { width: x } = eY(),
          y = x <= 960 || (x <= 1280 && e.toc.length > 0);
        (0, p.useEffect)(() => {
          h(s());
        }, [e, t]),
          (0, p.useEffect)(() => {
            let e = new URLSearchParams(i.search),
              t = document.documentElement.style,
              n = t.getPropertyValue('--rp-sidebar-width'),
              r = t.getPropertyValue('--rp-aside-width'),
              a = e.get('navbar'),
              o = e.get('sidebar'),
              s = e.get('outline'),
              c = e.get('footer');
            return (
              '0' === a && u(!1),
              '0' === o &&
                document.documentElement.style.setProperty('--rp-sidebar-width', '0px'),
              '0' === s &&
                document.documentElement.style.setProperty('--rp-aside-width', '0px'),
              '0' === c && m(!1),
              () => {
                document.documentElement.style.setProperty('--rp-sidebar-width', n),
                  document.documentElement.style.setProperty('--rp-aside-width', r),
                  u(l),
                  m(f);
              }
            );
          }, [i.search]);
        let b = c ? 0 : x <= 768 ? 56 : 72,
          D = 46 * !!y;
        return {
          showAside: d,
          showNavbar: l,
          showSidebar: v,
          showSidebarMenu: y,
          showDocFooter: f,
          navbarHeight: b,
          sidebarMenuHeight: D,
          scrollPaddingTop: b + D,
        };
      }
      function rt(e, t) {
        let n = Number.parseInt(window.getComputedStyle(e).paddingTop, 10);
        return Math.round(window.scrollY + e.getBoundingClientRect().top - t - n);
      }
      function rn(e, t, n) {
        window.scrollTo({ left: 0, top: rt(e, n), ...(t ? { behavior: 'smooth' } : {}) });
      }
      function rr(e) {
        return e
          ? 'number' == typeof e
            ? e
            : /<([a-z]+)([^<]*)(?:>(.*?)<\/\1>|\s*\/>)/i.test(e)
              ? tg(e)
              : e
                  .replace(/\\</g, '<')
                  .replace(/\\>/g, '>')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
          : '';
      }
      let ra = /`(.*?)`/g,
        ri = /\*{2}(?!\*)(.*?)\*{2}(?!\*)/g,
        ro = /\*(?!\*)(.*?)\*(?!\*)/g,
        rs = /\~{2}(.*?)\~{2}/g;
      function rl(e) {
        return rr(
          e
            .replace(/`[^`]+`/g, (e) => e.replace(/</g, '&lt;'))
            .replace(ri, '<strong>$1</strong>')
            .replace(ro, '<em>$1</em>')
            .replace(rs, '<del>$1</del>')
            .replace(ra, '<code>$1</code>')
        );
      }
      let ru = ({ header: e, baseHeaderLevel: t }) =>
        (0, f.jsx)('li', {
          children: (0, f.jsx)('a', {
            href: `#${e.id}`,
            title: e.text
              .replace(ri, '$1')
              .replace(ro, '$1')
              .replace(rs, '$1')
              .replace(ra, '$1'),
            className:
              'aside-link transition-all duration-300 hover:text-text-1 text-text-2 block',
            style: { marginLeft: (e.depth - t) * 12, fontWeight: 'semibold' },
            onClick: (t) => {
              t.preventDefault(), (window.location.hash = e.id);
            },
            children: (0, f.jsx)('span', {
              className: 'aside-link-text block',
              children: rl(e.text),
            }),
          }),
        });
      function rc({ headers: e, outlineTitle: t }) {
        let { scrollPaddingTop: n } = re(),
          r = e[0]?.depth || 2,
          { hash: a = '', pathname: i } = eq(),
          o = (0, p.useMemo)(() => decodeURIComponent(a), [a]);
        return (
          (function (e) {
            let { scrollPaddingTop: t } = re();
            (0, p.useEffect)(() => {
              let n = document.getElementById('aside-container'),
                r = Array.from(
                  document.querySelectorAll('.rspress-doc .header-anchor')
                ).filter((e) => e.parentElement?.tagName !== 'H1');
              if (!n || !r.length || !e.length) return;
              let a = null,
                i = (e, t) => {
                  if (e[t]) {
                    let r = e[t].getAttribute('href'),
                      i = n?.querySelector(`a[href="#${r?.slice(1)}"]`);
                    i &&
                      (a && a.classList.remove('aside-active'),
                      (a = i).classList.add('aside-active'));
                  }
                },
                o = () => {
                  if (
                    document.documentElement.scrollTop + window.innerHeight >=
                    document.documentElement.scrollHeight
                  )
                    i(r, r.length - 1);
                  else
                    for (let e = 0; e < r.length; e++) {
                      let n = r[e],
                        a = r[e + 1],
                        o = Math.ceil(window.scrollY),
                        s = rt(n.parentElement, t);
                      if ((0 === e && o < s) || 0 === o) {
                        i(r, 0);
                        break;
                      }
                      if (!a) {
                        i(r, e);
                        break;
                      }
                      let l = rt(a.parentElement, t);
                      if (o >= s && o < l) {
                        i(r, e);
                        break;
                      }
                    }
                },
                s = tm(o, 100);
              return (
                window.addEventListener('scroll', s),
                o(),
                () => {
                  a && a.classList.remove('aside-active'),
                    window.removeEventListener('scroll', s);
                }
              );
            }, [t, e.length]);
          })(e),
          (0, p.useEffect)(() => {
            if (0 === o.length) window.scrollTo(0, 0);
            else {
              let e = document.getElementById(o.slice(1));
              e && rn(e, !1, n);
            }
          }, [o, e, i]),
          (0, f.jsx)('div', {
            className: 'flex flex-col',
            children: (0, f.jsxs)('div', {
              id: 'aside-container',
              className: 'relative text-sm font-medium',
              children: [
                (0, f.jsx)('div', {
                  className: 'leading-7 block text-sm font-semibold pl-3',
                  children: t,
                }),
                (0, f.jsx)('nav', {
                  className: 'mt-1',
                  children: (0, f.jsx)('ul', {
                    className: 'relative',
                    children: e.map((e) =>
                      (0, f.jsx)(ru, { baseHeaderLevel: r, header: e }, `${i}#${e.id}`)
                    ),
                  }),
                }),
              ],
            }),
          })
        );
      }
      let rd = (e, t) => {
        let n = R(e);
        if (n === t) return !0;
        let r = O(n);
        if (t.startsWith(r)) return !0;
        let a = `${n}.`;
        return t.startsWith(a);
      };
      function rh(e, t) {
        return null !== eH(j(R(e)), j(t));
      }
      function rf() {
        let { sidebar: e } = n9(),
          { pathname: t } = eq(),
          n = decodeURIComponent(t);
        return (0, p.useMemo)(
          () =>
            ((e, t) => {
              for (let n of Object.keys(e).sort((e, t) => t.length - e.length))
                if (rd(n, t)) return e[n];
              return [];
            })(e, n),
          [e, n]
        );
      }
      function rp() {
        let { prevPage: e, nextPage: t } = (function () {
            let { pathname: e } = eq(),
              t = rf(),
              n = [],
              r = (e) => {
                'items' in e
                  ? (e.link && n.push({ text: e.text, link: e.link }),
                    e.items.forEach((e) => {
                      'dividerType' in e || r(e);
                    }))
                  : n.push(e);
              };
            t.forEach((e) => !('dividerType' in e) && r(e));
            let a = n.findIndex((t) => eR(R(t.link), e));
            return { prevPage: n[a - 1] || null, nextPage: n[a + 1] || null };
          })(),
          { lastUpdated: n = !1 } = n9(),
          { siteData: r } = eG(),
          { themeConfig: a } = r,
          i = a.lastUpdated || n;
        return (0, f.jsxs)('footer', {
          className: 'mt-8',
          children: [
            (0, f.jsx)('div', {
              className: 'xs:flex pb-5 px-2 justify-end items-center',
              children: i && (0, f.jsx)(aT, {}),
            }),
            (0, f.jsx)('div', {
              className: 'flex flex-col',
              children: (0, f.jsx)(aC, {}),
            }),
            (0, f.jsxs)('div', {
              className: 'flex flex-col sm:flex-row sm:justify-around gap-4 pt-6',
              children: [
                (0, f.jsx)('div', {
                  className: 'prev_c92d1 flex flex-col',
                  children: e
                    ? (0, f.jsx)(a9, { type: 'prev', text: e.text, href: H(e.link) })
                    : null,
                }),
                (0, f.jsx)('div', {
                  className: 'next_c11be flex flex-col',
                  children: t
                    ? (0, f.jsx)(a9, { type: 'next', text: t.text, href: H(t.link) })
                    : null,
                }),
              ],
            }),
          ],
        });
      }
      let rm = 'menu-item_b8238',
        rg = () => {
          let { siteData: e } = eG(),
            t = n9(),
            { logo: n, logoText: r } = e,
            a = t.title ?? e.title,
            i = (0, p.useMemo)(
              () =>
                n
                  ? 'string' == typeof n
                    ? (0, f.jsx)('img', {
                        src: eW(n),
                        alt: 'logo',
                        id: 'logo',
                        className: 'rspress-logo',
                      })
                    : (0, f.jsxs)(f.Fragment, {
                        children: [
                          (0, f.jsx)('img', {
                            src: eW(n.light),
                            alt: 'logo',
                            id: 'logo',
                            className: 'rspress-logo dark:hidden',
                          }),
                          (0, f.jsx)('img', {
                            src: eW(n.dark),
                            alt: 'logo',
                            id: 'logo',
                            className: 'rspress-logo hidden dark:block',
                          }),
                        ],
                      })
                  : null,
              [n]
            );
          return (0, f.jsx)('div', {
            className: 'navBarTitle_c5f07',
            children: (0, f.jsxs)(rL, {
              href: t.langRoutePrefix,
              className:
                'flex items-center w-full h-full text-base font-semibold transition-opacity duration-300 hover:opacity-60',
              children: [
                i && (0, f.jsx)('div', { className: 'mr-1 min-w-8', children: i }),
                r && (0, f.jsx)('span', { children: r }),
                !i && !r && (0, f.jsx)('span', { children: a }),
              ],
            }),
          });
        };
      function rv(e) {
        let { depth: t, dividerType: n } = e;
        return (0, f.jsx)('div', {
          className: `${'dashed' === n ? 'border-dashed' : 'border-solid'} border-t border-divider-light my-3`,
          style: { marginLeft: 0 === t ? 0 : '18px' },
        });
      }
      function rx({ icon: e, ...t }) {
        return e
          ? 'string' == typeof e
            ? (0, f.jsx)('img', { src: e, alt: '', ...t })
            : (0, f.jsx)(e, { ...t })
          : null;
      }
      let ry = 'menuItem_ac22e',
        rb = 'menuItemActive_de63c',
        rD = (e) => !('items' in e) && 'link' in e,
        rF = (e) => {
          let t = A(e);
          t && t.preload();
        },
        rw = () => {
          let { pathname: e } = eq();
          return (0, p.useCallback)((t) => rh(t, decodeURIComponent(e)), [e]);
        };
      function rC(e) {
        let { item: t, depth: n = 0, activeMatcher: r, id: a, setSidebarData: i } = e,
          o = eV(),
          s = (0, p.useRef)(null),
          l = (0, p.useRef)(),
          u = (0, p.useRef)(null),
          c = (0, p.useRef)(!0),
          d = (0, p.useRef)('collapsed' in t && t.collapsed),
          h = t.link && r(t.link),
          { collapsed: m, collapsible: g = !0 } = t,
          v = (0, f.jsx)('div', {
            style: {
              cursor: 'pointer',
              transition: 'transform 0.2s ease-out',
              transform: m ? 'rotate(0deg)' : 'rotate(90deg)',
            },
            children: (0, f.jsx)(rx, { icon: tv }),
          });
        (0, p.useEffect)(() => {
          if (c.current || !s.current || !u.current) return;
          l.current && clearTimeout(l.current);
          let e = s.current,
            t = u.current,
            n = t.clientHeight + 4;
          m
            ? ((e.style.maxHeight = `${n}px`),
              (e.style.transitionDuration = '0.5s'),
              (t.style.opacity = '0'),
              (l.current = window.setTimeout(() => {
                s.current && (s.current.style.maxHeight = '0px');
              }, 0)))
            : ((e.style.maxHeight = `${n}px`),
              (e.style.transitionDuration = '0.3s'),
              (t.style.opacity = '1'),
              (l.current = window.setTimeout(() => {
                s.current && s.current.style.removeProperty('max-height');
              }, 300)));
        }, [m]),
          (0, p.useEffect)(() => {
            c.current = !1;
          }, []);
        let x = (e) => {
          e.stopPropagation(),
            i((e) => {
              let t = [...e],
                n = a.split('-').map(Number),
                r = t[n.shift()];
              for (let e of n) r = r.items[e];
              return 'items' in r && (r.collapsed = !r.collapsed), t;
            });
        };
        return (0, f.jsxs)(
          'section',
          {
            className: 'rspress-sidebar-section mt-0.5 block',
            'data-context': t.context,
            style: { marginLeft: 0 === n ? 0 : '18px' },
            children: [
              (0, f.jsxs)('div', {
                className: `rspress-sidebar-collapse flex justify-between items-center ${h ? rb : ry}`,
                'data-context': t.context,
                onMouseEnter: () => t.link && rF(t.link),
                onClick: (e) => {
                  t.link && o(R(H(t.link))), g && x(e);
                },
                style: {
                  borderRadius:
                    0 === n ? '0 var(--rp-radius) var(--rp-radius) 0' : void 0,
                  cursor: g || t.link ? 'pointer' : 'normal',
                },
                children: [
                  (0, f.jsxs)('h2', {
                    className: 'py-2 px-3 text-sm font-medium flex',
                    style: { ...(0 === n ? rA : {}) },
                    children: [
                      (0, f.jsx)(ic, { tag: t.tag }),
                      (0, f.jsx)('span', {
                        className: 'flex-center',
                        style: { fontSize: 0 === n ? '14px' : '13px' },
                        children: rl(t.text),
                      }),
                    ],
                  }),
                  g &&
                    (0, f.jsx)('div', {
                      className: 'collapseContainer_d6e4e p-2 rounded-xl',
                      onClick: x,
                      children: v,
                    }),
                ],
              }),
              (0, f.jsx)('div', {
                ref: s,
                className: 'transition-all duration-300 ease-in-out',
                style: { overflow: 'hidden', maxHeight: d.current ? 0 : void 0 },
                children: (0, f.jsx)('div', {
                  ref: u,
                  className:
                    'rspress-sidebar-group transition-opacity duration-500 ease-in-out',
                  style: { opacity: +!d.current, marginLeft: 0 === n ? '12px' : 0 },
                  children: t?.items?.map((t, r) =>
                    'dividerType' in t
                      ? (0, f.jsx)(rv, { depth: n + 1, dividerType: t.dividerType }, r)
                      : (0, f.jsx)(
                          'div',
                          {
                            className: 'rspress-sidebar-item',
                            'data-context': t.context,
                            children: (0, f.jsx)(rj, {
                              ...e,
                              item: t,
                              depth: n + 1,
                              id: `${a}-${r}`,
                            }),
                          },
                          r
                        )
                  ),
                }),
              }),
            ],
          },
          a
        );
      }
      function rj(e) {
        let { item: t, depth: n = 0, activeMatcher: r, id: a, setSidebarData: i } = e,
          o = 'link' in t && t.link && r(t.link),
          s = (0, p.useRef)(null);
        return ((0, p.useEffect)(() => {
          o && s.current?.scrollIntoView({ block: 'center' });
        }, []),
        'items' in t)
          ? (0, f.jsx)(
              rC,
              {
                id: a,
                activeMatcher: r,
                item: t,
                depth: n,
                collapsed: t.collapsed,
                setSidebarData: i,
              },
              `${t.text}-${a}`
            )
          : (0, f.jsx)(rL, {
              href: H(t.link),
              className: 'menuLink_bb039',
              children: (0, f.jsxs)('div', {
                ref: s,
                className: `${o ? rb : ry} mt-0.5 py-2 px-3 font-medium flex`,
                style: {
                  fontSize: 0 === n ? '14px' : '13px',
                  marginLeft: 0 === n ? 0 : '18px',
                  borderRadius: '0 var(--rp-radius) var(--rp-radius) 0',
                  ...(0 === n ? rA : {}),
                },
                children: [
                  (0, f.jsx)(ic, { tag: t.tag }),
                  (0, f.jsx)('span', { children: rl(t.text) }),
                ],
              }),
            });
      }
      function rE({ sectionHeaderText: e, tag: t }) {
        return (0, f.jsxs)('div', {
          className: 'rspress-sidebar-section-header',
          children: [(0, f.jsx)(ic, { tag: t }), (0, f.jsx)('span', { children: rl(e) })],
        });
      }
      let rA = { fontSize: '14px', paddingLeft: '24px', fontWeight: 'bold' },
        rk = new WeakMap();
      function rS(e) {
        let {
            isSidebarOpen: t,
            beforeSidebar: n,
            afterSidebar: a,
            uiSwitch: i,
            navTitle: o,
          } = e,
          { pathname: s } = eq(),
          l = rf(),
          [u, c] = (0, p.useState)(() => l.filter(Boolean).flat()),
          d = decodeURIComponent(s),
          h = rw();
        return (
          (0, p.useEffect)(
            () => (
              t
                ? ((r = document.body.style.overflow),
                  (document.body.style.overflow = 'hidden'))
                : (document.body.style.overflow = r || ''),
              () => {
                document.body.style.overflow = r || '';
              }
            ),
            [t]
          ),
          (0, p.useEffect)(() => {
            if (l === u) return;
            rk = new WeakMap();
            let e = (t) =>
                rk.has(t)
                  ? rk.get(t)
                  : ('link' in t && t.link && h(t.link)) ||
                      ('items' in t && t.items.some((t) => e(t)))
                    ? (rk.set(t, !0), !0)
                    : (rk.set(t, !1), !1),
              t = (n) => {
                'items' in n && (n.items.forEach(t), e(n) && (n.collapsed = !1));
              },
              n = l.filter(Boolean).flat();
            n.forEach(t), c(n);
          }, [l, d]),
          (0, f.jsxs)('aside', {
            className: `sidebar_dd719 rspress-sidebar ${t ? 'open_becbd' : ''}`,
            children: [
              i?.showNavbar
                ? (0, f.jsx)('div', {
                    className: 'navTitleMask_fb17c',
                    children: o || (0, f.jsx)(rg, {}),
                  })
                : null,
              (0, f.jsx)('div', {
                className: 'rspress-scrollbar sidebarContent_da296',
                children: (0, f.jsxs)('nav', {
                  className: 'pb-2',
                  children: [n, (0, f.jsx)(rN, { sidebarData: u, setSidebarData: c }), a],
                }),
              }),
            ],
          })
        );
      }
      function rN({ sidebarData: e, setSidebarData: t }) {
        let n = rw();
        return (0, f.jsx)(f.Fragment, {
          children: e.map((e, r) =>
            (0, f.jsx)(rT, { item: e, index: r, setSidebarData: t, activeMatcher: n }, r)
          ),
        });
      }
      function rT(e) {
        let { item: t, index: n, setSidebarData: r, activeMatcher: a } = e;
        return 'dividerType' in t
          ? (0, f.jsx)(rv, { depth: 0, dividerType: t.dividerType }, n)
          : 'sectionHeaderText' in t
            ? (0, f.jsx)(rE, { sectionHeaderText: t.sectionHeaderText, tag: t.tag }, n)
            : 'link' in t && $(t.link)
              ? (0, f.jsx)(
                  'div',
                  {
                    className: 'rspress-sidebar-item rspress-sidebar-custom-link',
                    'data-context': t.context,
                    children: (0, f.jsx)(
                      rj,
                      {
                        id: String(n),
                        item: t,
                        depth: 0,
                        collapsed: t.collapsed ?? !0,
                        setSidebarData: r,
                        activeMatcher: a,
                      },
                      n
                    ),
                  },
                  n
                )
              : (0, f.jsx)(
                  rj,
                  {
                    id: String(n),
                    item: t,
                    depth: 0,
                    activeMatcher: a,
                    collapsed: t.collapsed ?? !0,
                    setSidebarData: r,
                  },
                  n
                );
      }
      let rB = 'link_a7cea';
      function rL(e) {
        let {
            href: t = '/',
            children: n,
            className: r = '',
            onNavigate: a,
            onClick: i,
          } = e,
          o = eV(),
          { pathname: s } = eq(),
          { scrollPaddingTop: l } = re(),
          u = (0, p.useMemo)(() => R(H(t)), [t]),
          c = $(t),
          d = t.startsWith('#');
        if (c)
          return (0, f.jsx)('a', {
            ...e,
            href: t,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: `${rB} ${r}`,
            children: n,
          });
        if (d)
          return (0, f.jsx)('a', { ...e, href: t, className: `${rB} ${r}`, children: n });
        let h = async (e) => {
          if (
            0 === e.button &&
            (!e.currentTarget.target || '_self' === e.currentTarget.target) &&
            !e.metaKey &&
            !e.shiftKey &&
            !e.altKey &&
            !e.ctrlKey
          ) {
            if ((e.preventDefault(), !rh(u, s))) {
              let e = A(u);
              if (e) {
                let t = setTimeout(() => {
                  ty.start();
                }, 200);
                await e.preload(), clearTimeout(t), ty.done();
              }
            }
            a?.(),
              o(u, { replace: !1 }),
              setTimeout(() => {
                ((e, t) => {
                  let { hash: n } = window.location,
                    r = decodeURIComponent(n),
                    a = r.length > 1 && document.getElementById(r.slice(1));
                  r && a && rn(a, e, t);
                })(!1, l);
              }, 100);
          }
        };
        return (0, f.jsx)('a', {
          ...e,
          href: u,
          className: `${rB} ${r}`,
          onMouseEnter: () => rF(u),
          onClick: (e) => {
            i?.(e), h(e);
          },
          children: n,
        });
      }
      ty.configure({ showSpinner: !1 });
      let rO = ({ header: e, onItemClick: t }) =>
        (0, f.jsx)('li', {
          children: (0, f.jsx)(rL, {
            href: `#${e.id}`,
            className: 'rspress-toc-link sm:text-normal text-sm',
            style: { marginLeft: (e.depth - 2) * 12 },
            onClick: () => {
              t?.(e);
            },
            children: (0, f.jsx)('span', {
              className: 'rspress-toc-link-text block',
              children: rl(e.text),
            }),
          }),
        });
      function rP({ onItemClick: e }) {
        let { page: t } = eG();
        return (
          t.toc.length > 0 &&
          (0, f.jsx)('ul', {
            children: t.toc.map((t) =>
              (0, f.jsx)(rO, { header: t, onItemClick: e }, t.id)
            ),
          })
        );
      }
      function r_({
        isSidebarOpen: e,
        onIsSidebarOpenChange: t,
        outlineTitle: n,
        uiSwitch: r,
      }) {
        let { page: a } = eG(),
          i = (0, p.useRef)(null),
          o = (0, p.useRef)(null),
          [s, l] = (0, p.useState)(!1),
          { pathname: u } = eq();
        (0, p.useEffect)(() => {
          t(!1);
        }, [u]),
          (0, p.useEffect)(
            () => (
              document.addEventListener('mouseup', c),
              document.addEventListener('touchend', c),
              () => {
                document.addEventListener('mouseup', c),
                  document.removeEventListener('touchend', c);
              }
            ),
            []
          );
        let c = (0, p.useCallback)((e) => {
            let { current: t } = o;
            if (t?.contains(e.target)) return;
            let { current: n } = i;
            n && !n.contains(e.target) && l(!1);
          }, []),
          d = (0, p.useCallback)(() => {
            l(!1);
          }, []),
          h = a.toc.length > 0;
        return (0, f.jsx)('div', {
          className: `rspress-sidebar-menu-container ${h ? '' : 'no-toc'}`,
          children: (0, f.jsxs)('div', {
            className: 'rspress-sidebar-menu',
            children: [
              r?.showSidebar &&
                (0, f.jsxs)(f.Fragment, {
                  children: [
                    (0, f.jsxs)('button', {
                      type: 'button',
                      onClick: function () {
                        t(!0);
                      },
                      className: 'flex-center mr-auto',
                      children: [
                        (0, f.jsx)('div', {
                          className: 'text-md mr-2',
                          children: (0, f.jsx)(rx, { icon: tx }),
                        }),
                        (0, f.jsx)('span', { className: 'text-sm', children: 'Menu' }),
                      ],
                    }),
                    e &&
                      (0, f.jsx)('div', {
                        onClick: function () {
                          t(!1);
                        },
                        className: 'rspress-sidebar-back-drop',
                        style: { background: 'rgba(0, 0, 0, 0.6)' },
                      }),
                  ],
                }),
              r?.showAside &&
                h &&
                (0, f.jsxs)(f.Fragment, {
                  children: [
                    (0, f.jsxs)('button', {
                      type: 'button',
                      onClick: () => l((e) => !e),
                      className: 'flex-center ml-auto',
                      ref: o,
                      children: [
                        (0, f.jsx)('span', { className: 'text-sm', children: n }),
                        (0, f.jsx)('div', {
                          className: 'text-md mr-2',
                          style: {
                            transform: s ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease-out',
                            marginTop: '2px',
                          },
                          children: (0, f.jsx)(rx, { icon: tv }),
                        }),
                      ],
                    }),
                    (0, f.jsx)('div', {
                      className: `rspress-local-toc-container ${s ? 'rspress-local-toc-container-show' : ''}`,
                      children: (0, f.jsx)(rP, { onItemClick: d }),
                    }),
                  ],
                }),
            ],
          }),
        });
      }
      let r$ = (0, p.createContext)({ tabData: {}, setTabData: () => {} }),
        rM = 'title_fb7eb',
        rI = (e) => {
          let t,
            n,
            r,
            a,
            i,
            { href: o = '', className: s = '' } = e,
            { normalizeLinkHref: l } =
              ((t = (0, p.useContext)(m).data.page.lang || ''),
              (n = eZ()),
              (a = (r = eG()).siteData.lang),
              (i = r.siteData.multiVersion.default),
              {
                normalizeLinkHref: (e) => {
                  let r = e;
                  if ((a || i) && !$(r) && !r.startsWith('#')) {
                    let e = (r = eU(r)).split('/').filter(Boolean),
                      o = '',
                      s = '';
                    return (
                      i &&
                        (n !== i
                          ? ((o = n), e[0] === n && e.shift())
                          : e[0] === i && e.shift()),
                      a &&
                        (t !== a
                          ? ((s = t), e[0] === t && e.shift())
                          : e[0] === a && e.shift()),
                      H(R([o, s, e.join('/')].filter(Boolean).join('/')))
                    );
                  }
                  return r;
                },
              });
          return (0, f.jsx)(rL, {
            ...e,
            className: `${s} link_a9ef4 inline-link_f855c`,
            href: l(o),
          });
        },
        rz = (e) =>
          (0, f.jsx)('h1', {
            ...e,
            className: `rspress-doc-title text-3xl mb-10 leading-10 tracking-tight ${rM}`,
          }),
        rR = (e) =>
          (0, f.jsx)('h2', {
            ...e,
            className: `mt-12 mb-6 pt-8 text-2xl tracking-tight border-t-[1px] border-divider-light ${rM}`,
          }),
        rH = (e) =>
          (0, f.jsx)('h3', { ...e, className: `mt-10 mb-2 leading-7 text-xl ${rM}` }),
        rW = (e) => (0, f.jsx)('h4', { ...e, className: `mt-8 leading-6 text-lg ${rM}` }),
        rU = (e) => (0, f.jsx)('h5', { ...e, className: rM }),
        rq = (e) => (0, f.jsx)('h6', { ...e, className: rM });
      function rV(e) {
        let {
            beforeDocFooter: t,
            afterDocFooter: n,
            beforeDoc: r,
            afterDoc: a,
            beforeDocContent: i,
            afterDocContent: o,
            beforeOutline: s,
            afterOutline: l,
            beforeSidebar: u,
            afterSidebar: c,
            uiSwitch: d,
            navTitle: h,
            components: m,
          } = e,
          { siteData: g, page: v } = eG(),
          { headingTitle: x, title: y, toc: b = [], frontmatter: D } = v,
          [F, w] = (0, p.useState)({}),
          { themeConfig: C } = g,
          j = C.enableScrollToTop ?? !1,
          E = n9(),
          A = E?.outlineTitle || C?.outlineTitle || 'ON THIS PAGE',
          k = D?.overview ?? !1,
          S = {
            h1: rz,
            h2: rR,
            h3: rH,
            h4: rW,
            h5: rU,
            h6: rq,
            ul: r3,
            ol: r4,
            li: r8,
            table: ae,
            td: an,
            th: ar,
            tr: at,
            hr: r1,
            p: r6,
            blockquote: r5,
            strong: r7,
            a: rI,
            code: r0,
            pre: r9,
            img: r2,
            ...m,
          },
          N = (0, f.jsx)(r$.Provider, {
            value: { tabData: F, setTabData: w },
            children: (0, f.jsx)(eK.xA, { components: S, children: (0, f.jsx)(eI, {}) }),
          }),
          T = (0, p.useMemo)(() => {
            var e;
            let t =
              y &&
              ('string' != typeof (e = y)
                ? ''
                : (e = e.toLowerCase()).replace(eX, '').replace(/ /g, '-'));
            return (
              !1 !== g.themeConfig.fallbackHeadingTitle &&
              !x &&
              t &&
              (0, f.jsxs)(rz, {
                id: t,
                children: [
                  y,
                  (0, f.jsx)(rI, {
                    className: 'header-anchor',
                    href: `#${t}`,
                    'aria-hidden': !0,
                    children: '#',
                  }),
                ],
              })
            );
          }, [x, y, g.themeConfig.fallbackHeadingTitle]),
          [B, L] = (0, p.useState)(!1);
        return (0, f.jsxs)('div', {
          className: 'docLayout_af141 pt-0',
          style: { ...(d?.showNavbar ? {} : { marginTop: 0 }) },
          children: [
            r,
            d?.showSidebar &&
              (0, f.jsx)(rS, {
                isSidebarOpen: B,
                beforeSidebar: u,
                afterSidebar: c,
                uiSwitch: d,
                navTitle: h,
              }),
            (0, f.jsxs)('div', {
              className: 'flex-1 relative min-w-0',
              children: [
                (0, f.jsx)(r_, {
                  isSidebarOpen: B,
                  onIsSidebarOpenChange: L,
                  outlineTitle: A,
                  uiSwitch: d,
                }),
                (0, f.jsxs)('div', {
                  className: 'content_ff766 rspress-doc-container flex',
                  children: [
                    (0, f.jsx)('div', {
                      className: `flex-1 ${k ? '' : 'overflow-x-auto'}`,
                      children: k
                        ? (0, f.jsxs)(f.Fragment, {
                            children: [i, (0, f.jsx)(a5, { content: N }), o],
                          })
                        : (0, f.jsxs)(f.Fragment, {
                            children: [
                              (0, f.jsxs)('div', {
                                className: 'rspress-doc',
                                children: [i, T, N, o],
                              }),
                              (0, f.jsxs)('div', {
                                className: 'rspress-doc-footer',
                                children: [t, d?.showDocFooter && (0, f.jsx)(rp, {}), n],
                              }),
                            ],
                          }),
                    }),
                    j && (0, f.jsx)(ez, { children: (0, f.jsx)(ie, {}) }),
                    d?.showAside &&
                      b.length > 0 &&
                      (0, f.jsxs)('div', {
                        className: 'aside-container_bc5fa',
                        style: d?.showNavbar
                          ? void 0
                          : { marginTop: 0, paddingTop: '32px' },
                        children: [s, (0, f.jsx)(rc, { headers: b, outlineTitle: A }), l],
                      }),
                  ],
                }),
              ],
            }),
            a,
          ],
        });
      }
      let rG = (e, t) =>
          t
            ? ((e = e.trim()), (t = t.trim()).startsWith('-') || t.startsWith('|'))
              ? `${e} ${t}`
              : `${e} - ${t}`
            : e,
        rZ = {
          'code-button-group': 'code-button-group_fb445',
          codeButtonGroup: 'code-button-group_fb445',
          'code-copy-button': 'code-copy-button_c5089',
          codeCopyButton: 'code-copy-button_c5089',
          'icon-success': 'icon-success_d5ec0',
          iconSuccess: 'icon-success_d5ec0',
          'code-copied': 'code-copied_e2224',
          codeCopied: 'code-copied_e2224',
          'icon-copy': 'icon-copy_ef942',
          iconCopy: 'icon-copy_ef942',
          'icon-wrapped': 'icon-wrapped_fb89b',
          iconWrapped: 'icon-wrapped_fb89b',
          'wrapped-btn': 'wrapped-btn_a2562',
          wrappedBtn: 'wrapped-btn_a2562',
          'icon-wrap': 'icon-wrap_ccd3d',
          iconWrap: 'icon-wrap_ccd3d',
        },
        rY = new Map();
      function rK({ codeBlockRef: e }) {
        let t = (0, p.useRef)(null);
        return (0, f.jsxs)('button', {
          className: rZ.codeCopyButton,
          onClick: () =>
            (function (e, t) {
              let n = '';
              if (!e) return;
              let r = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null),
                a = r.nextNode();
              for (; a; )
                a.parentElement.classList.contains('linenumber') || (n += a.nodeValue),
                  (a = r.nextNode());
              if (tC(n) && t) {
                t.classList.add(rZ.codeCopied), clearTimeout(rY.get(t));
                let e = setTimeout(() => {
                  t.classList.remove(rZ.codeCopied), t.blur(), rY.delete(t);
                }, 2e3);
                rY.set(t, e);
              }
            })(e.current, t.current),
          ref: t,
          title: 'Copy code',
          children: [
            (0, f.jsx)(rx, { icon: tF, className: rZ.iconCopy }),
            (0, f.jsx)(rx, { icon: tw, className: rZ.iconSuccess }),
          ],
        });
      }
      let rX = {
          doctype: { color: 'var(--code-token-text)', fontStyle: 'italic' },
          token: { color: 'var(--code-token-text)' },
          comment: { color: 'var(--code-token-comment)' },
          punctuation: { color: 'var(--code-token-punctuation)' },
          property: { color: 'var(--code-token-parameter)' },
          constant: { color: 'var(--code-token-constant)' },
          string: { color: 'var(--code-token-string)' },
          symbol: { color: 'var(--code-token-symbol)' },
          variable: { color: 'var(--code-token-variable)' },
          'attr-name': { color: 'var(--code-token-symbol)' },
          'attr-value': { color: 'var(--code-token-string-expression)' },
          builtin: { color: 'var(--code-token-symbol)' },
          function: { color: 'var(--code-token-function)' },
          keyword: { color: 'var(--code-token-keyword)' },
          tag: { color: 'var(--code-token-function)' },
          inserted: { color: 'var(--code-token-inserted)' },
          deleted: { color: 'var(--code-token-deleted)' },
          regex: { color: 'var(--code-token-keyword)' },
          key: { color: 'var(--code-token-variable)' },
          title: { color: 'var(--code-token-keyword)' },
          important: { color: '#EBCB8B', fontWeight: 'bold' },
          bold: { fontWeight: 'bold' },
          italic: { fontStyle: 'italic' },
          table: { display: 'content' },
        },
        rJ = !1;
      function rQ(e) {
        let { siteData: t } = eG(),
          { meta: n, language: r, codeWrap: a } = e,
          { showLineNumbers: i } = t.markdown,
          o = '',
          s = [];
        return (
          n &&
            (o = /{[\d,-]*}/i.exec(n)?.[0] || '') &&
            (s = o
              .replace(/[{}]/g, '')
              .split(',')
              .map((e) => {
                let [t, n] = e.split('-');
                return n
                  ? Array.from(
                      { length: Number(n) - Number(t) + 1 },
                      (e, n) => n + Number(t)
                    )
                  : Number(t);
              })
              .flat()),
          rJ ||
            (Object.keys(tG).forEach((e) => {
              tq.registerLanguage(e, tG[e]);
            }),
            tq.alias(tV),
            (rJ = !0)),
          (0, f.jsx)(tq, {
            language: r,
            style: rX,
            wrapLines: !0,
            className: 'code',
            wrapLongLines: a,
            customStyle: { backgroundColor: 'inherit' },
            showLineNumbers: i || s.length > 0,
            lineProps: (e) => ({
              style: {
                ...(s.includes(e)
                  ? { backgroundColor: 'var(--rp-code-line-highlight-color)' }
                  : {}),
                display: 'block',
                padding: '0 1.25rem',
              },
            }),
            children: String(e.children).trim(),
          })
        );
      }
      function r0(e) {
        let { siteData: t } = eG(),
          n = e.codeHighlighter ?? t.markdown.codeHighlighter,
          { defaultWrapCode: r } = t.markdown,
          [a, i] = (0, p.useState)(r),
          o = (0, p.useRef)(null),
          s = (0, p.useRef)(null),
          { className: l } = e,
          u = l?.replace(/language-/, '');
        return u
          ? (0, f.jsxs)(f.Fragment, {
              children: [
                (0, f.jsx)('div', {
                  ref: s,
                  children:
                    'prism' === n
                      ? (0, f.jsx)(rQ, { ...e, language: u, codeWrap: a })
                      : (0, f.jsx)('pre', {
                          ...e,
                          style: { overflowX: 'auto' },
                          children: (0, f.jsx)('code', {
                            style: { whiteSpace: a ? 'pre-wrap' : 'pre' },
                            children: e.children,
                          }),
                        }),
                }),
                (0, f.jsxs)('div', {
                  className: rZ.codeButtonGroup,
                  children: [
                    (0, f.jsxs)('button', {
                      ref: o,
                      className: rZ.codeWrapButton,
                      onClick: () => {
                        var e;
                        return (
                          (e = o.current),
                          void (a
                            ? e?.classList.remove(rZ.wrappedBtn)
                            : e?.classList.add(rZ.wrappedBtn),
                          i(!a))
                        );
                      },
                      title: 'Toggle code wrap',
                      children: [
                        (0, f.jsx)(rx, { icon: tD, className: rZ.iconWrapped }),
                        (0, f.jsx)(rx, { icon: tb, className: rZ.iconWrap }),
                      ],
                    }),
                    (0, f.jsx)(rK, { codeBlockRef: s }),
                  ],
                }),
              ],
            })
          : (0, f.jsx)('code', { ...e });
      }
      let r1 = (e) =>
          (0, f.jsx)('hr', {
            ...e,
            className: 'my-12 border-t border-solid border-divider-light',
          }),
        r2 = (e) => (0, f.jsx)('img', { ...e, src: eW(e.src || '') }),
        r4 = (e) =>
          (0, f.jsx)('ol', { ...e, className: 'list-decimal pl-5 my-4 leading-7' }),
        r3 = (e) =>
          (0, f.jsx)('ul', { ...e, className: 'list-disc pl-5 my-4 leading-7' }),
        r8 = (e) => (0, f.jsx)('li', { ...e, className: '[&:not(:first-child)]:mt-2' }),
        r6 = (e) => (0, f.jsx)('p', { ...e, className: 'my-4 leading-7' }),
        r5 = (e) =>
          (0, f.jsx)('blockquote', {
            ...e,
            className:
              'border-l-2 border-solid border-divider pl-4 my-6 transition-colors duration-500 blockquote_f1063',
          }),
        r7 = (e) => (0, f.jsx)('strong', { ...e, className: 'font-semibold' });
      function r9({ children: e }) {
        let t = (e) => {
          let { className: t, meta: n } = e.props,
            r = (function (e) {
              if (!e) return '';
              let t = e,
                n = /{[\d,-]*}/i;
              return (
                n.exec(e)?.[0] && (t = e.replace(n, '').trim()),
                (t = t.split('=')[1] ?? ''),
                t?.replace(/["'`]/g, '')
              );
            })(n);
          return (0, f.jsxs)('div', {
            className: t || 'language-bash',
            children: [
              r && (0, f.jsx)('div', { className: 'rspress-code-title', children: r }),
              (0, f.jsx)('div', {
                className: 'rspress-code-content rspress-scrollbar',
                children: e,
              }),
            ],
          });
        };
        return Array.isArray(e)
          ? (0, f.jsx)('div', { children: e.map((e) => t(e)) })
          : t(e);
      }
      let ae = (e) =>
          (0, f.jsx)('table', {
            ...e,
            className:
              'block border-collapse text-base my-5 overflow-x-auto leading-7 border-gray-light-3 dark:border-divider',
          }),
        at = (e) =>
          (0, f.jsx)('tr', {
            ...e,
            className:
              'border border-solid transition-colors duration-500 even:bg-soft border-gray-light-3 dark:border-divider',
          }),
        an = (e) =>
          (0, f.jsx)('td', {
            ...e,
            className:
              'border border-solid px-4 py-2 border-gray-light-3 dark:border-divider',
          }),
        ar = (e) =>
          (0, f.jsx)('th', {
            ...e,
            className:
              'border border-solid px-4 py-2 text-text-1 text-base font-semibold border-gray-light-3 dark:border-divider',
          }),
        aa = 'default',
        ai = /[\u3131-\u314e|\u314f-\u3163|\uac00-\ud7a3]/u,
        ao = /[\u0400-\u04FF]/u;
      function as(e) {
        let t = e.toString().toLowerCase().normalize('NFD');
        if (ao.test(String(e))) return t.normalize('NFC');
        let n = t.replace(/[\u0300-\u036f]/g, '');
        return ai.test(String(e)) ? n.normalize('NFC') : n;
      }
      function al(e) {
        return e.replace(/https?:\/\/[^/]+/, '');
      }
      function au(e) {
        return e.charCodeAt(0) > 255 ? 3 : 1;
      }
      function ac(e, t) {
        let n = 0,
          r = 0;
        for (let a = 0; a < e.length && !(r >= t); a++) (r += au(e.charAt(a))), n++;
        return n;
      }
      function ad(e) {
        let t = 0;
        for (let n = 0; n < e.length; n++) t += au(e.charAt(n));
        return t;
      }
      let ah =
          /[\u3131-\u314e|\u314f-\u3163|\uac00-\ud7a3]|[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]|[\u3041-\u3096]|[\u30A1-\u30FA]/giu,
        af = /[\u0400-\u04FF]/g;
      function ap(e, t) {
        let n = [],
          r = null;
        do (r = t.exec(e)) && n.push(r[0]);
        while (r);
        return n;
      }
      class am {
        #e;
        #t;
        #n;
        #r;
        async #a(e, t) {
          let r = `${t ?? ''}###${e ?? ''}`;
          if (!nB[r]) return [];
          let a = t ? `.${t.replace('.', '_')}` : '',
            i = e ? `.${e}` : '',
            o = `${P(n.p)}/static/search_index${a}${i}.${nB[r]}.json`,
            s = (e) => {
              console.error(
                'Failed to fetch search index, please reload the page and try again.'
              ),
                console.error(e);
            };
          try {
            let e = await fetch(o);
            if (e.ok) return e.json();
            s(e);
          } catch (e) {
            s(e);
          }
          return [];
        }
        async fetchSearchIndex(e) {
          if (this.#r) return this.#r;
          let { currentLang: t, currentVersion: n } = e,
            r = 'remote' !== e.mode && e.versioned;
          return (this.#r = this.#a(t, r ? n : '')), this.#r;
        }
        async init(e) {
          let t = (await this.fetchSearchIndex(e)).map((e) => ({
              ...e,
              normalizedContent: as(e.content),
              headers: e.toc.map((e) => as(e.text)).join(' '),
              normalizedTitle: as(e.title),
            })),
            n = {
              tokenize: 'full',
              document: {
                id: 'id',
                store: !0,
                index: ['normalizedTitle', 'headers', 'normalizedContent'],
              },
              cache: 100,
            };
          for (let e of ((this.#e = new ny(n)),
          (this.#t = new ny({ ...n, tokenize: (e) => ap(e, ah) })),
          (this.#n = new ny({ ...n, tokenize: (e) => ap(e, af) })),
          t))
            this.#e.addAsync(e.id, e),
              this.#t.addAsync(e.id, e),
              this.#n.addAsync(e.id, e);
        }
        async search(e) {
          let { keyword: t, limit: n } = e,
            r = {
              enrich: !0,
              limit: n,
              index: ['normalizedTitle', 'headers', 'normalizedContent'],
            },
            a = await Promise.all([
              this.#e?.searchAsync(t, r),
              this.#t?.searchAsync(t, r),
              this.#n?.searchAsync(t, r),
            ]),
            i = [],
            o = new Set();
          return (
            a.forEach((e) => {
              e &&
                (function (e) {
                  for (let t of e)
                    t.result.forEach((e) => {
                      let t = e.id;
                      o.has(t) || (o.add(t), i.push(e.doc));
                    });
                })(e);
            }),
            [{ index: aa, hits: i }]
          );
        }
      }
      class ag {
        #i;
        async init(e) {
          this.#i = e;
        }
        async fetchSearchIndex(e) {
          return [];
        }
        async search(e) {
          let { apiUrl: t, searchIndexes: n } = this.#i,
            { keyword: r, limit: a } = e,
            i = Object.entries({
              keyword: r,
              limit: a.toString(),
              searchIndexes:
                n?.map((e) => ('string' == typeof e ? e : e.value)).join(',') || '',
              lang: this.#i?.currentLang ?? '',
            })
              .map((e) => e.map(encodeURIComponent).join('='))
              .join('&');
          try {
            return (await fetch(`${t}?${i}`)).json();
          } catch (e) {
            return console.error(e), [];
          }
        }
      }
      var av = (((o = {}).Default = 'default'), (o.Custom = 'custom'), o);
      class ax {
        #i;
        #o = aa;
        #s;
        constructor(e) {
          (this.#i = e),
            (this.#o = e.indexName ?? aa),
            'remote' === e.mode ? (this.#s = new ag()) : (this.#s = new am());
        }
        async init() {
          await this.#s?.init(this.#i);
        }
        async fetchSearchIndex() {
          return this.#s?.fetchSearchIndex(this.#i);
        }
        async match(e, t = 7) {
          let n = await this.#s?.search({ keyword: e, limit: t }),
            r = as(e),
            a = n?.find((e) => this.#l(e.index)) || {
              index: aa,
              renderType: av.Default,
              hits: [],
            };
          return [
            { group: this.#o, renderType: av.Default, result: this.#u(r, a) },
            ...(n?.filter((e) => !this.#l(e.index)) || []).map((e) => ({
              group: e.index,
              renderType: av.Default,
              result: this.#u(r, e),
            })),
          ];
        }
        #u(e, t) {
          let n = [];
          return (
            t?.hits.forEach((t) => {
              this.#c(t, e, n);
              let r = this.#d(t, e, n);
              this.#h(t, e, n, r);
            }),
            n
          );
        }
        #c(e, t, n) {
          let { title: r = '' } = e,
            a = as(r);
          return (
            !!a.includes(t) &&
            (n.push({
              type: 'title',
              title: r,
              header: r,
              link: `${e.domain}${H(e.routePath)}`,
              query: t,
              highlightInfoList: [{ start: a.indexOf(t), length: ad(t) }],
            }),
            !0)
          );
        }
        #d(e, t, n) {
          let r = new WeakSet(),
            { toc: a = [], domain: i = '', title: o = '' } = e;
          for (let [s, l] of a.entries())
            if (as(l.text).includes(t)) {
              let u = (function (e, t) {
                  let n = e[t],
                    r = t,
                    a = [n];
                  for (; n && n.depth > 2; ) {
                    let t = !1;
                    for (let i = r - 1; i >= 0; i--) {
                      let o = e[i];
                      if (o.depth > 1 && o.depth === n.depth - 1) {
                        (n = o), (r = i), a.unshift(n), (t = !0);
                        break;
                      }
                    }
                    if (!t) break;
                  }
                  return a;
                })(a, s)
                  .map((e) => e.text)
                  .join(' > '),
                c = as(u).indexOf(t),
                d = `${o} > `;
              n.push({
                type: 'header',
                title: e.title,
                header: `${d}${u}`,
                highlightInfoList: [{ start: c + d.length, length: ad(t) }],
                link: `${i}${H(e.routePath)}#${l.id}`,
                query: t,
              }),
                r.add(l);
            }
          return r;
        }
        #h(e, t, n, r) {
          let { content: a, toc: i, domain: o } = e;
          if (!a.length) return;
          let s = as(a),
            l = s.indexOf(t),
            u = i.map((e) => e.charIndex),
            c = (e) =>
              i[
                u.findIndex((t, n) => {
                  if (!(n < i.length - 1)) return t < e;
                  {
                    let r = u[n + 1];
                    if (t <= e && r >= e) return !0;
                  }
                  return !1;
                })
              ],
            d = (e) => e && r?.has(e);
          if (-1 === l) {
            let r = e._matchesPosition?.content;
            if (!r?.length) return;
            let i = e._matchesPosition.content[0].start,
              s = c(i);
            if (d(s)) return;
            let l = ac(a, i),
              u = ac(a, i + 100),
              h = a.slice(l, u),
              f = e._matchesPosition.content
                .filter((e) => e.start >= i && e.start + e.length <= i + 100)
                .map((e) => ({ start: ac(a, e.start) - l + 3, length: e.length }));
            n.push({
              type: 'content',
              title: e.title,
              header: s?.text ?? e.title,
              link: `${o}${H(e.routePath)}${s ? `#${s.id}` : ''}`,
              query: t,
              highlightInfoList: f,
              statement: `...${h}...`,
            });
            return;
          }
          for (; -1 !== l; ) {
            let i = c(l),
              u = a.slice(0, l).lastIndexOf('\n');
            u = -1 === u ? 0 : u;
            let h = a.indexOf('\n\n', l + t.length),
              f = a.slice(u, h);
            f.length > 100 && (f = this.#f(f, t));
            let p = as(f).indexOf(t),
              m = [{ start: p, length: ad(t) }];
            !d(i) &&
              (n.push({
                type: 'content',
                title: e.title,
                header: i?.text ?? e.title,
                statement: f,
                highlightInfoList: m,
                link: `${o}${H(e.routePath)}${i ? `#${i.id}` : ''}`,
                query: t,
              }),
              i && r?.add(i)),
              (l = s.indexOf(t, l + f.length - p));
          }
        }
        #f(e, t) {
          let n = as(e).indexOf(as(t)),
            r = Math.floor((100 - t.length) / 2),
            a = e.slice(0, n);
          a.length > r && (a = `...${e.slice(n - r + 3, n)}`);
          let i = e.slice(n + t.length);
          return (
            i.length > r && (i = `${e.slice(n + t.length, n + r - 3)}...`), a + t + i
          );
        }
        #l(e) {
          return e === this.#o || e === aa;
        }
      }
      let ay = (e, t) => {
          let [n, r] = (0, p.useState)(() =>
              'undefined' == typeof window ? t : (localStorage.getItem(e) ?? t)
            ),
            a = (0, p.useCallback)(
              (t) => {
                r((n) => {
                  let r = 'function' == typeof t ? t(n) : t;
                  return (
                    null == r ? localStorage.removeItem(e) : localStorage.setItem(e, r), r
                  );
                });
              },
              [e]
            );
          return (
            (0, p.useEffect)(() => {
              let n = (n) => {
                n.key === e && r(localStorage.getItem(e) ?? t);
              };
              return (
                window.addEventListener('storage', n),
                () => {
                  window.removeEventListener('storage', n);
                }
              );
            }, [e, t]),
            [n, a]
          );
        },
        ab = (e) => (['light', 'dark', 'auto'].includes(e) ? e : 'auto'),
        aD = !1 === x.themeConfig.darkMode,
        aF = {
          button: 'button_e8e0d',
          medium: 'medium_fe00b',
          big: 'big_f7033',
          brand: 'brand_dc619',
          alt: 'alt_b0249',
        };
      function aw(e) {
        let {
            theme: t = 'brand',
            size: n = 'big',
            href: r = '/',
            external: a = !1,
            className: i = '',
          } = e,
          o = null;
        return (
          'button' === e.type ? (o = 'button') : 'a' === e.type && (o = a ? 'a' : rL),
          p.createElement(
            o ?? 'a',
            { className: `${aF.button} ${aF[t]} ${aF[n]} ${i}`, href: r },
            e.text
          )
        );
      }
      function aC() {
        let e = (function () {
          let { siteData: e, page: t } = eG(),
            n = n9().editLink ?? e.themeConfig?.editLink ?? {};
          if (!n.docRepoBaseUrl || !n.text) return null;
          let { docRepoBaseUrl: r } = n;
          r.endsWith('/') || (r += '/');
          let a = t._relativePath.replace(/\\/g, '/'),
            i = `${r}${a}`;
          return { text: n.text, link: i };
        })();
        if (!e) return null;
        let { text: t, link: n } = e;
        return (0, f.jsx)('a', {
          href: n,
          target: '_blank',
          className: 'editLink_e1cfa',
          children: t,
        });
      }
      let aj = {
        'grid-2': 'grid-2_bce10',
        grid2: 'grid-2_bce10',
        'grid-4': 'grid-4_bd059',
        grid4: 'grid-4_bd059',
        'grid-6': 'grid-6_ce438',
        grid6: 'grid-6_ce438',
        'grid-3': 'grid-3_bf296',
        grid3: 'grid-3_bf296',
        featureCard: 'featureCard_a17b6',
      };
      function aE({ frontmatter: e, routePath: t }) {
        let n = e?.features;
        return (0, f.jsx)('div', {
          className: 'overflow-hidden m-auto flex flex-wrap max-w-6xl',
          children: n?.map((e) => {
            let { icon: n, title: r, details: a, link: i } = e,
              o = i;
            return (
              i && (o = $(i) ? i : H(I(i, t))),
              (0, f.jsx)(
                'div',
                {
                  className: `${
                    aj[
                      ((e) => {
                        let { span: t } = e;
                        return `grid-${t || 4}`;
                      })(e)
                    ]
                  } rounded hover:var(--rp-c-brand)`,
                  children: (0, f.jsx)('div', {
                    className: 'h-full p-2',
                    children: (0, f.jsxs)(
                      'article',
                      {
                        className: `rspress-home-feature-card ${aj.featureCard} h-full p-8 rounded-4xl border-transparent`,
                        style: { cursor: o ? 'pointer' : 'auto' },
                        onClick: () => {
                          o && (window.location.href = o);
                        },
                        children: [
                          n
                            ? (0, f.jsx)('div', {
                                className: 'flex-center',
                                children: (0, f.jsx)('div', {
                                  className:
                                    'rspress-home-feature-icon w-12 h-12 text-3xl text-center',
                                  children: rr(n),
                                }),
                              })
                            : null,
                          (0, f.jsx)('h2', {
                            className: 'rspress-home-feature-title font-bold text-center',
                            children: r,
                          }),
                          (0, f.jsx)('p', {
                            className:
                              'rspress-home-feature-detail leading-6 pt-2 text-sm text-text-2 font-medium',
                            children: rr(a),
                          }),
                        ],
                      },
                      r
                    ),
                  }),
                },
                r
              )
            );
          }),
        });
      }
      function aA() {
        let { siteData: e } = eG(),
          { message: t } = e.themeConfig.footer || {};
        return t
          ? (0, f.jsx)('footer', {
              className:
                'absolute bottom-0 mt-12 py-8 px-6 sm:p-8 w-full border-t border-solid border-divider-light',
              children: (0, f.jsx)('div', {
                className: 'm-auto w-full text-center',
                children: (0, f.jsx)('div', {
                  className: 'font-medium text-sm text-text-2',
                  dangerouslySetInnerHTML: { __html: t },
                }),
              }),
            })
          : null;
      }
      let ak = {
        name: 'modern',
        text: 'modern ssg',
        tagline: 'modern ssg',
        actions: [],
        image: void 0,
      };
      function aS({ frontmatter: e, routePath: t }) {
        let n = e?.hero || ak,
          r = void 0 !== n.image,
          a = r ? 'sm:max-w-xl' : 'sm:max-w-4xl',
          i = n.text
            ? n.text
                .toString()
                .split(/\n/g)
                .filter((e) => '' !== e)
            : [],
          o =
            'string' == typeof n.image?.src
              ? { light: n.image.src, dark: n.image.src }
              : n.image?.src || { light: '', dark: '' };
        return (0, f.jsxs)('div', {
          className:
            'm-auto pt-0 px-6 pb-12 sm:pt-10 sm:px-16 md:pt-16 md:px-16 md:pb-16 relative',
          children: [
            (0, f.jsx)('div', {
              className: 'mask_bbaa6',
              style: { left: r ? '75%' : '50%' },
            }),
            (0, f.jsxs)('div', {
              className:
                'm-auto flex flex-col md:flex-row max-w-6xl min-h-[50vh] mt-12 sm:mt-0',
              children: [
                (0, f.jsxs)('div', {
                  className:
                    'flex flex-col justify-center items-center text-center max-w-xl sm:max-w-4xl m-auto order-2 md:order-1',
                  children: [
                    (0, f.jsx)('h1', {
                      className:
                        'font-bold text-3xl pb-2 sm:text-6xl md:text-7xl m-auto sm:m-4 md:m-0 md:pb-3 lg:pb-2 leading-tight z-10',
                      children: (0, f.jsx)('span', {
                        className: 'clip_aacad',
                        style: { lineHeight: '1.3' },
                        children: rr(n.name),
                      }),
                    }),
                    0 !== i.length &&
                      i.map((e) =>
                        (0, f.jsx)(
                          'p',
                          {
                            className: `rspress-home-hero-text mx-auto md:m-0 text-3xl sm:text-5xl md:text-6xl sm:pb-2 font-bold z-10 ${a}`,
                            style: { lineHeight: '1.2' },
                            children: rr(e),
                          },
                          e
                        )
                      ),
                    (0, f.jsx)('p', {
                      className: `rspress-home-hero-tagline whitespace-pre-wrap pt-4 m-auto md:m-0 text-sm sm:tex-xl md:text-[1.5rem] text-text-2 font-medium z-10 ${a}`,
                      children: rr(n.tagline),
                    }),
                    n.actions?.length &&
                      (0, f.jsx)('div', {
                        className:
                          'grid md:flex md:flex-wrap md:justify-center gap-3 m--1.5 pt-6 sm:pt-8 z-10',
                        children: n.actions.map((e) => {
                          let n = $(e.link) ? e.link : H(I(e.link, t));
                          return (0, f.jsx)(
                            'div',
                            {
                              className: 'flex flex-shrink-0 p-1',
                              children: (0, f.jsx)(aw, {
                                type: 'a',
                                href: n,
                                text: rr(e.text),
                                theme: e.theme,
                                className: 'w-full',
                              }),
                            },
                            n
                          );
                        }),
                      }),
                  ],
                }),
                r
                  ? (0, f.jsxs)('div', {
                      className:
                        'rspress-home-hero-image md:flex-center m-auto order-1 md:order-2 sm:flex md:none lg:flex',
                      children: [
                        (0, f.jsx)('img', {
                          src: eW(o.light),
                          alt: n.image?.alt,
                          srcSet: aN(n.image?.srcset),
                          sizes: aN(n.image?.sizes),
                          width: 375,
                          height: 375,
                          className: 'dark:hidden',
                        }),
                        (0, f.jsx)('img', {
                          src: eW(o.dark),
                          alt: n.image?.alt,
                          srcSet: aN(n.image?.srcset),
                          sizes: aN(n.image?.sizes),
                          width: 375,
                          height: 375,
                          className: 'hidden dark:block',
                        }),
                      ],
                    })
                  : null,
              ],
            }),
          ],
        });
      }
      function aN(e) {
        return (Array.isArray(e) ? e : [e]).filter(Boolean).join(', ') || void 0;
      }
      function aT() {
        let { lastUpdatedText: e = 'Last Updated' } = n9(),
          {
            page: { lastUpdatedTime: t },
            siteData: n,
          } = eG(),
          { themeConfig: r } = n,
          a = r?.lastUpdatedText || e;
        return (0, f.jsx)('div', {
          className: 'flex text-sm text-text-2 leading-6 sm:leading-8 font-medium',
          children: (0, f.jsxs)('p', {
            children: [a, ': ', (0, f.jsx)('span', { children: t })],
          }),
        });
      }
      function aB() {
        let { nav: e } = n9(),
          t = eZ();
        return Array.isArray(e) ? e : [...e[t.length > 0 ? t : 'default']];
      }
      function aL(e) {
        let { pathname: t, base: n } = e,
          r = new RegExp(e.activeMatch || e.link).test(M(t, n));
        return (0, f.jsx)(rL, {
          href: H(e.link),
          onClick: e.onClick,
          children: (0, f.jsxs)(
            'div',
            {
              className: `rspress-nav-menu-item singleItem_c1154 ${r ? 'activeItem_a28b5' : ''} text-sm font-medium ${e.compact ? 'mx-0.5' : 'mx-1.5'} px-3 py-2 flex items-center`,
              children: [(0, f.jsx)(ic, { tag: e.tag }), e.text, e.rightIcon],
            },
            e.text
          ),
        });
      }
      function aO() {
        let { siteData: e, page: t } = eG(),
          n = eZ(),
          { pathname: r, search: a } = eq(),
          i = e.lang || '',
          o = e.multiVersion.default || '',
          s = Object.values(e.locales || e.themeConfig.locales || {}),
          l = e.route?.cleanUrls || !1,
          u = s.length > 1,
          { lang: c, pageType: d } = t,
          { base: h } = e;
        return u
          ? {
              text: (0, f.jsx)(rx, {
                icon: nX,
                style: { width: '18px', height: '18px' },
              }),
              items: s.map((e) => ({
                text: e?.label,
                link: (function (e, t, n, r = '', a = !1, i = !1) {
                  let o = z(e, r);
                  (!o || i) && (o = a ? '/index' : '/index.html'),
                    o.endsWith('/') && (o += a ? '/index' : '/index.html');
                  let s = '',
                    l = '',
                    u = '',
                    c = o.split('/').filter(Boolean);
                  return (
                    n.current && n.current !== n.default && (s = c.shift() || ''),
                    t.target !== t.default
                      ? ((l = t.target), t.current !== t.default && c.shift())
                      : c.shift(),
                    (u = c.join('/') || ''),
                    (s || l) && !u && (u = a ? 'index' : 'index.html'),
                    I(L([s, l, u].filter(Boolean).join('/')), r)
                  );
                })(
                  r + a,
                  { current: c, target: e.lang, default: i },
                  { current: n, default: o },
                  h,
                  l,
                  '404' === d
                ),
              })),
              activeValue: s.find((e) => c === e.lang)?.label,
            }
          : { items: [] };
      }
      function aP() {
        let { siteData: e, page: t } = eG(),
          n = eZ(),
          { pathname: r } = eq(),
          a = e.route?.cleanUrls || !1,
          i = e.multiVersion.default || '',
          o = e.multiVersion.versions || [],
          { base: s } = e;
        return {
          items: o.map((e) => ({
            text: e,
            link: (function (e, t, n = '', r = !1, a = !1) {
              let i = z(e, n);
              (!i || a) && (i = r ? '/index' : '/index.html');
              let o = '',
                s = i.split('/').filter(Boolean);
              t.target !== t.default
                ? ((o = t.target), t.current !== t.default && s.shift())
                : s.shift();
              let l = s.join('/') || '';
              return (
                o && !l && (l = r ? 'index' : 'index.html'),
                I(L([o, l].filter(Boolean).join('/')), n)
              );
            })(r, { current: n, target: e, default: i }, s, a, '404' === t.pageType),
          })),
          text: n,
          activeValue: n,
        };
      }
      let a_ = 'social-links-icon_a4ad0',
        a$ = (e) => {
          let { link: t, popperStyle: n = {} } = e,
            { icon: r, mode: a = 'link', content: i } = t,
            o = (0, f.jsx)(f.Fragment, {});
          if (r) {
            let e = 'string' == typeof r ? {}[r] : r.svg;
            o = (0, f.jsx)('div', { dangerouslySetInnerHTML: { __html: e } });
          }
          let [s, l] = (0, p.useState)(!1),
            u = () => {
              l(!0);
            },
            c = () => {
              l(!1);
            };
          return 'link' === a
            ? (0, f.jsx)(
                'a',
                {
                  href: i,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  className: 'social-links',
                  children: (0, f.jsx)('div', { className: `${a_}`, children: o }),
                },
                i
              )
            : 'text' === a
              ? (0, f.jsxs)('div', {
                  className: `${a_} cursor-pointer relative mx-3`,
                  onMouseEnter: u,
                  onMouseLeave: c,
                  children: [
                    o,
                    s
                      ? (0, f.jsx)('div', {
                          style: {
                            boxShadow: 'var(--rp-shadow-3)',
                            border: '1px solid var(--rp-c-divider-light)',
                            ...n,
                          },
                          className:
                            'z-[1] p-3 w-50 absolute right-0 bg-white dark:bg-dark',
                          children: (0, f.jsx)('div', {
                            className: 'text-md',
                            children: i,
                          }),
                        })
                      : null,
                  ],
                })
              : 'img' === a
                ? (0, f.jsxs)('div', {
                    className: `${a_} cursor-pointer relative`,
                    onMouseEnter: u,
                    onMouseLeave: c,
                    children: [
                      o,
                      s
                        ? (0, f.jsx)('div', {
                            className:
                              'break-all z-[1] p-3 w-[50px] h-[50px] absolute right-0 bg-white dark:bg-dark rounded-xl',
                            style: { boxShadow: 'var(--rp-shadow-3)', ...n },
                            children: (0, f.jsx)('img', { src: i, alt: 'img' }),
                          })
                        : null,
                    ],
                  })
                : 'dom' === a
                  ? (0, f.jsxs)('div', {
                      className: `${a_} cursor-pointer relative`,
                      onMouseEnter: u,
                      onMouseLeave: c,
                      children: [
                        o,
                        s
                          ? (0, f.jsx)('div', {
                              className:
                                'break-all z-[1] p-3 absolute right-0 bg-white dark:bg-dark rounded-xl',
                              style: { boxShadow: 'var(--rp-shadow-3)', ...n },
                              children: (0, f.jsx)('div', {
                                dangerouslySetInnerHTML: { __html: i },
                              }),
                            })
                          : null,
                      ],
                    })
                  : (0, f.jsx)('div', {});
        },
        aM = (e) => {
          let { links: t } = e;
          return (0, f.jsx)('div', {
            style: {
              boxShadow: 'var(--rp-shadow-3)',
              marginRight: '-2px',
              border: '1px solid var(--rp-c-divider-light)',
              background: 'var(--rp-c-bg)',
            },
            className:
              'absolute top-8 right-0 z-1 p-3 w-32 rounded-2xl flex flex-wrap gap-4',
            children: t.map((e) =>
              (0, f.jsx)(a$, { link: e, popperStyle: { top: '1.25rem' } }, e.content)
            ),
          });
        },
        aI = (e) => {
          let { links: t, moreIconVisible: n = !1, mouseEnter: r } = e;
          return (0, f.jsxs)(f.Fragment, {
            children: [
              (0, f.jsx)('div', {
                className:
                  'flex-center h-full gap-x-4 transition-colors duration-300 md:mr-2',
                children: t.map((e, t) =>
                  (0, f.jsx)(a$, { link: e, popperStyle: { top: '2.5rem' } }, t)
                ),
              }),
              n
                ? (0, f.jsx)('div', {
                    className: 'md:ml-1 p-2',
                    onMouseEnter: r,
                    children: (0, f.jsx)(rx, { icon: nJ }),
                  })
                : null,
            ],
          });
        },
        az = ({ socialLinks: e }) => {
          let t = e.length > 5,
            n = e.slice(0, 5),
            r = e.slice(5),
            [a, i] = (0, p.useState)(!1),
            o = (0, p.useCallback)(() => {
              i(!1);
            }, [i]),
            s = (0, p.useCallback)(() => {
              i(!0);
            }, [i]);
          return (0, f.jsxs)('div', {
            className: 'social-links menu-item_e90a6 flex-center relative',
            onMouseLeave: o,
            children: [
              (0, f.jsx)(aI, { links: n, moreIconVisible: t, mouseEnter: s }),
              a ? (0, f.jsx)(aM, { links: r }) : null,
            ],
          });
        };
      function aR({ onClick: e }) {
        let { theme: t, setTheme: n = () => {} } = (0, p.useContext)(g);
        return (0, f.jsx)('div', {
          onClick: (r) => {
            let a =
                'function' == typeof document?.startViewTransition &&
                !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
              i = x?.themeConfig?.enableAppearanceAnimation,
              o = 'dark' === t ? 'light' : 'dark',
              s = 'dark' === o;
            if (a && i) {
              let t,
                a = r.clientX,
                i = r.clientY,
                l = Math.hypot(
                  Math.max(a, innerWidth - a + 200),
                  Math.max(i, innerHeight - i + 200)
                ),
                c =
                  (((t = document.createElement('style')).innerHTML = `
      .rspress-doc {
        view-transition-name: none !important;
      }
  `),
                  document.head.appendChild(t),
                  () => {
                    document.head.removeChild(t);
                  }),
                d = document.startViewTransition(async () => {
                  (0, u.flushSync)(() => {
                    n(o), e?.();
                  });
                }),
                h = [`circle(0px at ${a}px ${i}px)`, `circle(${l}px at ${a}px ${i}px)`];
              d.ready.then(() => {
                document.documentElement
                  .animate(
                    { clipPath: s ? [...h].reverse() : h },
                    {
                      duration: 400,
                      easing: 'ease-in',
                      pseudoElement: s
                        ? '::view-transition-old(root)'
                        : '::view-transition-new(root)',
                      id: '',
                    }
                  )
                  .finished.then(() => {
                    c();
                  });
              });
            } else n(o), e?.();
          },
          className: 'md:mr-2 rspress-nav-appearance',
          children: (0, f.jsxs)('div', {
            className:
              'p-1 border border-solid border-gray-300 text-gray-400  cursor-pointer rounded-md hover:border-gray-600 hover:text-gray-600 dark:hover:border-gray-200 dark:hover:text-gray-200 transition-all duration-300 w-7 h-7',
            children: [
              (0, f.jsx)(rx, {
                className: 'dark:hidden',
                icon: n0,
                width: '18',
                height: '18',
                fill: 'currentColor',
              }),
              (0, f.jsx)(rx, {
                className: 'hidden dark:block',
                icon: nQ,
                width: '18',
                height: '18',
                fill: 'currentColor',
              }),
            ],
          }),
        });
      }
      let aH = {
        navScreen: 'navScreen_ec30c',
        active: 'active_d804e',
        container: 'container_c935d',
        navMenu: 'navMenu_b887b',
        navMenuItem: 'navMenuItem_e7978',
        navAppearance: 'navAppearance_bf893',
        socialAndAppearance: 'socialAndAppearance_eda28',
        navScreenMenuGroup: 'navScreenMenuGroup_e771d',
        open: 'open_aaab4',
        button: 'button_ea41e',
        buttonSpan: 'buttonSpan_f4b8f',
        items: 'items_dd149',
        down: 'down_f631a',
      };
      function aW(e) {
        let { activeValue: t } = e,
          [n, r] = (0, p.useState)(!1);
        function a({ item: e }) {
          return (0, f.jsx)('div', {
            className: 'p-1 text-center',
            children: (0, f.jsx)('span', { className: 'text-brand', children: e.text }),
          });
        }
        function i({ item: e }) {
          return (0, f.jsx)('div', {
            className: 'py-1 font-medium',
            children: (0, f.jsx)(rL, {
              href: e.link,
              children: (0, f.jsx)('div', {
                children: (0, f.jsx)('div', {
                  className: 'flex justify-center',
                  children: (0, f.jsx)('span', { children: e.text }),
                }),
              }),
            }),
          });
        }
        let o = (e) =>
          t === e.text
            ? (0, f.jsx)(a, { item: e }, e.link)
            : (0, f.jsx)(i, { item: e }, e.link);
        return (0, f.jsxs)('div', {
          className: `${n ? aH.open : ''} ${aH.navScreenMenuGroup} relative`,
          children: [
            (0, f.jsxs)('button', {
              className: aH.button,
              onClick: () => {
                r(!n);
              },
              children: [
                (0, f.jsx)('span', { className: aH.buttonSpan, children: e.text }),
                (0, f.jsx)(n1, { className: `${n ? aH.open : ''} ${aH.down} ` }),
              ],
            }),
            (0, f.jsx)('div', {
              children: (0, f.jsx)('div', {
                className: aH.items,
                children: e.items.map((e) =>
                  (0, f.jsx)(
                    'div',
                    {
                      children:
                        'items' in e
                          ? (0, f.jsxs)('div', {
                              children: [
                                'link' in e
                                  ? o(e)
                                  : (0, f.jsx)('p', {
                                      className:
                                        'font-bold text-gray-400 my-1 not:first:border',
                                      children: e.text,
                                    }),
                                e.items.map(o),
                              ],
                            })
                          : o(e),
                    },
                    e.text
                  )
                ),
              }),
            }),
          ],
        });
      }
      let aU = () => {
          let e = aO();
          return (0, f.jsx)('div', {
            className: 'flex text-sm font-bold justify-center',
            children: (0, f.jsx)('div', {
              className: 'mx-1.5 my-1',
              children: (0, f.jsx)(aW, { ...e }),
            }),
          });
        },
        aq = () => {
          let e = aP();
          return (0, f.jsx)('div', {
            className: `${aH.navTranslations} flex text-sm font-bold justify-center`,
            children: (0, f.jsx)('div', {
              className: 'mx-1.5 my-1',
              children: (0, f.jsx)(aW, { ...e }),
            }),
          });
        },
        aV = () =>
          (0, f.jsx)('div', {
            className: `mt-2 ${aH.navAppearance} flex justify-center`,
            children: (0, f.jsx)(ez, { children: (0, f.jsx)(aR, {}) }),
          }),
        aG = ({ menuItems: e, pathname: t, base: n, langs: r, toggleScreen: a }) =>
          (0, f.jsx)('div', {
            className: aH.navMenu,
            children: e.map((e) =>
              (0, f.jsx)(
                'div',
                {
                  className: `${aH.navMenuItem} w-full`,
                  children:
                    'link' in e
                      ? (0, f.jsx)(
                          aL,
                          { pathname: t, base: n, langs: r, onClick: a, ...e },
                          e.text
                        )
                      : (0, f.jsx)(
                          'div',
                          {
                            className: 'mx-3 last:mr-0',
                            children: (0, f.jsx)(aW, {
                              ...e,
                              items: 'items' in e ? e.items : e,
                            }),
                          },
                          e.text
                        ),
                },
                e.text
              )
            ),
          });
      function aZ(e) {
        let { isScreenOpen: t, toggleScreen: n, siteData: r, pathname: a } = e,
          i = (0, p.useRef)(null),
          o = r.themeConfig.locales || [],
          s = o.length > 1,
          l = r.multiVersion.versions.length > 1,
          u = aB(),
          c = !1 !== r.themeConfig.darkMode,
          d = r?.themeConfig?.socialLinks || [],
          h = d.length > 0,
          m = o.map((e) => e.lang || 'zh') || [],
          { base: g } = r;
        return (
          (0, p.useEffect)(
            () => (
              i.current && t && nY(i.current, { reserveScrollBarGap: !0 }),
              () => {
                nK();
              }
            ),
            [t]
          ),
          (0, f.jsx)('div', {
            className: `${aH.navScreen} ${t ? aH.active : ''} rspress-nav-screen`,
            ref: i,
            id: 'navScreen',
            children: (0, f.jsxs)('div', {
              className: aH.container,
              children: [
                (0, f.jsx)(aG, {
                  menuItems: u,
                  base: g,
                  langs: m,
                  pathname: a,
                  toggleScreen: n,
                }),
                (0, f.jsxs)('div', {
                  className: 'flex-center flex-col gap-2',
                  children: [
                    c && (0, f.jsx)(aV, {}),
                    s && (0, f.jsx)(aU, {}),
                    l && (0, f.jsx)(aq, {}),
                    h && (0, f.jsx)(az, { socialLinks: d }),
                  ],
                }),
              ],
            }),
          })
        );
      }
      function aY(e) {
        let { siteData: t, pathname: n } = e,
          { isScreenOpen: r, toggleScreen: a } = (function () {
            let { pathname: e } = eq(),
              [t, n] = (0, p.useState)(!1);
            function r() {
              n(!0), window.addEventListener('resize', i);
            }
            function a() {
              n(!1), window.removeEventListener('resize', i);
            }
            function i() {
              window.outerWidth >= 768 && a();
            }
            return (
              (0, p.useEffect)(() => {
                a();
              }, [e]),
              {
                isScreenOpen: t,
                openScreen: r,
                closeScreen: a,
                toggleScreen: function () {
                  t ? a() : r();
                },
              }
            );
          })();
        return (0, f.jsxs)(f.Fragment, {
          children: [
            (0, f.jsx)(aZ, {
              isScreenOpen: r,
              toggleScreen: a,
              siteData: t,
              pathname: n,
            }),
            (0, f.jsx)('button', {
              onClick: a,
              'aria-label': 'mobile hamburger',
              className: `${r ? 'active_bc9a1' : ''} rspress-mobile-hamburger navHamburger_ac64c text-gray-500`,
              children: (0, f.jsx)(rx, { icon: nL, fill: 'currentColor' }),
            }),
          ],
        });
      }
      function aK({ item: e }) {
        return (0, f.jsxs)(
          'div',
          {
            className: 'rounded-2xl my-1 flex',
            style: { padding: '0.4rem 1.5rem 0.4rem 0.75rem' },
            children: [
              e.tag && (0, f.jsx)(ic, { tag: e.tag }),
              (0, f.jsx)('span', { className: 'text-brand', children: e.text }),
            ],
          },
          e.link
        );
      }
      function aX({ item: e }) {
        return (0, f.jsx)(
          'div',
          {
            className: 'font-medium my-1',
            children: (0, f.jsx)(rL, {
              href: e.link,
              children: (0, f.jsx)('div', {
                className: 'rounded-2xl hover:bg-mute',
                style: { padding: '0.4rem 1.5rem 0.4rem 0.75rem' },
                children: (0, f.jsxs)('div', {
                  className: 'flex',
                  children: [
                    e.tag && (0, f.jsx)(ic, { tag: e.tag }),
                    (0, f.jsx)('span', { children: e.text }),
                  ],
                }),
              }),
            }),
          },
          e.link
        );
      }
      function aJ(e) {
        let {
            activeValue: t,
            items: n,
            base: r = '',
            link: a = '',
            pathname: i = '',
          } = e,
          [o, s] = (0, p.useState)(!1),
          l = (0, p.useRef)(),
          u = () => {
            l.current && (clearTimeout(l.current), (l.current = void 0));
          },
          c = (e) => {
            let n = new RegExp(e.activeMatch || e.link).test(M(i, r));
            return t === e.text || (!t && n)
              ? (0, f.jsx)(aK, { item: e }, e.link)
              : (0, f.jsx)(aX, { item: e }, e.link);
          };
        return (0, f.jsxs)('div', {
          className: 'relative flex-center h-14',
          onMouseLeave: () => {
            l.current = window.setTimeout(() => {
              s(!1);
            }, 150);
          },
          children: [
            (0, f.jsx)('button', {
              onMouseEnter: () => {
                u(), s(!0);
              },
              className:
                'rspress-nav-menu-group-button flex-center items-center font-medium text-sm text-text-1 hover:text-text-2 transition-colors duration-200',
              children: a
                ? (0, f.jsx)(aL, { ...e, rightIcon: (0, f.jsx)(rx, { icon: n1 }) })
                : (0, f.jsxs)(f.Fragment, {
                    children: [
                      (0, f.jsxs)('span', {
                        className: 'text-sm font-medium flex',
                        style: { marginRight: '2px' },
                        children: [(0, f.jsx)(ic, { tag: e.tag }), e.text],
                      }),
                      (0, f.jsx)(rx, { icon: n1 }),
                    ],
                  }),
            }),
            (0, f.jsx)('div', {
              className:
                'rspress-nav-menu-group-content absolute mx-0.8 transition-opacity duration-300',
              style: {
                opacity: +!!o,
                visibility: o ? 'visible' : 'hidden',
                right: 0,
                top: '52px',
              },
              onMouseEnter: u,
              children: (0, f.jsx)('div', {
                className: 'p-3 pr-2 w-full h-full max-h-100vh whitespace-nowrap',
                style: {
                  boxShadow: 'var(--rp-shadow-3)',
                  zIndex: 100,
                  border: '1px solid var(--rp-c-divider-light)',
                  borderRadius: 'var(--rp-radius-large)',
                  background: 'var(--rp-c-bg)',
                },
                children: n.map((e) =>
                  (0, f.jsx)(
                    'div',
                    {
                      children:
                        'items' in e
                          ? (0, f.jsxs)('div', {
                              children: [
                                'link' in e
                                  ? c(e)
                                  : (0, f.jsx)('p', {
                                      className:
                                        'font-bold text-gray-400 my-1 not:first:border',
                                      children: e.text,
                                    }),
                                e.items.map(c),
                              ],
                            })
                          : c(e),
                    },
                    e.text
                  )
                ),
              }),
            }),
          ],
        });
      }
      function aQ() {
        let e = aO();
        return (0, f.jsx)('div', {
          className: `translation ${rm} flex text-sm font-bold items-center px-3 py-2`,
          children: (0, f.jsx)('div', { children: (0, f.jsx)(aJ, { ...e }) }),
        });
      }
      function a0() {
        let e = aP();
        return (0, f.jsx)('div', {
          className: `translation ${rm} flex text-sm font-bold items-center px-3 py-2`,
          children: (0, f.jsx)('div', { children: (0, f.jsx)(aJ, { ...e }) }),
        });
      }
      function a1(e) {
        let {
            beforeNavTitle: t,
            afterNavTitle: n,
            beforeNav: r,
            afterNavMenu: a,
            navTitle: i,
          } = e,
          { siteData: o, page: s } = eG(),
          { base: l } = o,
          { pathname: u } = eq(),
          { width: c } = eY(),
          d = n7(),
          h = c < 1280,
          p = Object.values(o.locales || o.themeConfig.locales || {}),
          m = p.length > 1,
          g = o.multiVersion.versions.length > 1,
          v = o.themeConfig.socialLinks || [],
          x = v.length > 0,
          y = p.map((e) => e.lang || '') || [],
          b = ({ menuItems: e }) =>
            (0, f.jsx)('div', {
              className: 'rspress-nav-menu menu h-14',
              children: e.map((t) =>
                'items' in t || Array.isArray(t)
                  ? (0, f.jsx)(
                      'div',
                      {
                        className: 'mx-3 last:mr-0',
                        children: (0, f.jsx)(aJ, {
                          ...t,
                          base: l,
                          pathname: u,
                          langs: y,
                          items: 'items' in t ? t.items : t,
                        }),
                      },
                      t.text
                    )
                  : (0, f.jsx)(
                      aL,
                      { pathname: u, langs: y, base: l, compact: e.length > 5, ...t },
                      t.link
                    )
              ),
            }),
          D = aB(),
          F = D.filter((e) => 'left' === (e.position ?? 'right')),
          w = D.filter((e) => 'right' === (e.position ?? 'right')),
          C = o?.themeConfig?.search !== !1,
          j = !1 !== o.themeConfig.darkMode;
        return (0, f.jsxs)(f.Fragment, {
          children: [
            r,
            (0, f.jsx)('div', {
              className: `navContainer_d18b1 rspress-nav px-6 ${d && !h ? 'hidden_f8586' : ''} ${!h || !d || 'doc' !== s.pageType ? 'sticky_ddfa7' : 'relative_bb7f1'}`,
              children: (0, f.jsxs)('div', {
                className: 'container_e4235 flex justify-between items-center h-full',
                children: [
                  t,
                  i || (0, f.jsx)(rg, {}),
                  n,
                  (0, f.jsxs)('div', {
                    className: 'flex flex-1 justify-end items-center',
                    children: [
                      F.length > 0
                        ? (0, f.jsx)('div', {
                            className: 'leftNav_e6722',
                            children: (0, f.jsx)(b, { menuItems: F }),
                          })
                        : null,
                      (0, f.jsxs)('div', {
                        className: 'rightNav_a2fea',
                        children: [
                          C &&
                            (0, f.jsx)('div', {
                              className: 'flex sm:flex-1 items-center sm:pl-4 sm:pr-2',
                              children: (0, f.jsx)(iu, {}),
                            }),
                          (0, f.jsx)(b, { menuItems: w }),
                          (0, f.jsxs)('div', {
                            className: 'flex-center flex-row',
                            children: [
                              m && (0, f.jsx)(aQ, {}),
                              g && (0, f.jsx)(a0, {}),
                              j &&
                                (0, f.jsx)('div', {
                                  className: 'mx-2',
                                  children: (0, f.jsx)(aR, {}),
                                }),
                              x && (0, f.jsx)(az, { socialLinks: v }),
                            ],
                          }),
                        ],
                      }),
                      a,
                      (0, f.jsxs)('div', {
                        className: 'mobileNavMenu_e7045',
                        children: [
                          h && C && (0, f.jsx)(iu, {}),
                          (0, f.jsx)(aY, { siteData: o, pathname: u }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            }),
          ],
        });
      }
      let a2 = {
          'header-anchor': 'header-anchor_d4f17',
          headerAnchor: 'header-anchor_d4f17',
          'overview-groups': 'overview-groups_ced08',
          overviewGroups: 'overview-groups_ced08',
          'overview-group-li': 'overview-group-li_e0f17',
          overviewGroupLi: 'overview-group-li_e0f17',
          'level-2': 'level-2_e4d63',
          level2: 'level-2_e4d63',
          'level-3': 'level-3_b489a',
          level3: 'level-3_b489a',
          'level-4': 'level-4_a9543',
          level4: 'level-4_a9543',
          'overview-group': 'overview-group_f8331',
          overviewGroup: 'overview-group_f8331',
          header: 'header_ba4f6',
        },
        a4 = (e) => e.toLowerCase().replace(/-/g, ' '),
        a3 = (e, t) => a4(e).includes(a4(t)),
        a8 = ({
          query: e,
          setQuery: t,
          searchRef: n,
          filterNameText: r,
          filterPlaceholderText: a,
        }) =>
          (0, f.jsxs)('div', {
            className: 'flex items-center justify-start gap-4',
            children: [
              (0, f.jsx)('label', { htmlFor: 'api-filter', children: r }),
              (0, f.jsx)('input', {
                ref: n,
                type: 'search',
                placeholder: a,
                id: 'api-filter',
                value: e,
                onChange: (e) => t(e.target.value),
                className:
                  'border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 transition-shadow duration-250 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50',
              }),
            ],
          }),
        a6 = ({ group: e, styles: t }) =>
          (0, f.jsxs)(
            'div',
            {
              className: 'mb-16',
              children: [
                (0, f.jsx)('h2', { children: rl(e.name) }),
                (0, f.jsx)('div', {
                  className: t.overviewGroups,
                  children: e.items.map((e) =>
                    (0, f.jsxs)(
                      'div',
                      {
                        className: t.overviewGroup,
                        children: [
                          (0, f.jsx)('div', {
                            className: 'flex',
                            children: (0, f.jsx)('h3', {
                              style: { marginBottom: 8 },
                              children: (0, f.jsx)(rL, {
                                href: H(e.link),
                                children: rl(e.text),
                              }),
                            }),
                          }),
                          (0, f.jsx)('ul', {
                            className: 'list-none',
                            children: e.headers?.map((n) =>
                              (0, f.jsx)(
                                'li',
                                {
                                  className: `${t.overviewGroupLi} ${t[`level${n.depth}`]} first:mt-2`,
                                  children: (0, f.jsx)(rL, {
                                    href: `${H(e.link)}#${n.id}`,
                                    children: rl(n.text),
                                  }),
                                },
                                n.id
                              )
                            ),
                          }),
                        ],
                      },
                      e.link
                    )
                  ),
                }),
              ],
            },
            e.name
          );
      function a5(e) {
        let {
            siteData: t,
            page: { routePath: n, title: r, frontmatter: a },
          } = eG(),
          { content: i, groups: o, defaultGroupTitle: s = 'Others' } = e,
          [l, u] = (0, p.useState)(''),
          c = (0, p.useRef)(null);
        (0, p.useEffect)(() => {
          c.current?.focus();
        }, []);
        let d = (e) => R(e).startsWith(n.replace(/overview$/, '')) && !eR(R(e), n),
          h = (e) => ('link' in e && e.link ? e.link : 'items' in e ? h(e.items[0]) : ''),
          { pages: m } = t,
          g = m.filter((e) => d(e.routePath)),
          v = rf(),
          {
            overview: {
              filterNameText: x = 'Filter',
              filterPlaceholderText: y = 'Enter keyword',
              filterNoResultText: b = 'No matching API found',
            } = {},
          } = n9();
        function D(t, r, a) {
          if ('dividerType' in t || (R(t.link) === `${n}index` && a?.overview === !0))
            return !1;
          let i = e?.overviewHeaders ??
              t.overviewHeaders ??
              a?.overviewHeaders ??
              r?.overviewHeaders ?? [2],
            o = g.find((e) => eR(e.routePath, R(t.link || ''))),
            s = h(t);
          return {
            ...t,
            link: s,
            headers: o?.toc?.filter((e) => i.some((t) => e.depth === t)) || [],
          };
        }
        v[0]?.link !== n &&
          (v = (function e(t, n) {
            let r,
              a = t.findIndex((e) =>
                (function (e) {
                  if ('dividerType' in e) return !1;
                  let t = R(e.link),
                    r = t.endsWith('/index') ? t.slice(0, -5) : t,
                    a = n.replace(/\/$/, '');
                  return t === n || r === n || t === a || r === a;
                })(e)
              );
            if (-1 === a) return t.map((t) => ('items' in t ? e(t.items, n) : [])).flat();
            let i = t[a];
            if ('items' in i && Array.isArray((r = i.items)) && r.length >= 1)
              return i.items.every((e) => !('items' in e))
                ? [i]
                : i.items.filter((e) => !('dividerType' in e));
            let o = [...t];
            return 'items' in i || o.splice(a, 1), o.filter((e) => !('dividerType' in e));
          })(v, n));
        let F =
            o ??
            (0, p.useMemo)(
              () =>
                v
                  .filter((e) =>
                    Array.isArray(e?.items)
                      ? e.items.filter((e) => d(h(e))).length > 0
                      : !!(rD(e) && d(h(e)))
                  )
                  .map((e) => {
                    let t = [];
                    return (
                      e?.items
                        ? (t = e?.items?.map((t) => D(t, e, a)).filter(Boolean))
                        : rD(e) &&
                          (t = [
                            D(
                              {
                                link: e.link,
                                text: e.text || '',
                                tag: e.tag,
                                _fileKey: e._fileKey,
                                overviewHeaders: e.overviewHeaders,
                              },
                              void 0,
                              a
                            ),
                          ]),
                      { name: e.text || '', items: t }
                    );
                  }),
              [v, n, a]
            ),
          w = (0, p.useMemo)(
            () =>
              l
                ? F.map((e) => {
                    if (a3(e.name, l)) return e;
                    let t = e.items
                      .map((e) => {
                        if (a3(e.text || '', l)) return e;
                        let t = e.headers?.filter(({ text: e }) => a3(e, l));
                        return t?.length ? { ...e, headers: t } : null;
                      })
                      .filter(Boolean);
                    return t.length ? { ...e, items: t } : null;
                  }).filter(Boolean)
                : F,
            [F, l]
          );
        return (0, f.jsxs)('div', {
          className: 'overview-index mx-auto',
          children: [
            (0, f.jsxs)('div', {
              className:
                'flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10',
              children: [
                (0, f.jsx)('h1', {
                  className: 'text-3xl leading-10 tracking-tight',
                  children: r || 'Overview',
                }),
                (0, f.jsx)(a8, {
                  query: l,
                  setQuery: u,
                  searchRef: c,
                  filterNameText: x,
                  filterPlaceholderText: y,
                }),
              ],
            }),
            i,
            w.length > 0
              ? w.map((e) => (0, f.jsx)(a6, { group: e, styles: a2 }, e?.name))
              : (0, f.jsx)('div', {
                  className:
                    'text-lg text-gray-500 text-center mt-9 pt-9 border-t border-gray-200 dark:border-gray-800',
                  children: `${b}: ${l}`,
                }),
          ],
        });
      }
      let a7 = 'pager-link_e0d2d';
      function a9(e) {
        let { type: t, text: n, href: r } = e,
          { prevPageText: a = 'Previous Page', nextPageText: i = 'Next Page' } = n9(),
          o = 'prev' === t ? a7 : `${a7} next_ad355`;
        return (0, f.jsxs)(rL, {
          href: r,
          className: o,
          children: [
            (0, f.jsx)('span', {
              className: 'desc_dcc01',
              children: 'prev' === t ? a : i,
            }),
            (0, f.jsx)('span', { className: 'title_a3acb', children: n }),
          ],
        });
      }
      function ie() {
        let [e, t] = (0, p.useState)(!1),
          n = () => {
            t((window.scrollY || document.documentElement.scrollTop) > 0);
          };
        return (
          (0, p.useEffect)(() => {
            window.addEventListener('scroll', n);
          }, []),
          (0, f.jsx)('button', {
            className: `scroll-to-top_e22be ${e ? 'entered_c8faf' : ''}`,
            onClick: () => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            },
            children: (0, f.jsx)('svg', {
              xmlns: 'http://www.w3.org/2000/svg',
              viewBox: '0 0 24 24',
              fill: 'currentColor',
              className: 'w-6 h-6',
              children: (0, f.jsx)('path', {
                fillRule: 'evenodd',
                d: 'M11.47 2.47a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06l-6.22-6.22V21a.75.75 0 0 1-1.5 0V4.81l-6.22 6.22a.75.75 0 1 1-1.06-1.06l7.5-7.5Z',
                clipRule: 'evenodd',
              }),
            }),
          })
        );
      }
      let it = (0, p.forwardRef)((e, t) => {
        let {
            values: n,
            defaultValue: r,
            onChange: a,
            children: i,
            groupId: o,
            tabPosition: s = 'left',
            tabContainerClassName: l,
          } = e,
          u = p.Children.toArray(i).filter(
            (e) => 'string' != typeof e || '' !== e.trim()
          ),
          c = n || [];
        0 === c.length &&
          (c = p.Children.map(u, (e) =>
            (0, p.isValidElement)(e)
              ? { label: e.props?.label, value: e.props?.value || e.props?.label }
              : { label: void 0, value: void 0 }
          ));
        let { tabData: d, setTabData: h } = (0, p.useContext)(r$),
          [m, g] = (0, p.useState)(() =>
            void 0 === r
              ? 0
              : c.findIndex((e) =>
                  'string' == typeof e
                    ? e === r
                    : !!e && 'object' == typeof e && 'value' in e && e.value === r
                )
          ),
          [v, x] = ay(`rspress.tabs.${o}`, m.toString()),
          y = (0, p.useMemo)(
            () => (o ? (void 0 !== d[o] ? d[o] : Number.parseInt(v)) : m),
            [o && d[o]]
          );
        (0, p.useEffect)(() => {
          if (o) {
            let e = Number.parseInt(v);
            y !== e && h({ ...d, [o]: e });
          }
        }, [v]);
        let b = o ? y : m;
        return (0, f.jsxs)('div', {
          className: 'container_df5ed',
          ref: t,
          children: [
            (0, f.jsx)('div', {
              className: l,
              children: c.length
                ? (0, f.jsx)('div', {
                    className: 'tab-list_ccbcc no-scrollbar_db61f',
                    style: { justifyContent: 'center' === s ? 'center' : 'flex-start' },
                    children: c.map((e, t) =>
                      (0, f.jsx)(
                        'div',
                        {
                          className: `tab_cae68 ${b === t ? 'selected_f5c1e' : 'not-selected_dab7a'}`,
                          onClick: () => {
                            a?.(t), o ? (h({ ...d, [o]: t }), x(t.toString())) : g(t);
                          },
                          children:
                            e && 'object' == typeof e && 'label' in e
                              ? e.label || e.value
                              : e,
                        },
                        t
                      )
                    ),
                  })
                : null,
            }),
            (0, f.jsx)('div', { children: p.Children.toArray(u)[b] }),
          ],
        });
      });
      function ir({ children: e, ...t }) {
        return (0, f.jsx)('div', { ...t, className: 'rounded px-2', children: e });
      }
      function ia({ query: e }) {
        let {
          searchNoResultsText: t = 'No results for',
          searchSuggestedQueryText: n = 'Please try again with a different keyword',
        } = n9();
        return (0, f.jsxs)('div', {
          className: 'flex flex-col items-center pt-8 pb-2',
          children: [
            (0, f.jsx)(rx, { icon: n6, className: 'mb-4 opacity-80' }),
            (0, f.jsxs)('p', {
              className: 'mb-2',
              children: [t, ' ', (0, f.jsxs)('b', { children: ['"', e, '"'] })],
            }),
            (0, f.jsx)('p', { children: n }),
          ],
        });
      }
      let ii = {
          mask: 'mask_ac6b3',
          modal: 'modal_e4a04',
          inputForm: 'inputForm_d4ba2',
          input: 'input_f8add',
          close: 'close_bee84',
          searchHits: 'searchHits_dc1b2',
          groupTitle: 'groupTitle_fe27c',
          navSearchButton: 'navSearchButton_df1fb',
          searchWord: 'searchWord_af2c1',
          suggestItem: 'suggestItem_b1e66',
          suggestItemContainer: 'suggestItemContainer_f5e47',
          contentWrapper: 'contentWrapper_efb78',
          mark: 'mark_b6cd5',
          titleForContent: 'titleForContent_f2995',
          actionIcon: 'actionIcon_f4ffd',
          current: 'current_eb655',
          tabClassName: 'tabClassName_b3f85',
          mobileNavSearchButton: 'mobileNavSearchButton_d85a9',
        },
        io = {
          title: (e) =>
            (0, f.jsx)('svg', {
              xmlns: 'http://www.w3.org/2000/svg',
              width: 24,
              height: 24,
              viewBox: '0 0 24 24',
              ...e,
              children: (0, f.jsx)('path', {
                fill: 'currentColor',
                d: 'M4 4a2 2 0 0 1 2-2h8a1 1 0 0 1 .707.293l5 5A1 1 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm13.586 4L14 4.414V8zM12 4H6v16h12V10h-5a1 1 0 0 1-1-1z',
              }),
            }),
          header: (e) =>
            (0, f.jsx)('svg', {
              xmlns: 'http://www.w3.org/2000/svg',
              width: 24,
              height: 24,
              viewBox: '0 0 32 32',
              ...e,
              children: (0, f.jsx)('path', {
                fill: 'currentColor',
                d: 'M28 12v-2h-6V4h-2v6h-8V4h-2v6H4v2h6v8H4v2h6v6h2v-6h8v6h2v-6h6v-2h-6v-8Zm-8 8h-8v-8h8Z',
              }),
            }),
          content: (e) =>
            (0, f.jsxs)('svg', {
              xmlns: 'http://www.w3.org/2000/svg',
              width: 24,
              height: 24,
              viewBox: '0 0 32 32',
              ...e,
              children: [
                (0, f.jsx)('circle', { cx: 22, cy: 24, r: 2, fill: 'currentColor' }),
                (0, f.jsx)('path', {
                  fill: 'none',
                  d: 'M22 28a4 4 0 1 1 4-4 4.004 4.004 0 0 1-4 4m0-6a2 2 0 1 0 2 2 2.003 2.003 0 0 0-2-2',
                }),
                (0, f.jsx)('path', {
                  fill: 'currentColor',
                  d: 'M29.777 23.479A8.64 8.64 0 0 0 22 18a8.64 8.64 0 0 0-7.777 5.479L14 24l.223.521A8.64 8.64 0 0 0 22 30a8.64 8.64 0 0 0 7.777-5.479L30 24ZM22 28a4 4 0 1 1 4-4 4.005 4.005 0 0 1-4 4',
                }),
                (0, f.jsx)('path', {
                  fill: 'currentColor',
                  d: 'M12 28H8V4h8v6a2.006 2.006 0 0 0 2 2h6v4h2v-6a.91.91 0 0 0-.3-.7l-7-7A.9.9 0 0 0 18 2H8a2.006 2.006 0 0 0-2 2v24a2.006 2.006 0 0 0 2 2h4Zm6-23.6 5.6 5.6H18Z',
                }),
              ],
            }),
        };
      function is({
        suggestion: e,
        closeSearch: t,
        isCurrent: n,
        setCurrentSuggestionIndex: r,
        inCurrentDocIndex: a,
        scrollTo: i,
        onMouseMove: o,
      }) {
        let s = io[e.type],
          l = (0, e.link),
          u = (0, p.useRef)(null);
        n && u.current?.offsetTop && i(u.current?.offsetTop, u.current?.offsetHeight);
        let c = (e, t) => {
            let n = [],
              r = 0;
            for (let a of t) {
              let { start: t, length: i } = a,
                o = e.slice(r, t),
                s = (function (e, t, n) {
                  var r = e.slice(t);
                  let a = '',
                    i = 0,
                    o = r.length;
                  for (let e = 0; e < o && !((i += au(r.charAt(e))) > 0 + n); e++)
                    i > 0 && (a += r.charAt(e));
                  return a;
                })(e, t, i);
              n.push(o),
                n.push((0, f.jsx)('span', { className: ii.mark, children: s }, t)),
                (r = t + s.length);
            }
            return r < e.length && n.push(e.slice(r)), n;
          },
          d = null;
        switch (e.type) {
          case 'title':
          case 'header':
            d = (() => {
              if ('header' === e.type || 'title' === e.type) {
                let { header: t, highlightInfoList: n } = e;
                return (0, f.jsx)('div', { className: 'font-medium', children: c(t, n) });
              }
              return (0, f.jsx)('div', { className: 'font-medium', children: e.header });
            })();
            break;
          case 'content':
            d = (0, f.jsxs)(f.Fragment, {
              children: [
                (() => {
                  if ('content' !== e.type) return (0, f.jsx)('div', {});
                  let { statement: t, highlightInfoList: n } = e;
                  return (0, f.jsx)('div', {
                    className: 'text-sm text-gray-light w-full',
                    children: c(t, n),
                  });
                })(),
                (0, f.jsx)('p', { className: ii.titleForContent, children: e.title }),
              ],
            });
        }
        return (0, f.jsx)(
          'li',
          {
            className: `rspress-search-suggest-item ${ii.suggestItem} ${n ? ii.current : ''}`,
            onMouseEnter: r,
            onMouseMove: o,
            ref: u,
            children: (0, f.jsx)('a', {
              href: l,
              onClick: (e) => {
                t(), e.stopPropagation();
              },
              target: a ? '_self' : '_blank',
              children: (0, f.jsxs)('div', {
                className: ii.suggestItemContainer,
                children: [
                  (0, f.jsx)('div', {
                    className: ii.hitIcon,
                    children: (0, f.jsx)(rx, { icon: s }),
                  }),
                  (0, f.jsx)('div', {
                    className: ii.contentWrapper,
                    children: (0, f.jsx)('span', { children: d }),
                  }),
                  (0, f.jsx)('div', {
                    className: ii.actionIcon,
                    children: (0, f.jsx)(rx, { icon: n5 }),
                  }),
                ],
              }),
            }),
          },
          e.link
        );
      }
      function il({ focused: e, setFocused: t }) {
        var n;
        let r,
          [a, i] = (0, p.useState)(''),
          [o, s] = (0, p.useState)([]),
          c = (0, p.useRef)(null),
          [d, h] = (0, p.useState)(!1),
          [m, g] = (0, p.useState)(0),
          [v, x] = (0, p.useState)(0),
          y = (0, p.useRef)(null),
          b = (0, p.useRef)(null),
          [D, F] = (0, p.useState)('initial'),
          w = (0, p.useRef)(null),
          C = (0, p.useRef)(null),
          j = (0, p.useRef)({ pageX: null, pageY: null }),
          [E, A] = (0, p.useState)(!1),
          k = (e, t) => {
            let n = w.current?.offsetHeight,
              r = w.current?.scrollTop;
            if (E && void 0 !== n && void 0 !== r) {
              let a = e + t - n - (1 === o.length ? 50 : -10);
              a > r && w.current?.scrollTo({ top: a });
              let i = 1 === o.length ? e - 70 : e - 10;
              i < r && w.current?.scrollTo({ top: i });
            }
          },
          {
            siteData: S,
            page: { lang: N, version: T },
          } = eG(),
          { searchPlaceholderText: B = 'Search Docs' } = n9(),
          { search: L, title: O } = S,
          P = L && 'remote' !== L.mode && L.versioned,
          _ = [{ group: O, result: [], renderType: av.Default }],
          $ = o[m]?.result ?? [],
          M = o[m]?.renderType ?? av.Default;
        if (!1 === L) return null;
        let I = () => {
          if (y.current) return y.current;
          let e = { currentLang: N, currentVersion: T };
          return (
            (y.current = new ax({ indexName: O, ...L, ...e })), (b.current = e), y.current
          );
        };
        async function z() {
          if ('initial' !== D) return;
          let e = I();
          F('initing'), await e.init(), F('inited');
          let t = c.current?.value;
          t && (s((await e.match(t)) || _), h(!1));
        }
        let R = () => {
          t(!1), g(0), x(0);
        };
        (0, p.useEffect)(() => {
          let n = (n) => {
            switch (n.code) {
              case 'KeyK':
                (n.ctrlKey || n.metaKey) && (n.preventDefault(), t(!e));
                break;
              case 'ArrowDown':
                if (n.isComposing) return;
                e &&
                  (n.preventDefault(),
                  $ && M === av.Default && (A(!0), x((v + 1) % $.length)));
                break;
              case 'ArrowUp':
                if (n.isComposing) return;
                if (e && (n.preventDefault(), M === av.Default)) {
                  let e = $.length;
                  A(!0), x((v - 1 + e) % e);
                }
                break;
              case 'Enter':
                if (n.isComposing) return;
                if (v >= 0 && M === av.Default) {
                  let e = [...Object.values(W($))].flat()[v];
                  0 === m ? (window.location.href = (0, e.link)) : window.open(e.link),
                    R();
                }
                break;
              case 'Escape':
                R();
            }
          };
          return (
            document.addEventListener('keydown', n),
            () => {
              document.removeEventListener('keydown', n);
            }
          );
        }, [x, t, e, m, $, v]),
          (0, p.useEffect)(() => {
            e ? (s(_), z()) : i('');
          }, [e]),
          (0, p.useEffect)(() => {
            'requestIdleCallback' in window &&
              !y.current &&
              window.requestIdleCallback(() => {
                I().fetchSearchIndex();
              });
          }, []),
          (0, p.useEffect)(() => {
            let { currentLang: e, currentVersion: t } = b.current ?? {},
              n = P && T !== t;
            (N !== e || n) && (F('initial'), (y.current = null), I().fetchSearchIndex());
          }, [N, T, P]);
        let H =
            ((n = async (e) => {
              if ((i(e), L && 'remote' === L.mode && L.searchLoading && h(!0), e)) {
                let t = [],
                  n = await y.current?.match(e);
                n && t.push(...n);
                {
                  let n = await l.onSearch(e, t);
                  n && t.push(...n.map((e) => ({ renderType: av.Custom, ...e })));
                }
                c.current?.value === e && (s(t || _), h(!1));
              }
            }),
            ((r = (0, p.useRef)(n)).current = n),
            (0, p.useCallback)(
              tp((...e) => r.current(...e), 150),
              []
            )),
          W = (e) =>
            e.reduce((e, t) => {
              let n = t.title;
              return e[n] || (e[n] = []), e[n].push(t), e;
            }, {}),
          U = (e, t, n) => {
            if (n)
              return (0, f.jsx)('div', {
                className: 'flex flex-col items-center',
                children: (0, f.jsx)(rx, { icon: n3, className: 'm-8 opacity-80' }),
              });
            if (0 === e.length && 'inited' === D) return (0, f.jsx)(ia, { query: t });
            let r = W(e),
              a = -1;
            return (0, f.jsx)('ul', {
              className: ii.suggestList,
              children: Object.keys(r).map((e) => {
                let t = r[e] || [];
                return (0, f.jsx)(
                  'li',
                  {
                    children: (0, f.jsx)('ul', {
                      className: 'pb-2',
                      children: t.map((e) => {
                        let t = ++a;
                        return (0, f.jsx)(
                          is,
                          {
                            suggestion: e,
                            isCurrent: t === v,
                            setCurrentSuggestionIndex: (e) => {
                              (j.current.pageX !== e.pageX ||
                                j.current.pageY !== e.pageY) &&
                                (A(!1), x(t));
                            },
                            onMouseMove: (e) => {
                              j.current = { pageX: e.pageX, pageY: e.pageY };
                            },
                            closeSearch: () => {
                              R();
                            },
                            inCurrentDocIndex: 0 === m,
                            scrollTo: k,
                          },
                          `${e.title}-${t}`
                        );
                      }),
                    }),
                  },
                  e
                );
              }),
            });
          };
        return (0, f.jsx)(f.Fragment, {
          children:
            e &&
            (0, u.createPortal)(
              (0, f.jsx)('div', {
                className: ii.mask,
                onClick: () => {
                  R();
                },
                children: (0, f.jsxs)('div', {
                  className: `${ii.modal}`,
                  onClick: (e) => {
                    t(!0), e.stopPropagation();
                  },
                  children: [
                    (0, f.jsxs)('div', {
                      className: 'flex items-center',
                      children: [
                        (0, f.jsxs)('div', {
                          className: ii.inputForm,
                          children: [
                            (0, f.jsx)('label', {
                              children: (0, f.jsx)(rx, { icon: n2 }),
                            }),
                            (0, f.jsx)('input', {
                              className: `rspress-search-panel-input ${ii.input}`,
                              ref: c,
                              placeholder: B,
                              'aria-label': 'SearchPanelInput',
                              autoComplete: 'off',
                              autoFocus: !0,
                              onChange: (e) => H(e.target.value),
                            }),
                            (0, f.jsx)('label', {
                              children: (0, f.jsx)(rx, {
                                icon: n4,
                                className: ii.close,
                                onClick: (e) => {
                                  c.current &&
                                    (e.stopPropagation(),
                                    a ? ((c.current.value = ''), i('')) : R());
                                },
                              }),
                            }),
                          ],
                        }),
                        (0, f.jsx)('h2', {
                          className: 'text-brand ml-2 sm:hidden cursor-pointer',
                          onClick: (e) => {
                            e.stopPropagation(), R();
                          },
                          children: 'Cancel',
                        }),
                      ],
                    }),
                    a && 'inited' === D
                      ? (0, f.jsx)('div', {
                          className: `${ii.searchHits}  rspress-scrollbar`,
                          ref: w,
                          children: ((e, t, n) => {
                            if (1 === e.length) {
                              let t = e[0].result;
                              return 0 !== t.length || n
                                ? (0, f.jsx)('div', { ref: C, children: U(t, a, n) })
                                : (0, f.jsx)(ia, { query: a });
                            }
                            let r = e.map((e) =>
                              t && 'remote' === t.mode
                                ? (t.searchIndexes || [])
                                    .map((e) =>
                                      'string' == typeof e ? { value: e, label: e } : e
                                    )
                                    .find((t) => t.value === e.group).label
                                : e.group
                            );
                            return (0, f.jsx)(it, {
                              values: r,
                              tabContainerClassName: ii.tabClassName,
                              onChange: (e) => {
                                g(e), x(0);
                              },
                              ref: C,
                              children: e.map((e) =>
                                (0, f.jsxs)(
                                  ir,
                                  {
                                    children: [
                                      e.renderType === av.Default && U(e.result, a, n),
                                      e.renderType === av.Custom && l.render(e.result),
                                    ],
                                  },
                                  e.group
                                )
                              ),
                            });
                          })(o, L, d),
                        })
                      : null,
                  ],
                }),
              }),
              document.getElementById('search-container')
            ),
        });
      }
      function iu() {
        let [e, t] = (0, p.useState)(!1),
          [n, r] = (0, p.useState)(null),
          { searchPlaceholderText: a = 'Search Docs' } = n9();
        return (
          (0, p.useEffect)(() => {
            r(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? '⌘' : 'Ctrl');
          }, []),
          (0, f.jsxs)(f.Fragment, {
            children: [
              (0, f.jsx)('div', {
                className: `rspress-nav-search-button ${ii.navSearchButton}`,
                onClick: () => t(!0),
                children: (0, f.jsxs)('button', {
                  children: [
                    (0, f.jsx)(rx, { icon: n2, width: '18', height: '18' }),
                    (0, f.jsx)('p', { className: ii.searchWord, children: a }),
                    (0, f.jsxs)('div', {
                      style: { opacity: +!!n },
                      children: [
                        (0, f.jsx)('span', { children: n }),
                        (0, f.jsx)('span', { children: 'K' }),
                      ],
                    }),
                  ],
                }),
              }),
              (0, f.jsx)('div', {
                className: ii.mobileNavSearchButton,
                onClick: () => t(!0),
                children: (0, f.jsx)(rx, { icon: n2 }),
              }),
              (0, f.jsx)(il, { focused: e, setFocused: t }),
            ],
          })
        );
      }
      let ic = ({ tag: e }) =>
          e
            ? e.trim().startsWith('<svg')
              ? (0, f.jsx)('div', {
                  dangerouslySetInnerHTML: { __html: e },
                  style: { width: 20, marginRight: 4 },
                })
              : (0, f.jsx)('img', { src: e })
            : null,
        id = {
          Layout: (e) => {
            let {
                top: t,
                bottom: n,
                beforeDocFooter: r,
                afterDocFooter: a,
                beforeDoc: i,
                afterDoc: o,
                beforeDocContent: s,
                afterDocContent: l,
                beforeSidebar: u,
                afterSidebar: c,
                beforeOutline: d,
                afterOutline: h,
                beforeNavTitle: m,
                afterNavTitle: g,
                navTitle: v,
                beforeNav: x,
                beforeHero: y,
                afterHero: b,
                beforeFeatures: D,
                afterFeatures: F,
                afterNavMenu: w,
                components: C,
              } = e,
              j = {
                beforeDocFooter: r,
                afterDocFooter: a,
                beforeDocContent: s,
                afterDocContent: l,
                beforeDoc: i,
                afterDoc: o,
                beforeSidebar: u,
                afterSidebar: c,
                beforeOutline: d,
                afterOutline: h,
                components: C,
              },
              E = { beforeHero: y, afterHero: b, beforeFeatures: D, afterFeatures: F },
              { siteData: A, page: k } = eG(),
              { pageType: S, lang: N, title: T, frontmatter: B = {} } = k,
              L = n9();
            !(function () {
              let { scrollPaddingTop: e } = re();
              (0, p.useEffect)(() => {
                window.addEventListener(
                  'click',
                  (t) => {
                    let n = t.target.closest('a');
                    if (!n) return;
                    let { origin: r, hash: a, target: i, pathname: o, search: s } = n,
                      l = window.location;
                    a &&
                      '_blank' !== i &&
                      r === l.origin &&
                      (o === l.pathname &&
                      s === l.search &&
                      a &&
                      n.classList.contains('header-anchor')
                        ? (t.preventDefault(),
                          history.pushState(null, '', a),
                          (function (e, t, n = !1, r) {
                            let a = null;
                            try {
                              a = e.classList.contains('header-anchor')
                                ? e
                                : document.getElementById(decodeURIComponent(t.slice(1)));
                            } catch (e) {
                              console.warn(e);
                            }
                            a && rn(a, n, r);
                          })(n, a, !0, e),
                          window.dispatchEvent(new Event('hashchange')))
                        : window.addEventListener('RspressReloadContent', () => {
                            location.hash.length > 1 &&
                              rn(document.getElementById(location.hash.slice(1)), !1, e);
                          }));
                  },
                  { capture: !0 }
                ),
                  window.addEventListener('hashchange', (e) => {
                    e.preventDefault();
                  });
              }, [e]);
            })(),
              (function () {
                let { siteData: e, page: t } = eG(),
                  n = e.lang || '',
                  r = Object.values(e.themeConfig.locales || {}).map((e) => e.lang) || [],
                  a = t.lang;
                (0, p.useEffect)(() => {
                  let t,
                    i = e.themeConfig.localeRedirect ?? 'auto';
                  if (
                    'never' === i ||
                    !n ||
                    /bot|spider|crawl|lighthouse/i.test(window.navigator.userAgent)
                  )
                    return;
                  let { pathname: o, search: s } = window.location,
                    l = eU(o),
                    u = 'rspress-visited';
                  if (localStorage.getItem(u)) return;
                  localStorage.setItem(u, '1');
                  let c = window.navigator.language.split('-')[0];
                  !r.includes(c) ||
                    (c !== a &&
                      (c === n
                        ? (t = o.replace(`/${a}`, ''))
                        : a === n
                          ? (t = R(`/${c}${l}`))
                          : 'auto' === i && (t = o.replace(`/${a}`, `/${c}`)),
                      t && window.location.replace(t + s)));
                }, []);
              })();
            let O = B.title ?? T,
              P = A.title || L.title || '';
            O =
              O && 'doc' === S
                ? rG(O, B.titleSuffix || P)
                : 'home' === S
                  ? rG(P, B.titleSuffix)
                  : '404' === S
                    ? rG('404', P)
                    : P;
            let _ = B?.description || A.description || L.description,
              $ = { ...re(), ...e.uiSwitch };
            return (0, f.jsxs)(f.Fragment, {
              children: [
                (0, f.jsxs)(e$, {
                  htmlAttributes: { lang: N || 'en' },
                  children: [
                    O ? (0, f.jsx)('title', { children: O }) : null,
                    _ ? (0, f.jsx)('meta', { name: 'description', content: _ }) : null,
                  ],
                }),
                t,
                'blank' !== S &&
                  $.showNavbar &&
                  (0, f.jsx)(a1, {
                    beforeNavTitle: m,
                    afterNavTitle: g,
                    navTitle: v,
                    beforeNav: x,
                    afterNavMenu: w,
                  }),
                (0, f.jsx)('section', {
                  children: (() => {
                    switch (S) {
                      case 'home':
                        return (0, f.jsx)(id.HomeLayout, { ...E });
                      case 'doc':
                        return (0, f.jsx)(rV, { ...j, uiSwitch: $, navTitle: v });
                      case '404':
                        return (0, f.jsx)(id.NotFoundLayout, {});
                      case 'custom':
                      case 'blank':
                        return (0, f.jsx)(eI, {});
                      default:
                        return (0, f.jsx)(rV, { ...j });
                    }
                  })(),
                }),
                n,
              ],
            });
          },
          NotFoundLayout: function () {
            let { siteData: e, page: t } = eG(),
              n = e.lang,
              r = e.multiVersion.default;
            if (
              n &&
              'undefined' != typeof window &&
              location.pathname.includes(`/${n}/`)
            ) {
              let e = location.pathname.replace(`/${n}/`, '/');
              return window.location.replace(e), (0, f.jsx)(f.Fragment, {});
            }
            let a = '/';
            return (
              r && t.version !== r && (a += `${t.version}/`),
              n && t.lang !== n && (a += `${t.lang}/`),
              (0, f.jsxs)('div', {
                className:
                  'm-auto mt-50 p-16 sm:p-8 sm:pt-24 sm:pb-40 text-center flex-center flex-col',
                children: [
                  (0, f.jsx)('p', {
                    className: 'text-6xl font-semibold',
                    children: '404',
                  }),
                  (0, f.jsx)('h1', {
                    className: 'leading-5 pt-3 text-xl font-bold',
                    children: 'PAGE NOT FOUND',
                  }),
                  (0, f.jsx)('div', {
                    style: { height: '1px' },
                    className: 'mt-6 mx-auto mb-4.5 w-16 bg-gray-light-1',
                  }),
                  (0, f.jsx)('div', {
                    className: 'pt-5',
                    children: (0, f.jsx)('a', {
                      className:
                        'py-2 px-4 rounded-2xl inline-block border-solid border-brand text-brand font-medium hover:border-brand-dark hover:text-brand-dark transition-colors duration-300',
                      href: R(a),
                      'aria-label': 'go to home',
                      children: 'Take me home',
                    }),
                  }),
                ],
              })
            );
          },
          HomeLayout: function (e) {
            let { beforeHero: t, afterHero: n, beforeFeatures: r, afterFeatures: a } = e,
              {
                page: { frontmatter: i, routePath: o },
              } = eG();
            return (0, f.jsxs)('div', {
              className: 'relative',
              style: {
                minHeight: 'calc(100vh - var(--rp-nav-height))',
                paddingBottom: '80px',
              },
              children: [
                (0, f.jsxs)('div', {
                  className: 'pb-12',
                  children: [
                    t,
                    (0, f.jsx)(aS, { frontmatter: i, routePath: o }),
                    n,
                    r,
                    (0, f.jsx)(aE, { frontmatter: i, routePath: o }),
                    a,
                  ],
                }),
                (0, f.jsx)(aA, {}),
              ],
            });
          },
        };
      var ih =
          Object.assign ||
          function (e) {
            for (var t = 1; t < arguments.length; t++) {
              var n = arguments[t];
              for (var r in n)
                Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
            }
            return e;
          },
        ip = function (e) {
          return 'IMG' === e.tagName;
        },
        im = function (e) {
          return e && 1 === e.nodeType;
        },
        ig = function (e) {
          return '.svg' === (e.currentSrc || e.src).substr(-4).toLowerCase();
        },
        iv = function (e) {
          try {
            if (Array.isArray(e)) return e.filter(ip);
            if (NodeList.prototype.isPrototypeOf(e)) return [].slice.call(e).filter(ip);
            if (im(e)) return [e].filter(ip);
            if ('string' == typeof e)
              return [].slice.call(document.querySelectorAll(e)).filter(ip);
            return [];
          } catch (e) {
            throw TypeError(
              'The provided selector is invalid.\nExpects a CSS selector, a Node element, a NodeList or an array.\nSee: https://github.com/francoischalifour/medium-zoom'
            );
          }
        },
        ix = function (e) {
          var t = document.createElement('div');
          return t.classList.add('medium-zoom-overlay'), (t.style.background = e), t;
        },
        iy = function (e) {
          var t = e.getBoundingClientRect(),
            n = t.top,
            r = t.left,
            a = t.width,
            i = t.height,
            o = e.cloneNode(),
            s =
              window.pageYOffset ||
              document.documentElement.scrollTop ||
              document.body.scrollTop ||
              0,
            l =
              window.pageXOffset ||
              document.documentElement.scrollLeft ||
              document.body.scrollLeft ||
              0;
          return (
            o.removeAttribute('id'),
            (o.style.position = 'absolute'),
            (o.style.top = n + s + 'px'),
            (o.style.left = r + l + 'px'),
            (o.style.width = a + 'px'),
            (o.style.height = i + 'px'),
            (o.style.transform = ''),
            o
          );
        },
        ib = function (e, t) {
          var n = ih({ bubbles: !1, cancelable: !1, detail: void 0 }, t);
          if ('function' == typeof window.CustomEvent) return new CustomEvent(e, n);
          var r = document.createEvent('CustomEvent');
          return r.initCustomEvent(e, n.bubbles, n.cancelable, n.detail), r;
        };
      !(function (e, t) {
        void 0 === t && (t = {});
        var n = t.insertAt;
        if (e && 'undefined' != typeof document) {
          var r = document.head || document.getElementsByTagName('head')[0],
            a = document.createElement('style');
          (a.type = 'text/css'),
            'top' === n && r.firstChild
              ? r.insertBefore(a, r.firstChild)
              : r.appendChild(a),
            a.styleSheet
              ? (a.styleSheet.cssText = e)
              : a.appendChild(document.createTextNode(e));
        }
      })(
        '.medium-zoom-overlay{position:fixed;top:0;right:0;bottom:0;left:0;opacity:0;transition:opacity .3s;will-change:opacity}.medium-zoom--opened .medium-zoom-overlay{cursor:pointer;cursor:zoom-out;opacity:1}.medium-zoom-image{cursor:pointer;cursor:zoom-in;transition:transform .3s cubic-bezier(.2,0,.2,1)!important}.medium-zoom-image--hidden{visibility:hidden}.medium-zoom-image--opened{position:relative;cursor:pointer;cursor:zoom-out;will-change:transform}'
      );
      let iD = function e(t) {
        var n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
          r =
            window.Promise ||
            function (e) {
              function t() {}
              e(t, t);
            },
          a = function () {
            for (var e = arguments.length, t = Array(e), n = 0; n < e; n++)
              t[n] = arguments[n];
            var r = t.reduce(function (e, t) {
              return [].concat(e, iv(t));
            }, []);
            return (
              r
                .filter(function (e) {
                  return -1 === l.indexOf(e);
                })
                .forEach(function (e) {
                  l.push(e), e.classList.add('medium-zoom-image');
                }),
              u.forEach(function (e) {
                var t = e.type,
                  n = e.listener,
                  a = e.options;
                r.forEach(function (e) {
                  e.addEventListener(t, n, a);
                });
              }),
              m
            );
          },
          i = function () {
            var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
              t = e.target,
              n = function () {
                var e = {
                    width: document.documentElement.clientWidth,
                    height: document.documentElement.clientHeight,
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                  },
                  t = void 0,
                  n = void 0;
                if (h.container)
                  if (h.container instanceof Object)
                    (t =
                      (e = ih({}, e, h.container)).width -
                      e.left -
                      e.right -
                      2 * h.margin),
                      (n = e.height - e.top - e.bottom - 2 * h.margin);
                  else {
                    var r = (
                      im(h.container) ? h.container : document.querySelector(h.container)
                    ).getBoundingClientRect();
                    e = ih({}, e, {
                      width: r.width,
                      height: r.height,
                      left: r.left,
                      top: r.top,
                    });
                  }
                (t = t || e.width - 2 * h.margin), (n = n || e.height - 2 * h.margin);
                var a = f.zoomedHd || f.original,
                  i = ig(a) ? t : a.naturalWidth || t,
                  o = ig(a) ? n : a.naturalHeight || n,
                  s = a.getBoundingClientRect(),
                  l = s.top,
                  u = s.left,
                  c = s.width,
                  d = s.height,
                  p = Math.min(
                    Math.min(Math.max(c, i), t) / c,
                    Math.min(Math.max(d, o), n) / d
                  ),
                  m = (-u + (t - c) / 2 + h.margin + e.left) / p,
                  g = (-l + (n - d) / 2 + h.margin + e.top) / p,
                  v = 'scale(' + p + ') translate3d(' + m + 'px, ' + g + 'px, 0)';
                (f.zoomed.style.transform = v),
                  f.zoomedHd && (f.zoomedHd.style.transform = v);
              };
            return new r(function (e) {
              if ((t && -1 === l.indexOf(t)) || f.zoomed) return void e(m);
              if (t) f.original = t;
              else {
                if (!(l.length > 0)) return void e(m);
                f.original = l[0];
              }
              if (
                (f.original.dispatchEvent(
                  ib('medium-zoom:open', { detail: { zoom: m } })
                ),
                (d =
                  window.pageYOffset ||
                  document.documentElement.scrollTop ||
                  document.body.scrollTop ||
                  0),
                (c = !0),
                (f.zoomed = iy(f.original)),
                document.body.appendChild(p),
                h.template)
              ) {
                var r = im(h.template) ? h.template : document.querySelector(h.template);
                (f.template = document.createElement('div')),
                  f.template.appendChild(r.content.cloneNode(!0)),
                  document.body.appendChild(f.template);
              }
              if (
                (f.original.parentElement &&
                  'PICTURE' === f.original.parentElement.tagName &&
                  f.original.currentSrc &&
                  (f.zoomed.src = f.original.currentSrc),
                document.body.appendChild(f.zoomed),
                window.requestAnimationFrame(function () {
                  document.body.classList.add('medium-zoom--opened');
                }),
                f.original.classList.add('medium-zoom-image--hidden'),
                f.zoomed.classList.add('medium-zoom-image--opened'),
                f.zoomed.addEventListener('click', o),
                f.zoomed.addEventListener('transitionend', function t() {
                  (c = !1),
                    f.zoomed.removeEventListener('transitionend', t),
                    f.original.dispatchEvent(
                      ib('medium-zoom:opened', { detail: { zoom: m } })
                    ),
                    e(m);
                }),
                f.original.getAttribute('data-zoom-src'))
              ) {
                (f.zoomedHd = f.zoomed.cloneNode()),
                  f.zoomedHd.removeAttribute('srcset'),
                  f.zoomedHd.removeAttribute('sizes'),
                  f.zoomedHd.removeAttribute('loading'),
                  (f.zoomedHd.src = f.zoomed.getAttribute('data-zoom-src')),
                  (f.zoomedHd.onerror = function () {
                    clearInterval(a),
                      console.warn(
                        'Unable to reach the zoom image target ' + f.zoomedHd.src
                      ),
                      (f.zoomedHd = null),
                      n();
                  });
                var a = setInterval(function () {
                  f.zoomedHd.complete &&
                    (clearInterval(a),
                    f.zoomedHd.classList.add('medium-zoom-image--opened'),
                    f.zoomedHd.addEventListener('click', o),
                    document.body.appendChild(f.zoomedHd),
                    n());
                }, 10);
              } else if (f.original.hasAttribute('srcset')) {
                (f.zoomedHd = f.zoomed.cloneNode()),
                  f.zoomedHd.removeAttribute('sizes'),
                  f.zoomedHd.removeAttribute('loading');
                var i = f.zoomedHd.addEventListener('load', function () {
                  f.zoomedHd.removeEventListener('load', i),
                    f.zoomedHd.classList.add('medium-zoom-image--opened'),
                    f.zoomedHd.addEventListener('click', o),
                    document.body.appendChild(f.zoomedHd),
                    n();
                });
              } else n();
            });
          },
          o = function () {
            return new r(function (e) {
              c || !f.original
                ? e(m)
                : ((c = !0),
                  document.body.classList.remove('medium-zoom--opened'),
                  (f.zoomed.style.transform = ''),
                  f.zoomedHd && (f.zoomedHd.style.transform = ''),
                  f.template &&
                    ((f.template.style.transition = 'opacity 150ms'),
                    (f.template.style.opacity = 0)),
                  f.original.dispatchEvent(
                    ib('medium-zoom:close', { detail: { zoom: m } })
                  ),
                  f.zoomed.addEventListener('transitionend', function t() {
                    f.original.classList.remove('medium-zoom-image--hidden'),
                      document.body.removeChild(f.zoomed),
                      f.zoomedHd && document.body.removeChild(f.zoomedHd),
                      document.body.removeChild(p),
                      f.zoomed.classList.remove('medium-zoom-image--opened'),
                      f.template && document.body.removeChild(f.template),
                      (c = !1),
                      f.zoomed.removeEventListener('transitionend', t),
                      f.original.dispatchEvent(
                        ib('medium-zoom:closed', { detail: { zoom: m } })
                      ),
                      (f.original = null),
                      (f.zoomed = null),
                      (f.zoomedHd = null),
                      (f.template = null),
                      e(m);
                  }));
            });
          },
          s = function () {
            var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
              t = e.target;
            return f.original ? o() : i({ target: t });
          },
          l = [],
          u = [],
          c = !1,
          d = 0,
          h = n,
          f = { original: null, zoomed: null, zoomedHd: null, template: null };
        '[object Object]' === Object.prototype.toString.call(t)
          ? (h = t)
          : (t || 'string' == typeof t) && a(t);
        var p = ix(
          (h = ih(
            {
              margin: 0,
              background: '#fff',
              scrollOffset: 40,
              container: null,
              template: null,
            },
            h
          )).background
        );
        document.addEventListener('click', function (e) {
          var t = e.target;
          t === p ? o() : -1 !== l.indexOf(t) && s({ target: t });
        }),
          document.addEventListener('keyup', function (e) {
            var t = e.key || e.keyCode;
            ('Escape' === t || 'Esc' === t || 27 === t) && o();
          }),
          document.addEventListener('scroll', function () {
            if (!c && f.original) {
              var e =
                window.pageYOffset ||
                document.documentElement.scrollTop ||
                document.body.scrollTop ||
                0;
              Math.abs(d - e) > h.scrollOffset && setTimeout(o, 150);
            }
          }),
          window.addEventListener('resize', o);
        var m = {
          open: i,
          close: o,
          toggle: s,
          update: function () {
            var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
            if (
              (e.background && (p.style.background = e.background),
              e.container &&
                e.container instanceof Object &&
                (e.container = ih({}, h.container, e.container)),
              e.template)
            ) {
              var t = im(e.template) ? e.template : document.querySelector(e.template);
              e.template = t;
            }
            return (
              (h = ih({}, h, e)),
              l.forEach(function (e) {
                e.dispatchEvent(ib('medium-zoom:update', { detail: { zoom: m } }));
              }),
              m
            );
          },
          clone: function () {
            var t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
            return e(ih({}, h, t));
          },
          attach: a,
          detach: function () {
            for (var e = arguments.length, t = Array(e), n = 0; n < e; n++)
              t[n] = arguments[n];
            f.zoomed && o();
            var r =
              t.length > 0
                ? t.reduce(function (e, t) {
                    return [].concat(e, iv(t));
                  }, [])
                : l;
            return (
              r.forEach(function (e) {
                e.classList.remove('medium-zoom-image'),
                  e.dispatchEvent(ib('medium-zoom:detach', { detail: { zoom: m } }));
              }),
              (l = l.filter(function (e) {
                return -1 === r.indexOf(e);
              })),
              m
            );
          },
          on: function (e, t) {
            var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
            return (
              l.forEach(function (r) {
                r.addEventListener('medium-zoom:' + e, t, n);
              }),
              u.push({ type: 'medium-zoom:' + e, listener: t, options: n }),
              m
            );
          },
          off: function (e, t) {
            var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
            return (
              l.forEach(function (r) {
                r.removeEventListener('medium-zoom:' + e, t, n);
              }),
              (u = u.filter(function (n) {
                return (
                  n.type !== 'medium-zoom:' + e || n.listener.toString() !== t.toString()
                );
              })),
              m
            );
          },
          getOptions: function () {
            return h;
          },
          getImages: function () {
            return l;
          },
          getZoomedImage: function () {
            return f.original;
          },
        };
        return m;
      };
      n(2248);
      let iF = [
        [
          function (e) {
            let { pathname: t } = eq(),
              { selector: n = '.rspress-doc img', options: r = {} } = e;
            return (
              (0, p.useEffect)(() => {
                let e,
                  t = setTimeout(() => {
                    e = iD(document.querySelectorAll(n), {
                      ...r,
                      background: 'var(--rp-c-bg)',
                    });
                  }, 100);
                return () => {
                  clearTimeout(t), null == e || e.detach(), null == e || e.close();
                };
              }, [t]),
              null
            );
          },
          {},
        ],
      ];
      async function iw(e) {
        var t, n;
        let r = A(e);
        if (r) {
          let e = await r.preload(),
            t = r.filePath.replace(N, '').replace(S, ''),
            a = x.pages.find((e) => {
              let t = (e) => e.replace(/\/$/, '').toLowerCase();
              return eR(t(e.routePath), t(r.path));
            }),
            i = encodeURIComponent(t),
            o = (null == (n = e.default.__RSPRESS_PAGE_META) ? void 0 : n[i]) || {},
            {
              toc: s = [],
              title: l = '',
              frontmatter: u = {},
              ...c
            } = T.test(r.filePath) ? o : e;
          return {
            siteData: x,
            page: {
              ...c,
              pagePath: t,
              ...a,
              pageType: (null == u ? void 0 : u.pageType) || 'doc',
              title: l,
              frontmatter: u,
              toc: s,
            },
          };
        }
        let a = x.lang || '',
          i = (null == (t = x.multiVersion) ? void 0 : t.default) || '';
        if (x.lang && 'undefined' != typeof window) {
          let e = location.pathname.replace(x.base, '').split('/').slice(0, 2);
          if (x.locales.length) {
            let t = x.locales.find((t) => {
              let { lang: n } = t;
              return e.includes(n);
            });
            t && (a = t.lang);
          }
          if (x.multiVersion.versions) {
            let t = x.multiVersion.versions.find((t) => e.includes(t));
            t && (i = t);
          }
        }
        return {
          siteData: x,
          page: {
            pagePath: '',
            pageType: '404',
            routePath: '/404',
            lang: a,
            frontmatter: {},
            title: '404',
            toc: [],
            version: i,
            _filepath: '',
            _relativePath: '',
          },
        };
      }
      function iC(e) {
        let { helmetContext: t } = e,
          { setData: n, data: r } = (0, p.useContext)(m),
          a = r.page.frontmatter || {},
          { pathname: i, search: o } = eq(),
          s = new URLSearchParams(o),
          l = 'globalUIComponents',
          u = !1 === a[l] || '0' === s.get(l);
        return (
          (0, p.useLayoutEffect)(() => {
            !(async function () {
              try {
                let e = await iw(i);
                null == n || n(e);
              } catch (e) {
                console.log(e);
              }
            })();
          }, [i, n]),
          (0, f.jsxs)(eS, {
            context: t,
            children: [
              (0, f.jsx)(id.Layout, {}),
              !u &&
                iF.map((e, t) => {
                  if (Array.isArray(e)) {
                    let [n, r] = e;
                    return p.createElement(n, { key: t, ...r });
                  }
                  return p.createElement(e, { key: t });
                }),
            ],
          })
        );
      }
      n(967);
      var ij = {
          'react-dom': function (e) {
            e.exports = c;
          },
          'react-dom/client': function (e) {
            e.exports = h;
          },
        },
        iE = {};
      let iA = x.ssg;
      !(async function () {
        let e = document.getElementById('root'),
          t = async () => {
            let e = await iw(window.location.pathname);
            return function () {
              let [t, n] = (0, p.useState)(e),
                [r, a] = (() => {
                  var e;
                  let t,
                    n = ((e) => {
                      let [t, n] = (0, p.useState)(
                        () => 'undefined' != typeof window && window.matchMedia(e).matches
                      );
                      return (
                        (0, p.useEffect)(() => {
                          let t = window.matchMedia(e),
                            r = (e) => n(e.matches);
                          return (
                            t.addEventListener('change', r),
                            () => t.removeEventListener('change', r)
                          );
                        }, [e]),
                        t
                      );
                    })('(prefers-color-scheme: dark)'),
                    [r, a] = ay('rspress-theme-appearance', 'auto'),
                    i =
                      ((e = () => {
                        if (aD) return 'light';
                        let e = ab(r);
                        return 'auto' === e ? (n ? 'dark' : 'light') : e;
                      }),
                      ((t = (0, p.useRef)(e)).current = e),
                      (0, p.useRef)((...e) => t.current(...e)).current),
                    [o, s] = (0, p.useState)(() => {
                      if ('undefined' == typeof window) return 'light';
                      let e = window.RSPRESS_THEME ?? window.MODERN_THEME;
                      return e ? ('dark' === e ? 'dark' : 'light') : i();
                    }),
                    l = (0, p.useCallback)((e, t = e) => {
                      aD || (s(e), a(t), c(!0));
                    }, []);
                  (0, p.useEffect)(() => {
                    document.documentElement.classList.toggle('dark', 'dark' === o),
                      (document.documentElement.style.colorScheme = o);
                  }, [o]);
                  let [u, c] = (0, p.useState)(!0);
                  return (
                    (0, p.useEffect)(() => {
                      c(!1);
                    }, [u]),
                    (0, p.useEffect)(() => {
                      u || l(i(), ab(r));
                    }, [r]),
                    (0, p.useEffect)(() => {
                      u || l(n ? 'dark' : 'light', 'auto');
                    }, [n]),
                    [o, l]
                  );
                })();
              return (0, f.jsx)(g.Provider, {
                value: (0, p.useMemo)(() => ({ theme: r, setTheme: a }), [r, a]),
                children: (0, f.jsx)(m.Provider, {
                  value: (0, p.useMemo)(() => ({ data: t, setData: n }), [t, n]),
                  children: (0, f.jsx)(eM, { children: (0, f.jsx)(iC, {}) }),
                }),
              });
            };
          },
          n = await t();
        {
          let { createRoot: t, hydrateRoot: r } = (function e(t) {
            var n = iE[t];
            if (void 0 !== n) return n.exports;
            var r = (iE[t] = { exports: {} });
            return ij[t](r, r.exports, e), r.exports;
          })('react-dom/client');
          iA ? r(e, (0, f.jsx)(n, {})) : t(e).render((0, f.jsx)(n, {}));
        }
      })();
    },
    9402: function (e) {
      (e.exports = function (e) {
        return e && e.__esModule ? e : { default: e };
      }),
        (e.exports.__esModule = !0),
        (e.exports.default = e.exports);
    },
    2915: function (e, t, n) {
      'use strict';
      n.d(t, { RP: () => i, xA: () => s });
      var r = n(2155);
      let a = r.createContext({});
      function i(e) {
        let t = r.useContext(a);
        return r.useMemo(() => ('function' == typeof e ? e(t) : { ...t, ...e }), [t, e]);
      }
      let o = {};
      function s({ components: e, children: t, disableParentContext: n }) {
        let s;
        return (
          (s = n ? ('function' == typeof e ? e({}) : e || o) : i(e)),
          r.createElement(a.Provider, { value: s }, t)
        );
      }
    },
    3209: function (e) {
      'use strict';
      e.exports = JSON.parse(
        '{"AElig":"\xc6","AMP":"&","Aacute":"\xc1","Acirc":"\xc2","Agrave":"\xc0","Aring":"\xc5","Atilde":"\xc3","Auml":"\xc4","COPY":"\xa9","Ccedil":"\xc7","ETH":"\xd0","Eacute":"\xc9","Ecirc":"\xca","Egrave":"\xc8","Euml":"\xcb","GT":">","Iacute":"\xcd","Icirc":"\xce","Igrave":"\xcc","Iuml":"\xcf","LT":"<","Ntilde":"\xd1","Oacute":"\xd3","Ocirc":"\xd4","Ograve":"\xd2","Oslash":"\xd8","Otilde":"\xd5","Ouml":"\xd6","QUOT":"\\"","REG":"\xae","THORN":"\xde","Uacute":"\xda","Ucirc":"\xdb","Ugrave":"\xd9","Uuml":"\xdc","Yacute":"\xdd","aacute":"\xe1","acirc":"\xe2","acute":"\xb4","aelig":"\xe6","agrave":"\xe0","amp":"&","aring":"\xe5","atilde":"\xe3","auml":"\xe4","brvbar":"\xa6","ccedil":"\xe7","cedil":"\xb8","cent":"\xa2","copy":"\xa9","curren":"\xa4","deg":"\xb0","divide":"\xf7","eacute":"\xe9","ecirc":"\xea","egrave":"\xe8","eth":"\xf0","euml":"\xeb","frac12":"\xbd","frac14":"\xbc","frac34":"\xbe","gt":">","iacute":"\xed","icirc":"\xee","iexcl":"\xa1","igrave":"\xec","iquest":"\xbf","iuml":"\xef","laquo":"\xab","lt":"<","macr":"\xaf","micro":"\xb5","middot":"\xb7","nbsp":"\xa0","not":"\xac","ntilde":"\xf1","oacute":"\xf3","ocirc":"\xf4","ograve":"\xf2","ordf":"\xaa","ordm":"\xba","oslash":"\xf8","otilde":"\xf5","ouml":"\xf6","para":"\xb6","plusmn":"\xb1","pound":"\xa3","quot":"\\"","raquo":"\xbb","reg":"\xae","sect":"\xa7","shy":"\xad","sup1":"\xb9","sup2":"\xb2","sup3":"\xb3","szlig":"\xdf","thorn":"\xfe","times":"\xd7","uacute":"\xfa","ucirc":"\xfb","ugrave":"\xf9","uml":"\xa8","uuml":"\xfc","yacute":"\xfd","yen":"\xa5","yuml":"\xff"}'
      );
    },
    5109: function (e) {
      'use strict';
      e.exports = JSON.parse(
        '{"0":"�","128":"€","130":"‚","131":"ƒ","132":"„","133":"…","134":"†","135":"‡","136":"ˆ","137":"‰","138":"Š","139":"‹","140":"Œ","142":"Ž","145":"‘","146":"’","147":"“","148":"”","149":"•","150":"–","151":"—","152":"˜","153":"™","154":"š","155":"›","156":"œ","158":"ž","159":"Ÿ"}'
      );
    },
  },
]);
