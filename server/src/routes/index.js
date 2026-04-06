import { Router } from "express";
import stockPricesRouter from "./stockPrices.js";
import newsRouter from "./news.js";
import stockCandlesRouter from "./stockCandles.js";
import stockFundamentalsRouter from "./stockFundamentals.js";
import marketSentimentRouter from "./marketSentiment.js";

const router = Router();

router.use(stockPricesRouter);
router.use(newsRouter);
router.use(stockCandlesRouter);
router.use(stockFundamentalsRouter);
router.use(marketSentimentRouter);

export default router;
