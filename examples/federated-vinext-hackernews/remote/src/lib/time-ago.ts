import ms from 'ms';

const map: Record<string, string> = {
  s: 'seconds',
  ms: 'milliseconds',
  m: 'minutes',
  h: 'hours',
  d: 'days',
};

export default (date: number | Date) =>
  date ? ms(Date.now() - new Date(date).getTime()).replace(/[a-z]+/, (str) => ' ' + map[str]) : '';
