import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot";
import guildsRouter from "./guilds";
import commandsRouter from "./commands";
import warnsRouter from "./warns";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/bot", botRouter);
router.use("/guilds", guildsRouter);
router.use("/commands", commandsRouter);
router.use("/warns", warnsRouter);

export default router;
