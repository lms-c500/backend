import multer from "multer";
import path from "path";
import fs from "fs-extra";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure the uploads directory exists
fs.ensureDirSync(UPLOADS_DIR);

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

// Multer upload middleware
export const upload = multer({ storage });
