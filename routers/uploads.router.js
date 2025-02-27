import express from "express";
import { upload } from "./uploads.middleware.js";
import { createSession } from "../services/scanning.service.js";

const uploadRouter = express.Router();

// Upload Single File
uploadRouter.post("/files", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileSizeLimitMB = process.env.FILE_SIZE_LIMIT_MB || 10; // Default to 10MB if not set
  const fileSizeLimitBytes = fileSizeLimitMB * 1024 * 1024;

  if (req.file.size > fileSizeLimitBytes) {
    return res
      .status(400)
      .json({ error: `File size exceeds limit of ${fileSizeLimitMB} MB` });
  }

  const fileInfo = {
    fileName: req.file.originalname,
    filePath: req.file.path,
    size: req.file.size,
  };

  // Create session & trigger scanning in the background
  const session = await createSession([fileInfo], "file");

  res.json({ message: "File uploaded!", sessionId: session.sessionId });
});

// Upload Folder (Multiple Files)
uploadRouter.post("/folders", upload.array("folder"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }
  const folderSizeLimitMB = process.env.FILE_SIZE_LIMIT_MB || 10; // Default to 10MB if not set
  const folderSizeLimitBytes = folderSizeLimitMB * 1024 * 1024;
  const folderSize = Array.from(req.files)
    .map((f) => f.size)
    .reduce((folderSize, fileSize) => folderSize + fileSize, 0);
  if (folderSize > folderSizeLimitBytes) {
    return res.status(400).json({
      error: `Folder size exceeds limit of ${folderSizeLimitMB} MB`,
    });
  }

  const fileInfos = req.files.map((file) => ({
    fileName: file.originalname,
    filePath: file.path,
    size: file.size,
  }));

  // Create session & trigger scanning in the background
  const session = await createSession(fileInfos, "folder");

  res.json({ message: "Folder uploaded!", sessionId: session.sessionId });
});

export { uploadRouter };
