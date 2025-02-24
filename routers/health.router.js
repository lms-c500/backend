import { Router } from "express";

const healthRouter = Router({ mergeParams: true });

healthRouter.get("/", (_, res) => {
  res.json({ status: "UP" });
});

export { healthRouter };
