import { EventEmitter } from "events";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";
import { getSession, saveFileResult, saveSession } from "./db.service.js";
import { checkELFFile, extractMetadata } from "./files.service.js";
import { scanFile } from "./scans.service.js";

/**
 * @typedef {Object} FileResult
 * @property {string} fileName - The name of the file
 * @property {string} filePath - The full file path
 * @property {string} relativePath - Client relative path
 * @property {number} fileSize - The file size in bytes
 * @property {string|null} md5 - MD5 hash of the file (nullable)
 * @property {string|null} sha256 - SHA-256 hash of the file (nullable)
 * @property {string} status - File processing status (pending, extracting_metadata, scanning, completed, failed)
 * @property {string|null} malwareStatus - Whether the file is malware (nullable until scan completes)
 * @property {string|null} scanDetails - Type of malware detected (nullable)
 */

/**
 * @typedef {Object} Session
 * @property {string} sessionId - Unique session identifier
 * @property {string} status - Session status (pending, in_progress, completed, partially_failed, failed)
 * @property {"quick"|"deep"} scanType - Type of scan performed (quick or deep)
 * @property {"file"|"folder"} scanTarget - Target of the scan (file or folder)
 * @property {FileResult[]} files - List of files being processed
 * @property {number} createdAt - Timestamp when the session was created
 * @property {number} updatedAt - Timestamp when the session was last updated
 */

/**
 * Creates a new session and stores it in memory.
 * @param {string[]} filePaths - Array of file paths uploaded
 * @param {"quick"|"deep"} [scanType="quick"] - Type of scan to perform (quick or deep)
 * @param {"file"|"folder"} [scanTarget="file"] - Target of the scan (file or folder)
 * @returns {Promise<Session>} Created session object
 */
export const createSession = async (
  filePaths,
  scanTarget = "file",
  scanType = "quick"
) => {
  const sessionId = uuidv4();
  const now = new Date().getTime();
  const session = {
    sessionId,
    status: "pending",
    scanType, // quick or deep
    scanTarget, // file or folder
    createdAt: now,
    updatedAt: now,
    files: filePaths.map((f) => ({
      fileName: f.fileName,
      filePath: f.filePath,
      fileSize: f.fileSize,
      relativePath: f.relativePath,
      md5: null,
      sha256: null,
      status: "pending",
      malwareStatus: null,
      scanDetails: null,
    })),
  };

  await saveSession(session);
  // Emit session update
  emitSessionUpdate(sessionId, session);

  setTimeout(() => {
    processSession(sessionId);
  }, 5_000);
  return session;
};

/**
 * Processes each file in a session, extracting metadata and performing a scan.
 * Updates session status accordingly.
 * @param {string} sessionId - Unique session identifier
 */
