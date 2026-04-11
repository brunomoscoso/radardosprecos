import { Router } from "express";
import { comparePricesByProductName } from "../controllers/compareController";

const router = Router();

router.get("/:productName", comparePricesByProductName);

export default router;