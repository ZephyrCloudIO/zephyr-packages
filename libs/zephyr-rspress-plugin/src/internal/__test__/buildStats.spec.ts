import { buildStats } from '../stats/buildStats';

describe('buildStats', () => {
  it('should return a Stats object with correct compilation options and assets', () => {
    const root = '/root';
    const files = ['file1.js', 'file2.css'];

    const result = buildStats(root, files);

    expect(result).toHaveProperty('compilation');
    expect(result.compilation).toHaveProperty('options');
    expect(result.compilation.options.context).toBe(root);

    const json = result.toJson();
    expect(json).toHaveProperty('assets');
    expect(json.assets).toEqual(files.map((name) => ({ name })));
  });
});
