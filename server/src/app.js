import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { securityHeaders } from "./middleware/securityHeaders.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(securityHeaders);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "unified-market-server" });
  });

  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
