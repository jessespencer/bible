// Reads Atlas's links.bin into src/search/links.json. Rerun when the anchors change;
// search.test.ts fails while the two disagree.
import { readFileSync, writeFileSync } from "node:fs";
import { anchorIndices } from "../src/search/anchors.ts";
import { buildLinkData } from "../src/search/linkData.ts";

const bin = readFileSync(new URL("../../atlas/public/data/links.bin", import.meta.url));
const rows = new Int16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2);
const data = buildLinkData(rows, anchorIndices);
const out = new URL("../src/search/links.json", import.meta.url);
writeFileSync(out, `${JSON.stringify(data)}\n`);
console.log(`Wrote links.json: ${(JSON.stringify(data).length / 1024).toFixed(0)} KB`);
