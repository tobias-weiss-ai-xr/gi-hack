import { Router } from "express";
import graphRouter from "./graph.js";
import pipelineRouter from "./pipeline.js";
import aiRouter from "./ai.js";
import agentsRouter from "./agents.js";

const router = Router();

router.use("/graph", graphRouter);
router.use("/pipeline", pipelineRouter);
router.use("/ai", aiRouter);
router.use("/agents", agentsRouter);

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    data: {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
