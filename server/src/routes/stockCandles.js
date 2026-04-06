import { Router } from "express";
import { checkRateLimit } from "../middleware/rateLimit.js";
import { getStockCandles } from "../services/stockCandlesService.js";

const router = Router();

router.post("/stock-candles", checkRateLimit, async (req, res) => {
  const { symbol, period, includeIndicators } = req.body ?? {};
  const data = await getStockCandles({
    symbol,
    period,
    includeIndicators: Boolean(includeIndicators),
  });
  return res.json(data);
});

export default router;
