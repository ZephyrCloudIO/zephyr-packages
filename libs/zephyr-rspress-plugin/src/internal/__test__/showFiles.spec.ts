import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ze_log } from 'zephyr-agent';
import { showFiles } from '../files/showFiles';

jest.mock('node:fs/promises');
jest.mock('zephyr-agent', () => ({
  ze_log: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedZeLog = ze_log as unknown as jest.Mock;

describe('showFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs size for each file', async () => {
    const root = '/fake';
    const files = ['a.js', 'b.css'];

    mockedFs.stat.mockImplementation(async (filePath) => {
      return {
        size: filePath.toString().includes('a.js') ? 2048 : 1024,
      } as Stats;
    });

    await showFiles(root, files);

    expect(mockedFs.stat).toHaveBeenCalledWith(path.join(root, 'a.js'));
    expect(mockedFs.stat).toHaveBeenCalledWith(path.join(root, 'b.css'));
    expect(mockedZeLog).toHaveBeenCalledWith('a.js — 2.00 KB');
    expect(mockedZeLog).toHaveBeenCalledWith('b.css — 1.00 KB');
  });

  it('logs error for file that fails stat', async () => {
    const root = '/fake';
    const files = ['good.js', 'bad.js'];

    mockedFs.stat.mockImplementation(async (filePath) => {
      if (filePath.toString().includes('bad.js')) {
        throw new Error('fail');
      }
      return { size: 1000 } as Stats;
    });

    await showFiles(root, files);

    expect(mockedZeLog).toHaveBeenCalledWith('good.js — 0.98 KB');
    expect(mockedZeLog).toHaveBeenCalledWith('Failed to stat file: bad.js');
  });

  it('logs message for empty file list', async () => {
    await showFiles('/any', []);
    expect(mockedZeLog).toHaveBeenCalledWith('No files found in output directory.');
  });
});
