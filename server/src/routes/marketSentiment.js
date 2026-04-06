import { Router } from "express";
import { checkRateLimit } from "../middleware/rateLimit.js";
import { getMarketSentiment } from "../services/marketSentimentService.js";

const router = Router();

router.post("/market-sentiment", checkRateLimit, async (_req, res) => {
  const data = await getMarketSentiment();
  return res.json(data);
});

export default router;
