import crossSpawn from 'cross-spawn';

function commandError(executable, args, result) {
  const error = new Error(
    `Command failed${result.signal ? ` with signal ${result.signal}` : ` with exit code ${result.status}`}: ${executable} ${args.join(' ')}`
  );
  Object.assign(error, result, {
    code: result.status,
    path: executable,
    spawnargs: args,
  });
  return error;
}

export function spawnCommand(executable, args, options) {
  // This resolves npm.cmd/pnpm.cmd on Windows without Node's unsupported direct .cmd spawn
  // or the argument-injection risk of shell: true.
  return crossSpawn(executable, args, options);
}

export function execCommandSync(executable, args, options = {}) {
  const result = crossSpawn.sync(executable, args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) throw commandError(executable, args, result);
  return result.stdout;
}

export function execCommand(executable, args, options = {}) {
  const { encoding = 'utf8', maxBuffer = 1024 * 1024, timeout, ...spawnOptions } = options;

  return new Promise((resolve, reject) => {
    const child = crossSpawn(executable, args, {
      ...spawnOptions,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let pendingError;
    let settled = false;
    let timer;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(value);
    };
    const stopWith = (error) => {
      if (pendingError) return;
      pendingError = error;
      child.kill();
    };
    const collect = (chunks, streamName) => (chunk) => {
      const nextBytes =
        streamName === 'stdout' ? stdoutBytes + chunk.length : stderrBytes + chunk.length;
      if (nextBytes > maxBuffer) {
        const error = new Error(`${streamName} exceeded maxBuffer`);
        error.code = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
        stopWith(error);
        return;
      }
      chunks.push(chunk);
      if (streamName === 'stdout') stdoutBytes = nextBytes;
      else stderrBytes = nextBytes;
    };

    child.stdout.on('data', collect(stdout, 'stdout'));
    child.stderr.on('data', collect(stderr, 'stderr'));
    child.once('error', (error) => finish(reject, error));
    child.once('close', (status, signal) => {
      const result = {
        status,
        signal,
        stdout: Buffer.concat(stdout).toString(encoding),
        stderr: Buffer.concat(stderr).toString(encoding),
      };
      if (pendingError) {
        Object.assign(pendingError, result);
        finish(reject, pendingError);
      } else if (status !== 0) {
        finish(reject, commandError(executable, args, result));
      } else {
        finish(resolve, result);
      }
    });

    if (timeout) {
      timer = setTimeout(() => {
        const error = new Error(`Command timed out after ${timeout}ms`);
        error.code = 'ETIMEDOUT';
        stopWith(error);
      }, timeout);
    }
  });
}
