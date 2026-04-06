export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const { method, originalUrl } = req;
  console.log(`[api] ${method} ${originalUrl} started`);

  res.on("finish", () => {
    const elapsed = Date.now() - startedAt;
    console.log(`[api] ${method} ${originalUrl} -> ${res.statusCode} (${elapsed}ms)`);
  });

  next();
}
