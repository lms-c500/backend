import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { getSession, saveFileResult, saveSession } from "./db.service.js";
import { extractMetadata, scanFile } from "./files.service.js";

/**
 * @typedef {Object} FileResult
 * @property {string} fileName - The name of the file
 * @property {string} filePath - The full file path
 * @property {number} fileSize - The file size in bytes
 * @property {string|null} md5 - MD5 hash of the file (nullable)
 * @property {string|null} sha256 - SHA-256 hash of the file (nullable)
 * @property {string} status - File processing status (pending, extracting_metadata, scanning, completed, failed)
 * @property {boolean|null} isMalware - Whether the file is malware (nullable until scan completes)
 * @property {string|null} malwareType - Type of malware detected (nullable)
 * @property {number|null} confidence - Confidence score of malware detection (0-100, nullable)
 */

/**
 * @typedef {Object} Session
 * @property {string} sessionId - Unique session identifier
 * @property {string} status - Session status (pending, in_progress, completed, partially_failed, failed)
 * @property {FileResult[]} files - List of files being processed
 */

/**
 * Creates a new session and stores it in memory.
 * @param {string} sessionId - Unique session identifier
 * @param {string[]} filePaths - Array of file paths uploaded
 * @returns {Promise<Session>} Created session object
 */
export const createSession = async (filePaths) => {
  const sessionId = uuidv4();
  const session = {
    sessionId,
    status: "pending",
    files: filePaths.map(({ filePath, fileName, fileSize }) => ({
      fileName: filePath.split("/").pop(),
      filePath,
      fileSize,
      md5: null,
      sha256: null,
      status: "pending",
      isMalware: null,
      malwareType: null,
      confidence: null,
    })),
  };

  await saveSession(session);
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

  let hasFailedFiles = false;
  for (const file of session.files) {
    const result = await processFile(sessionId, file);
    if (result.status === "failed") {
      hasFailedFiles = true;
    }
  }

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
    const metadata = await extractMetadata(file.filePath);
    Object.assign(file, metadata);

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
 * @param {Session} session - Updated session object
 */
export const updateSession = async (sessionId, session) => {
  const existingSession = await getSessionById(sessionId);
  if (!existingSession) {
    console.error(`NOTFOUND: Session ${sessionId} not found.`);
    return;
  }

  // Logic to update session in storage
  await saveSession(sessionId, session);

  // Emit session update
  emitSessionUpdate(sessionId, session);
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
