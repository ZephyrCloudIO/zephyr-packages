const units = [
  ['day', 24 * 60 * 60 * 1000, 23.5 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000, 59.5 * 60 * 1000],
  ['minute', 60 * 1000, 59.5 * 1000],
  ['second', 1000, 500],
  ['millisecond', 1, 0],
];

export default (date) => {
  if (!date) return '';

  const elapsed = Date.now() - new Date(date).getTime();
  const [unit, duration] =
    units.find(([, , threshold]) => Math.abs(elapsed) >= threshold) ?? units.at(-1);
  const value = Math.round(elapsed / duration);

  return `${value} ${unit}${value === 1 ? '' : 's'}`;
};
