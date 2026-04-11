import { Router } from "express";
import {
    getPrices,
    getPricesByProductName,
    postPrice,
} from "../controllers/priceController";

const router = Router();

router.get("/", getPrices);
router.get("/product/:productName", getPricesByProductName);
router.post("/", postPrice);

export default router;