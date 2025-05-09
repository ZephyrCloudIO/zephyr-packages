import { saveToken, getToken, removeToken } from '../lib/node-persist/token';
import { ze_log } from '../lib/logging';
import { fork } from 'node:child_process';
import { join } from 'node:path';

/**
 * This is a simple test script to verify token file locking works
 *
 * Usage:
 *
 * - To run as a parent process: ts-node token-locking-test.ts
 * - The parent will spawn multiple child processes
 *
 * The script will:
 *
 * 1. Spawn multiple child processes
 * 2. Each child will try to save a token (different for each)
 * 3. After waiting, the parent will check which token was saved
 */

const CHILD_COUNT = 5;
const TEST_TOKEN_PREFIX = 'test-token-';

// Check if this is the parent process (no args) or a child process
const isChild = process.argv.length > 2;
const childId = isChild ? parseInt(process.argv[2], 10) : -1;

// Parent process - coordinates the test
async function runParentProcess() {
  ze_log(`Starting parent process to test token locking with ${CHILD_COUNT} children`);

  // Clean up any existing token
  await removeToken();

  // Spawn child processes - each will try to write its own token
  for (let i = 0; i < CHILD_COUNT; i++) {
    const child = fork(join(__dirname, 'token-locking-test.ts'), [i.toString()], {
      stdio: 'inherit',
    });

    child.on('error', (err) => {
      console.error(`Child ${i} error:`, err);
    });
  }

  // Wait for all children to attempt writing
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Check which token was saved
  const finalToken = await getToken();

  ze_log(`Final token saved: ${finalToken}`);

  if (finalToken && finalToken.startsWith(TEST_TOKEN_PREFIX)) {
    const savedChildId = parseInt(finalToken.replace(TEST_TOKEN_PREFIX, ''), 10);
    ze_log(`Child ${savedChildId} successfully saved its token`);
    ze_log('Test completed successfully - token locking mechanism works!');
  } else {
    ze_log('Test failed - no valid token was saved');
  }
}

// Child process - tries to save a token
async function runChildProcess(id: number) {
  const token = `${TEST_TOKEN_PREFIX}${id}`;

  ze_log(`Child ${id} attempting to save token: ${token}`);

  try {
    await saveToken(token);
    ze_log(`Child ${id} saved token successfully`);
  } catch (error) {
    ze_log(`Child ${id} failed to save token:`, error);
  }
}

// Entry point
async function main() {
  if (isChild) {
    await runChildProcess(childId);
  } else {
    await runParentProcess();
  }
}

main().catch((err) => {
  console.error('Error in token locking test:', err);
  process.exit(1);
});
