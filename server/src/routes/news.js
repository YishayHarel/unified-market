import { Router } from "express";
import { checkRateLimit } from "../middleware/rateLimit.js";
import { getNews } from "../services/newsService.js";

const router = Router();

router.post("/news", checkRateLimit, async (req, res) => {
  const payload = req.body ?? {};
  const data = await getNews({
    symbol: payload.symbol,
    pageSize: payload.pageSize,
  });
  return res.json(data);
});

export default router;
