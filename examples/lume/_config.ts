import lume from 'lume/mod.ts';
import { withZephyr } from 'lume-plugin-zephyr';

const site = lume();

site.use(withZephyr());

export default site;
