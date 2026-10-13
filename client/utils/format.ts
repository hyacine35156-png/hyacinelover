export const formatDecimal = (value: number, decimals = 1): string => {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(decimals);
};

export const formatAccuracy = (rate: number): string => {
  if (!Number.isFinite(rate) || rate < 0) return '0%';
  const percent = rate * 100;
  if (Number.isInteger(percent)) return `${percent}%`;
  return `${percent.toFixed(1)}%`;
};

export const formatSeconds = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}秒`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r > 0 ? `${m}分${r}秒` : `${m}分钟`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}小时${m}分` : `${h}小时`;
};
