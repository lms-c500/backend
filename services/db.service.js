/**
 * In-memory storage, for testing only. Data is reset on app restarts.
 */

/**
 * A Map to store session data.
 * @type {Map<string, import("./sessions.service.js").Session>}
 */
const sessions = new Map();

/**
 * Saves a new session to the in-memory store.
 * @param {import("./sessions.service.js").Session} session - The session object to save.
 * @returns {Promise<void>}
 */
export async function saveSession(session) {
  sessions.set(session.sessionId, session);
}

/**
 * Updates a specific file's status in a session.
 * @param {string} sessionId - The session ID.
 * @param {FileResult} file - The file object to update.
 * @returns {Promise<void>}
 */
export async function saveFileResult(sessionId, file) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`NOTFOUND: Session ${sessionId} not found`);

  const fileIndex = session.files.findIndex(
    (f) => f.fileName === file.fileName
  );
  if (fileIndex === -1)
    throw new Error(
      `NOTFOUND: File ${file.fileName} not found in session ${sessionId}`
    );

  session.files[fileIndex] = { ...session.files[fileIndex], ...file };
  sessions.set(sessionId, session);
}

/**
 * Retrieves a session by ID.
 * @param {string} sessionId - The session ID.
 * @returns {Promise<import("./sessions.service.js").Session|null>} - The session object or null if not found.
 */
export async function getSession(sessionId) {
  const session = sessions.get(sessionId) || null;
  if (!session) {
    throw new Error(`NOTFOUND: Session ${sessionId} not found`);
  }
  return session;
}
