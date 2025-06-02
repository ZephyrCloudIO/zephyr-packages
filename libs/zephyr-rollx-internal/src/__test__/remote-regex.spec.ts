import { viteLikeRemoteRegex } from '../lib/remote-regex';

describe('remote-regex', () => {
  describe('viteLikeRemoteRegex', () => {
    // Test basic loadRemote pattern
    describe('basic loadRemote pattern', () => {
      const basicPattern = viteLikeRemoteRegex[0];

      it('should match basic loadRemote calls with double quotes', () => {
        const code = `loadRemote("remote1/Component1")`;
        const matches = [...code.matchAll(basicPattern)];

        expect(matches).toHaveLength(1);
        expect(matches[0][1]).toBe('remote1');
        expect(matches[0][2]).toBe('Component1');
      });

      it('should match basic loadRemote calls with single quotes', () => {
        const code = `loadRemote('remote2/Component2')`;
        const matches = [...code.matchAll(basicPattern)];

        expect(matches).toHaveLength(1);
        expect(matches[0][1]).toBe('remote2');
        expect(matches[0][2]).toBe('Component2');
      });

      it('should match multiple loadRemote calls in same string', () => {
        const code = `
          loadRemote("remote1/Button");
          loadRemote('remote2/Header');
          loadRemote("remote3/Footer");
        `;
        const matches = [...code.matchAll(basicPattern)];

        expect(matches).toHaveLength(3);
        expect(matches[0]).toEqual(expect.arrayContaining(['remote1', 'Button']));
        expect(matches[1]).toEqual(expect.arrayContaining(['remote2', 'Header']));
        expect(matches[2]).toEqual(expect.arrayContaining(['remote3', 'Footer']));
      });

      it('should not match invalid patterns', () => {
        const invalidCodes = [
          'loadRemote("remote1")', // missing component
          'loadRemote("remote1/component1/extra")', // too many parts
          'loadRemote(remote1/Component1)', // missing quotes
          'notLoadRemote("remote1/Component1")', // wrong function name
        ];

        invalidCodes.forEach((code) => {
          const matches = [...code.matchAll(basicPattern)];
          expect(matches).toHaveLength(0);
        });
      });
    });

    // Test destructured pattern
    describe('destructured pattern', () => {
      const destructuredPattern = viteLikeRemoteRegex[1];

      it('should match destructured loadRemote calls', () => {
        const code = `const { loadRemote: c } = a; c("remote1/Component1")`;
        const matches = [...code.matchAll(destructuredPattern)];

        expect(matches).toHaveLength(1);
        expect(matches[0][4]).toBe('remote1');
        expect(matches[0][5]).toBe('Component1');
      });

      it('should match loadRemote property assignment', () => {
        const code = `loadRemote: myLoader, myLoader("remote2/Component2")`;
        const matches = [...code.matchAll(destructuredPattern)];

        expect(matches).toHaveLength(1);
        expect(matches[0][4]).toBe('remote2');
        expect(matches[0][5]).toBe('Component2');
      });

      it('should handle various spacing patterns', () => {
        const codes = [
          `{ loadRemote: c } = a; c("remote1/Component1")`,
          `{loadRemote:c}=a;c("remote1/Component1")`,
          `{ loadRemote : c } = a; c("remote1/Component1")`,
        ];

        codes.forEach((code) => {
          const matches = [...code.matchAll(destructuredPattern)];
          expect(matches).toHaveLength(1);
          expect(matches[0][4]).toBe('remote1');
          expect(matches[0][5]).toBe('Component1');
        });
      });
    });

    // Test promise chain pattern
    describe('promise chain pattern', () => {
      const promisePattern = viteLikeRemoteRegex[2];

      it('should match promise chain patterns', () => {
        const code = `n.then(e => c("remote1/Component1"))`;
        const matches = [...code.matchAll(promisePattern)];

        expect(matches).toHaveLength(1);
        expect(matches[0][1]).toBe('remote1');
        expect(matches[0][2]).toBe('Component1');
      });

      it('should match various promise chain formats', () => {
        const codes = [
          `promise.then(response => response("remote1/Component1"))`,
          `fetch().then(data => data("remote2/Component2"))`,
          `something.then(result => result("remote3/Component3"))`,
        ];

        codes.forEach((code) => {
          const matches = [...code.matchAll(promisePattern)];
          expect(matches).toHaveLength(1);
          expect(matches[0][1]).toMatch(/remote[1-3]/);
          expect(matches[0][2]).toMatch(/Component[1-3]/);
        });
      });

      it('should handle complex promise chains', () => {
        const code = `
          fetch('/api')
            .then(response => response.json())
            .then(data => loadRemoteComponent("userModule/UserProfile"))
            .catch(error => console.error(error));
        `;
        const matches = [...code.matchAll(promisePattern)];

        expect(matches).toHaveLength(1);
        expect(matches[0][1]).toBe('userModule');
        expect(matches[0][2]).toBe('UserProfile');
      });
    });

    // Test all patterns together
    describe('all patterns together', () => {
      it('should match mixed patterns in complex code', () => {
        const complexCode = `
          // Basic pattern
          loadRemote("remote1/Button");
          
          // Destructured pattern  
          const { loadRemote: c } = microfrontendLoader; c("remote2/Header");
          
          // Promise chain pattern
          dynamicImport.then(module => module("remote3/Footer"));
          
          // More complex scenarios
          if (condition) {
            loadRemote('remote4/ConditionalComponent');
          }
          
          const loaderFunc = (name) => {
            return importRemote.then(loader => loader("remote5/DynamicComponent"));
          };
        `;

        const allMatches: string[][] = [];

        viteLikeRemoteRegex.forEach((pattern) => {
          const matches = [...complexCode.matchAll(pattern)];
          matches.forEach((match) => {
            // Extract remote and component based on pattern
            if (match.length === 3) {
              allMatches.push([match[1], match[2]]);
            } else if (match.length === 6) {
              allMatches.push([match[4], match[5]]);
            }
          });
        });

        expect(allMatches).toHaveLength(5);
        expect(allMatches).toEqual(
          expect.arrayContaining([
            ['remote1', 'Button'],
            ['remote2', 'Header'],
            ['remote3', 'Footer'],
            ['remote4', 'ConditionalComponent'],
            ['remote5', 'DynamicComponent'],
          ])
        );
      });
    });

    // Test edge cases
    describe('edge cases', () => {
      it('should handle nested quotes correctly', () => {
        const code = `loadRemote("remote1/Component with spaces")`;
        const matches = [...code.matchAll(viteLikeRemoteRegex[0])];

        expect(matches).toHaveLength(1);
        expect(matches[0][1]).toBe('remote1');
        expect(matches[0][2]).toBe('Component with spaces');
      });

      it('should handle special characters in component names', () => {
        const code = `loadRemote("remote-1/Component_2")`;
        const matches = [...code.matchAll(viteLikeRemoteRegex[0])];

        expect(matches).toHaveLength(1);
        expect(matches[0][1]).toBe('remote-1');
        expect(matches[0][2]).toBe('Component_2');
      });

      it('should handle minified code patterns', () => {
        const minifiedCode = `a.then(b=>c("r1/C1"));d.then(e=>f("r2/C2"))`;
        const matches = [...minifiedCode.matchAll(viteLikeRemoteRegex[2])];

        expect(matches).toHaveLength(2);
        expect(matches[0]).toEqual(expect.arrayContaining(['r1', 'C1']));
        expect(matches[1]).toEqual(expect.arrayContaining(['r2', 'C2']));
      });

      it('should not match malformed patterns', () => {
        const malformedCodes = [
          `loadRemote("remote1")`, // missing component
          `loadRemote("remote1/")`, // empty component
          `loadRemote("/Component1")`, // empty remote
          `loadRemote("")`, // empty string
          `loadRemote("remote1//Component1")`, // double slash
        ];

        malformedCodes.forEach((code) => {
          viteLikeRemoteRegex.forEach((pattern) => {
            const matches = [...code.matchAll(pattern)];
            expect(matches).toHaveLength(0);
          });
        });
      });

      it('should handle case-sensitive patterns', () => {
        const code = `LoadRemote("remote1/Component1")`; // Capital L
        const matches = [...code.matchAll(viteLikeRemoteRegex[0])];

        expect(matches).toHaveLength(0); // Should not match due to case sensitivity
      });
    });

    // Test regex flags and behavior
    describe('regex flags and behavior', () => {
      it('should have global flag set on all patterns', () => {
        viteLikeRemoteRegex.forEach((pattern) => {
          expect(pattern.global).toBe(true);
        });
      });

      it('should reset lastIndex between uses', () => {
        const code = `loadRemote("remote1/Component1"); loadRemote("remote2/Component2")`;
        const pattern = viteLikeRemoteRegex[0];

        // First match
        const firstMatch = pattern.exec(code);
        expect(firstMatch).toBeTruthy();
        expect(firstMatch?.[1]).toBe('remote1');

        // Reset and match again should find first match again
        pattern.lastIndex = 0;
        const resetMatch = pattern.exec(code);
        expect(resetMatch).toBeTruthy();
        expect(resetMatch?.[1]).toBe('remote1');
      });
    });
  });
});
