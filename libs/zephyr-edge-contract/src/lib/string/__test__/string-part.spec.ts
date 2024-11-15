import { formatString } from '../string';

const data: { str: string; params: any; expected: string }[] = [
  // no defaults
  {
    str: 'pre {{ name }} post',
    params: { name: 'A' },
    expected: 'pre A post',
  },
  {
    str: '{{ name }} post',
    params: { name: 'A' },
    expected: 'A post',
  },
  {
    str: 'pre {{ name }}',
    params: { name: 'A' },
    expected: 'pre A',
  },

  // without params
  {
    str: 'pre {{ name }} post',
    params: {},
    expected: 'pre name post',
  },
  {
    str: '{{ name }} post',
    params: {},
    expected: 'name post',
  },
  {
    str: 'pre {{ name }}',
    params: {},
    expected: 'pre name',
  },

  // Default
  {
    str: 'pre {{ name = B }} post',
    params: {},
    expected: 'pre B post',
  },
  {
    str: '{{ name = B }} post',
    params: {},
    expected: 'B post',
  },
  {
    str: 'pre {{ name = B }}',
    params: {},
    expected: 'pre B',
  },

  // Default with params
  {
    str: 'pre {{ name = B }} post',
    params: { name: 'C' },
    expected: 'pre C post',
  },
  {
    str: '{{ name = B }} post',
    params: { name: 'C' },
    expected: 'C post',
  },
  {
    str: 'pre {{ name = B }}',
    params: { name: 'C' },
    expected: 'pre C',
  },

  // Default with spaces
  {
    str: 'pre {{ name = A B }} post',
    params: {},
    expected: 'pre A B post',
  },
  {
    str: '{{ name = A B }} post',
    params: {},
    expected: 'A B post',
  },
  {
    str: 'pre {{ name = A B }}',
    params: {},
    expected: 'pre A B',
  },
];

describe('formatString()', () => {
  for (const { str, params, expected } of data) {
    it(`Formats "${str}" with ${JSON.stringify(params)} to "${expected}"`, () => {
      expect(formatString(str, params)).toBe(expected);
    });
  }
});
