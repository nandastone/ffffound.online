// Push real image bytes from F:\ffffound\out\images\<key> into the LOCAL
// R2 bucket under the same key. Reads keys from the seed-real.sql we just
// generated.
//
// Usage: node ./seed/seed-r2-real.mjs ../out/images ./seed/seed-real.sql

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const exec = promisify(execFile);

const [imagesRoot, seedSql] = process.argv.slice(2);
if (!imagesRoot || !seedSql) {
  console.error("Usage: node seed-r2-real.mjs <images-root> <seed.sql>");
  process.exit(2);
}

const sql = readFileSync(seedSql, "utf-8");
// Pull out r2_key values from the INSERT INTO images statements.
// Format: INSERT INTO images (..., r2_key, ...) VALUES (..., '12/abc.jpg', ...);
const keys = new Set();
const rx = /INSERT INTO images[^;]*?'([0-9a-f]{2}\/[0-9a-f]{40,64}\.(?:jpe?g|png|gif|webp))'/gi;
for (const m of sql.matchAll(rx)) keys.add(m[1]);

console.log(`found ${keys.size} unique r2_keys in seed`);
const BUCKET = "ffffound-images";

let ok = 0, missing = 0, err = 0;
for (const key of keys) {
  const local = resolve(imagesRoot, key);
  if (!existsSync(local)) {
    missing++;
    continue;
  }
  try {
    process.stdout.write(`r2 put ${key} ... `);
    await exec(
      "npx",
      ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", local, "--local", "--content-type", contentType(key)],
      { shell: true }
    );
    console.log("ok");
    ok++;
  } catch (e) {
    console.log("ERR", e.message?.split("\n")[0] ?? e);
    err++;
  }
}

console.log(`\nresult: ${ok} ok, ${missing} missing locally, ${err} errors`);

function contentType(key) {
  const ext = key.toLowerCase().slice(key.lastIndexOf("."));
  return ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" })[ext] ?? "application/octet-stream";
}
