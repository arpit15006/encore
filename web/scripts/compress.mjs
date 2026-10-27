// Writes .br and .gz copies of the built text assets, so the server sends them without compressing
// on every request (Render's free CPU is small). Fonts and images are already compressed.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const TEXT = /\.(html|js|css|svg|json|txt|map)$/;
let files = 0;
let saved = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (TEXT.test(name)) {
      const data = readFileSync(path);
      if (data.length < 1024) continue;
      const br = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
      writeFileSync(`${path}.br`, br);
      writeFileSync(`${path}.gz`, gzipSync(data, { level: 9 }));
      files++;
      saved += data.length - br.length;
    }
  }
}
walk(new URL("../dist", import.meta.url).pathname);
console.log(`compressed ${files} files, ${(saved / 1024).toFixed(0)} KB smaller with brotli`);
