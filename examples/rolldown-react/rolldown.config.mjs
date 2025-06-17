import { defineConfig } from 'rolldown';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  input: {
    main: 'src/main.tsx',
  },
  plugins: [withZephyr()],
});
