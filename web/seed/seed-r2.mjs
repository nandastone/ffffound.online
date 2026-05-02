// Pushes a tiny placeholder JPEG into the *local* R2 bucket under each
// r2_key referenced in seed.sql. Run after `npm run db:seed:local`.
//
// Uses `wrangler r2 object put --local` under the hood — there is no Node API
// for the local emulator, but shelling out is fine for ~24 small writes.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const exec = promisify(execFile);

// 1×1 JPEG (smallest valid JPEG, ~125 bytes), base64-encoded.
const PIXEL_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB" +
  "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEB" +
  "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIA" +
  "AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEB" +
  "AAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z";
const pixel = Buffer.from(PIXEL_B64, "base64");

const KEYS = Array.from({ length: 12 }, (_, i) => `fake/${1001 + i}.jpg`);
const BUCKET = "ffffound-images";

const tmp = mkdtempSync(join(tmpdir(), "ffseed-"));
const pixelPath = join(tmp, "pixel.jpg");
writeFileSync(pixelPath, pixel);

try {
  for (const key of KEYS) {
    process.stdout.write(`r2 put ${key} … `);
    await exec(
      "npx",
      ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", pixelPath, "--local", "--content-type", "image/jpeg"],
      { shell: true }
    );
    console.log("ok");
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
