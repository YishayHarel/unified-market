import { Router } from "express";
import { checkRateLimit } from "../middleware/rateLimit.js";
import { getStockFundamentals } from "../services/stockFundamentalsService.js";

const router = Router();

router.post("/stock-fundamentals", checkRateLimit, async (req, res) => {
  const { symbol } = req.body ?? {};
  const data = await getStockFundamentals(symbol);
  return res.json(data);
});

export default router;
