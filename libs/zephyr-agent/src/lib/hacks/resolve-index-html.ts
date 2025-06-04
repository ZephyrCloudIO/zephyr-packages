import { EventEmitter } from 'node:events';
import { ze_log } from '../logging';

const _index_html_emitted = new EventEmitter();

const _event_name = 'index-html-resolved';

export function resolveIndexHtml(content: string): void {
  ze_log.misc('Index HTML resolved');
  _index_html_emitted.emit(_event_name, content);
}

export async function onIndexHtmlResolved(): Promise<string> {
  return new Promise((resolve, reject) => {
    ze_log.misc('Waiting for index HTML to be resolved');
    // wait for 1 minute (just in case)
    setTimeout(reject, 60000);
    _index_html_emitted.once(_event_name, resolve);
  });
}
