let keyIndex = 0;

export function getFinnhubKeys() {
  const keysCsv = process.env.FINNHUB_API_KEYS ?? "";
  const fromCsv = keysCsv
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  if (fromCsv.length > 0) {
    return fromCsv;
  }

  const singleKey = (process.env.FINNHUB_API_KEY ?? "").trim();
  return singleKey ? [singleKey] : [];
}

export function nextFinnhubKey() {
  const keys = getFinnhubKeys();
  if (keys.length === 0) {
    return null;
  }
  const key = keys[keyIndex % keys.length];
  keyIndex += 1;
  return key;
}
