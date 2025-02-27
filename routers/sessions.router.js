import express from "express";
import {
  getSessionById,
  subscribeToSessionUpdates,
  unsubscribeFromSessionUpdates,
} from "../services/scanning.service.js";

const scansRouter = express.Router();

/**
 * Get the current session status
 */
scansRouter.get("/:sessionId/status", async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = await getSessionById(sessionId);
    return res.json(session);
  } catch (err) {
    if (err.message.startsWith("NOTFOUND")) {
      return res.status(404).json({ error: "Session not found" });
    } else {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * Stream session updates via SSE
 */
scansRouter.get("/:sessionId/stream", async (req, res) => {
  const sendUpdate = (update) => {
    if (update?.status) {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    }
    if (["completed", "failed", "partially_failed"].includes(update.status)) {
      res.end(); // Close the connection when session is done
    }
  };

  const { sessionId } = req.params;
  let session = null;
  try {
    session = await getSessionById(sessionId);
    if (["completed", "failed", "partially_failed"].includes(session.status)) {
      return res.json(session); // Close the connection when session is done
    }
  } catch (err) {
    if (err.message.startsWith("NOTFOUND")) {
      return res.status(404).json({ error: "Session not found" });
    } else {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  sendUpdate(session);
  subscribeToSessionUpdates(session.sessionId, sendUpdate);

  req.on("close", () => {
    console.log(`Client disconnected from SSE stream for session ${sessionId}`);
    unsubscribeFromSessionUpdates(sessionId, sendUpdate); // Unsubscribe from updates when the client disconnects
  });
});

export { scansRouter };
