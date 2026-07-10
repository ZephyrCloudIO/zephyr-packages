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

    const onResolved = (content: string): void => {
      clearTimeout(timeout);
      resolve(content);
    };
    const timeout = setTimeout(() => {
      _index_html_emitted.removeListener(_event_name, onResolved);
      reject(new Error('Timed out waiting for index HTML to be resolved'));
    }, 60_000);

    _index_html_emitted.once(_event_name, onResolved);
  });
}
