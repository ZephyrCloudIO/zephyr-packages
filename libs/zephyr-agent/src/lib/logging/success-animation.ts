import { brightBlueBgName } from './debug';
import { isTTY, purple } from './picocolor';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPIN_INTERVAL_MS = 100;
const SPIN_DURATION_MS = 900;
const SUCCESS_HOLD_MS = 250;

const hideCursor = () => process.stdout.write('\u001B[?25l');
const showCursor = () => process.stdout.write('\u001B[?25h');
const clearLine = () => process.stdout.write('\u001B[2K\r');

export async function showSuccessAnimation(message = 'Build complete!'): Promise<void> {
  if (!isTTY || !process.stdout.isTTY) {
    return;
  }

  return new Promise((resolve) => {
    let frameIndex = 0;
    let timeout: NodeJS.Timeout | null = null;
    const formatLine = (symbol: string) =>
      `${brightBlueBgName}  ${purple(symbol)} ${purple(message)}`;

    const stopSpinner = () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };

    const interval = setInterval(() => {
      clearLine();
      process.stdout.write(formatLine(SPINNER_FRAMES[frameIndex]));
      frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
    }, SPIN_INTERVAL_MS);

    hideCursor();

    timeout = setTimeout(() => {
      stopSpinner();
      clearLine();
      process.stdout.write(formatLine('✓'));

      timeout = setTimeout(() => {
        process.stdout.write('\n');
        showCursor();
        resolve();
      }, SUCCESS_HOLD_MS);
    }, SPIN_DURATION_MS);
  });
}
