import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceDts = path.join(rootDir, "dist", "engine-wasm", "src", "index.d.ts");
const sourceMap = path.join(rootDir, "dist", "engine-wasm", "src", "index.d.ts.map");
const targetDts = path.join(rootDir, "dist", "index.d.ts");
const targetMap = path.join(rootDir, "dist", "index.d.ts.map");

if (fs.existsSync(sourceDts)) {
  fs.mkdirSync(path.dirname(targetDts), { recursive: true });
  fs.copyFileSync(sourceDts, targetDts);
}
if (fs.existsSync(sourceMap)) {
  fs.mkdirSync(path.dirname(targetMap), { recursive: true });
  fs.copyFileSync(sourceMap, targetMap);
}
