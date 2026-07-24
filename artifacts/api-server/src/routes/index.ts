import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import botRouter from "./bot.js";
import guildsRouter from "./guilds.js";
import commandsRouter from "./commands.js";
import warnsRouter from "./warns.js";
import devRouter from "./dev.js";
import logsRouter from "./logs.js";
import ticketsRouter from "./tickets.js";
import betaRouter from "./beta.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/bot", botRouter);
router.use("/guilds", guildsRouter);
router.use("/commands", commandsRouter);
router.use("/warns", warnsRouter);
router.use("/dev", devRouter);
router.use("/logs", logsRouter);
router.use("/tickets", ticketsRouter);
router.use("/beta", betaRouter);

export default router;
