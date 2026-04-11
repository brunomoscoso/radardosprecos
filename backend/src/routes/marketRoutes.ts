import { Router } from "express";
import {
    getMarkets,
    getMarketById,
    postMarket,
} from "../controllers/marketController";

const router = Router();

router.get("/", getMarkets);
router.get("/:id", getMarketById);
router.post("/", postMarket);

export default router;