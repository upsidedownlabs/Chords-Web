import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get `__dirname` equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the manifest object
const manifest = {
  name: "Chords",
  short_name: "Chords",
  start_url: `${process.env.BASE_PATH}/`,
  display: "standalone",
  icons: [
    { src: `${process.env.BASE_PATH}/chords-logo-192x192.png`, sizes: "192x192", type: "image/png" },
    { src: `${process.env.BASE_PATH}/chords-logo-512x512.png`, sizes: "512x512", type: "image/png" },
  ],
  screenshots: [
    { src: `${process.env.BASE_PATH}/screenshot-chords.png`, sizes: "1280x720", type: "image/png", form_factor: "wide" },
  ],
};

// Generate `manifest.json` in the `public/` directory
const outputPath = path.join(__dirname, "../public/manifest.json");
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));



