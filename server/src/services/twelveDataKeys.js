let keyIndex = 0;

export function getTwelveDataKeys() {
  const keysCsv = process.env.TWELVE_DATA_API_KEYS ?? "";
  const fromCsv = keysCsv
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (fromCsv.length > 0) return fromCsv;
  const single = (process.env.TWELVE_DATA_API_KEY ?? "").trim();
  return single ? [single] : [];
}

export function nextTwelveDataKey() {
  const keys = getTwelveDataKeys();
  if (keys.length === 0) return null;
  const key = keys[keyIndex % keys.length];
  keyIndex += 1;
  return key;
}
