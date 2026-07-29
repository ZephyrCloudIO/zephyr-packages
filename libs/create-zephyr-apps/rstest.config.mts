import path from 'node:path';
import { createProjectConfig } from '../../rstest.project.mts';

export default createProjectConfig({
  name: 'create-zephyr-apps',
  root: path.join(import.meta.dirname),
});
