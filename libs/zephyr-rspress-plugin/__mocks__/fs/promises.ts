// Manual mock for `node:fs/promises`, used by rstest when tests call
// `rs.mock('node:fs/promises')` without a factory (Jest automock equivalent).
import { rs } from '@rstest/core';

export const access = rs.fn();
export const appendFile = rs.fn();
export const copyFile = rs.fn();
export const cp = rs.fn();
export const lstat = rs.fn();
export const mkdir = rs.fn();
export const open = rs.fn();
export const readdir = rs.fn();
export const readFile = rs.fn();
export const readlink = rs.fn();
export const realpath = rs.fn();
export const rename = rs.fn();
export const rm = rs.fn();
export const rmdir = rs.fn();
export const stat = rs.fn();
export const unlink = rs.fn();
export const writeFile = rs.fn();

export default {
  access,
  appendFile,
  copyFile,
  cp,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
};
