export function notFoundHandler(_req, res) {
  return res.status(404).json({ error: "Route not found" });
}

export function errorHandler(error, _req, res, _next) {
  const message = error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ error: message });
}
