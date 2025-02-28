import crypto from "crypto";
import fs from "fs/promises";

/**
 * Extracts metadata from a given file.
 * Computes MD5, SHA256 hashes, and retrieves file size.
 *
 * @param {string} filePath - The absolute path of the file.
 * @returns {Promise<Object>} - Metadata including hashes and file size.
 */
export async function extractMetadata(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const fileBuffer = await fs.readFile(filePath);

    const md5 = crypto.createHash("md5").update(fileBuffer).digest("hex");
    const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    return {
      filePath,
      fileSize: stats.size,
      md5,
      sha256,
    };
  } catch (error) {
    throw new Error(`Error processing file: ${filePath}, ${error.message}`);
  }
}

/**
 * Checks if a file is an ELF file and determines its architecture.
 *
 * @param {string} filePath - The absolute path of the file.
 * @returns {Promise<{isELF: boolean, architecture: string | null}>} - Object containing isELF (boolean) and architecture (string|null).
 */
export async function checkELFFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath, { length: 18 });

    const isELF =
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46;

    let architecture = null;
    if (isELF) {
      const archByte = buffer[18];
      if (archByte === 0x03) {
        architecture = "x86";
      } else if (archByte === 0x3e) {
        architecture = "x86_64";
      } else if (archByte === 0x28) {
        architecture = "ARM";
      } else if (archByte === 0xb7) {
        architecture = "AArch64";
      }
    }

    return {
      isELF,
      architecture,
    };
  } catch (error) {
    throw new Error(`Error reading file: ${filePath}, ${error.message}`);
  }
}


