'use strict';
(self.webpackChunkrspress_ssg = self.webpackChunkrspress_ssg || []).push([
  ['971'],
  {
    3766: function (e, r, t) {
      t.r(r), t.d(r, { default: () => h });
      var s = t(5723),
        l = t(2915);
      function n(e) {
        let r = Object.assign(
          { h1: 'h1', a: 'a', h2: 'h2', p: 'p' },
          (0, l.RP)(),
          e.components
        );
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsxs)(r.h1, {
              id: 'hello-world',
              children: [
                'Hello world!',
                (0, s.jsx)(r.a, {
                  className: 'header-anchor',
                  'aria-hidden': 'true',
                  href: '#hello-world',
                  children: '#',
                }),
              ],
            }),
            '\n',
            (0, s.jsxs)(r.h2, {
              id: 'start',
              children: [
                'Start',
                (0, s.jsx)(r.a, {
                  className: 'header-anchor',
                  'aria-hidden': 'true',
                  href: '#start',
                  children: '#',
                }),
              ],
            }),
            '\n',
            (0, s.jsx)(r.p, {
              children: 'Write something to build your own docs! \uD83C\uDF81',
            }),
          ],
        });
      }
      function a() {
        let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
          { wrapper: r } = Object.assign({}, (0, l.RP)(), e.components);
        return r ? (0, s.jsx)(r, { ...e, children: (0, s.jsx)(n, { ...e }) }) : n(e);
      }
      let h = a;
      (a.__RSPRESS_PAGE_META = {}),
        (a.__RSPRESS_PAGE_META['hello.md'] = {
          toc: [{ text: 'Start', id: 'start', depth: 2 }],
          title: 'Hello world!',
          headingTitle: 'Hello world!',
          frontmatter: {},
        });
    },
  },
]);
