import cors from "cors";
import express from "express";
import { healthRouter } from "./routers/health.router.js";
// import { uploadRouter } from "./routers/uploads.router.js";
// import { sessionsRouter } from "./routers/sessions.router.js";

const app = express();
app.use(cors());
app.use(express.json());
const port = parseInt(process.env.PORT || "4200");

app.use("/health", healthRouter);
// app.use("/uploads", uploadRouter);
// app.use("/scans", sessionsRouter);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