export const processSession = async (sessionId) => {
  const session = await getSession(sessionId);
  if (!session) {
    console.error(`Session ${sessionId} not found.`);
    return;
  }

  session.status = "in_progress";
  updateSession(sessionId, session);

  const hasFailedFiles = await Promise.allSettled(
    session.files.map((file) => processSingleFile(sessionId, file))
  ).then((results) => results.some((result) => !!result));

  // Final session status determination
  if (session.files.every((file) => file.status === "completed")) {
    session.status = "completed";
  } else if (hasFailedFiles) {
    session.status = "partially_failed";
  } else {
    session.status = "failed";
  }

  updateSession(sessionId, session);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // Adding delay

/**
 * Processes an individual file: extracts metadata and performs a malware scan.
 * @param {string} sessionId - The session ID
 * @param {FileResult} file - The file object to process
 * @returns {Promise<FileResult>} Updated file result
 */
export const processFile = async (sessionId, file) => {
  try {
    file.status = "extracting_metadata";
    console.log(
      `Session ${sessionId}: Extracting metadata for file ${file.fileName}`
    );
    updateSession(sessionId, { files: [file] });

    await delay(1000);
    const [metadata, elfCheckResult] = await Promise.all([
      extractMetadata(file.filePath),
      checkELFFile(file.filePath),
    ]);
    Object.assign(file, { ...metadata, ...elfCheckResult });

    file.status = "scanning";
    console.log(`Session ${sessionId}: Scanning file ${file.fileName}`);
    updateSession(sessionId, { files: [file] });

    await delay(1000);
    const scanResult = await scanFile(file.filePath);
    Object.assign(file, scanResult);
    file.status = "completed";
    console.log(
      `Session ${sessionId}: Completed processing file ${file.fileName}`
    );
  } catch (error) {
    console.error(
      `Error processing file ${file.fileName} in session ${sessionId}:`,
      error
    );
    file.status = "failed";
  }

  saveFileResult(sessionId, file);
  return file;
};

/**
 * Processes a single file for a given session.
 *
 * @async
 * @function processSingleFile
 * @param {string} sessionId - The ID of the session.
 * @param {FileResult} file - The file object to be processed.
 * @returns {Promise<boolean>} - Returns a promise that resolves to a boolean indicating if there were any failed files.
 */
async function processSingleFile(sessionId, file) {
  const result = await processFile(sessionId, file);
  if (result.status === "failed") {
    hasFailedFiles = true;
  }
  // Delete file after processing
  try {
    await fs.unlink(file.filePath);
    console.log(`Session ${sessionId}: Deleted file ${file.fileName}`);
  } catch (error) {
    console.error(
      `Error deleting file ${file.fileName} in session ${sessionId}:`,
      error
    );
  }
  return hasFailedFiles || false;
}

const sessionUpdates = new EventEmitter();

/**
 * Subscribes to session updates.
 * @param {string} sessionId - Unique session identifier
 * @param {function} callback - Callback function to handle session updates
 */
export const subscribeToSessionUpdates = (sessionId, callback) => {
  sessionUpdates.on(sessionId, callback);
};

/**
 * Unsubscribes from session updates.
 * @param {string} sessionId - Unique session identifier
 * @param {function} callback - Callback function to remove
 */
export const unsubscribeFromSessionUpdates = (sessionId, callback) => {
  sessionUpdates.off(sessionId, callback);
};

/**
 * Emits session updates to subscribers.
 * @param {string} sessionId - Unique session identifier
 * @param {Session} session - Updated session object
 */
const emitSessionUpdate = (sessionId, session) => {
  sessionUpdates.emit(sessionId, session);
};

/**
 * Updates the session in the database and emits an update event.
 * @param {string} sessionId - Unique session identifier
 * @param {Partial<Session>} session - Updated session object
 */
export const updateSession = async (sessionId, session) => {
  const existingSession = await getSession(sessionId);
  if (!existingSession) {
    console.error(`NOTFOUND: Session ${sessionId} not found.`);
    return;
  }

  // Create a Map to track file updates (keyed by fileName)
  /** @type {Map<string, FileResult>} */
  const fileMap = new Map();

  // Add existing files to the map
  for (const file of existingSession.files) {
    fileMap.set(file.fileName, file);
  }

  // Merge with new files
  if (session.files && Array.isArray(session.files)) {
    for (const newFile of session.files) {
      const existingFile = fileMap.get(newFile.fileName);

      if (existingFile) {
        // Merge updates: prioritize new status, hashes, and malware details if present
        fileMap.set(newFile.fileName, { ...existingFile, ...newFile });
      } else {
        // New file, add it
        fileMap.set(newFile.fileName, newFile);
      }
    }
  }

  // Convert Map back to array
  existingSession.files = Array.from(fileMap.values());

  // Merge other session properties (excluding 'files' to avoid overwrite)
  Object.assign(existingSession, session, { files: existingSession.files });

  // Update the timestamp
  existingSession.updatedAt = Date.now();

  // Save the updated session
  await saveSession(existingSession);

  // Emit session update
  emitSessionUpdate(sessionId, existingSession);
};

/**
 * Retrieves a session by its ID from the database.
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<Session|null>} The session object if found, otherwise null
 */
export const getSessionById = async (sessionId) => {
  // Logic to retrieve session from storage
  return await getSession(sessionId);
};
