import crypto from "crypto";
import fs from "fs";

/**
 * Extracts metadata from a given file.
 * Computes MD5, SHA256 hashes, and retrieves file size.
 *
 * @param {string} filePath - The absolute path of the file.
 * @returns {Promise<Object>} - Metadata including hashes and file size.
 */
export async function extractMetadata(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) return reject(`Error accessing file: ${filePath}`);

      const fileStream = fs.createReadStream(filePath);
      const md5 = crypto.createHash("md5");
      const sha256 = crypto.createHash("sha256");

      fileStream.on("data", (chunk) => {
        md5.update(chunk);
        sha256.update(chunk);
      });

      fileStream.on("end", () => {
        resolve({
          filePath,
          fileSize: stats.size,
          md5: md5.digest("hex"),
          sha256: sha256.digest("hex"),
        });
      });

      fileStream.on("error", (error) =>
        reject(`Error reading file: ${filePath}, ${error}`)
      );
    });
  });
}

/**
 * Simulates scanning a file for malware.
 * Calls an AI-based scanning API (to be implemented separately).
 *
 * @param {string} filePath - The absolute path of the file.
 * @returns {Promise<Object>} - Scanning result (malware status, type, confidence).
 */
export async function scanFile(filePath) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate scanning with AI model - replace with real API call later
      const isMalware = Math.random() < 0.3; // 30% chance of malware
      const malwareType = isMalware ? "Trojan" : null;
      const confidence = isMalware ? Math.floor(Math.random() * 40) + 60 : 100; // 60-100% if malware, otherwise 100%

      resolve({
        filePath,
        isMalware,
        malwareType,
        confidence,
      });
    }, 2000); // Simulated scan time
  });
}
