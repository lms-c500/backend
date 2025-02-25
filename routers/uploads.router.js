import express from "express";
import { upload } from "./uploads.middleware.js";
import { createSession } from "../services/scanning.service.js";

const uploadRouter = express.Router();

// Upload Single File
uploadRouter.post("/files", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileInfo = {
    fileName: req.file.originalname,
    filePath: req.file.path,
    size: req.file.size,
  };

  // Create session & trigger scanning in the background
  const session = await createSession([fileInfo]);

  res.json({ message: "File uploaded!", sessionId: session.sessionId });
});

// Upload Folder (Multiple Files)
uploadRouter.post("/folders", upload.array("folder"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const fileInfos = req.files.map((file) => ({
    fileName: file.originalname,
    filePath: file.path,
    size: file.size,
  }));

  // Create session & trigger scanning in the background
  const session = await createSession(fileInfos);

  res.json({ message: "Folder uploaded!", sessionId: session.sessionId });
});

export { uploadRouter };
