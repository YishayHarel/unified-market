import { Router } from "express";
import { getStockPrices } from "../services/stockPricesService.js";
import { checkRateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.post("/stock-prices", checkRateLimit, async (req, res) => {
  const { symbols } = req.body ?? {};

  if (!Array.isArray(symbols)) {
    return res.status(400).json({ error: "symbols array is required" });
  }

  const prices = await getStockPrices(symbols);
  return res.json(prices);
});

export default router;
