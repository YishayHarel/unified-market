import "dotenv/config";
import cors from "cors";
import express from "express";
import stockPricesRouter from "./routes/stockPrices.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((value) => value.trim()) || true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "unified-market-server" });
});

app.use("/api", stockPricesRouter);

app.listen(port, () => {
  console.log(`UnifiedMarket backend listening on http://localhost:${port}`);
});
