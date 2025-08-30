export const minToMs = (m) => Math.max(1, Number(m) || 0) * 60 * 1000;

export const msToClock = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};
