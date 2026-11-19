// gta6-meme-x-01 entrypoint.
//
// Reads POST.json (which names the X post that is the entry), checks the
// meme image next to it, and copies both into the output directory so the
// grader can pick them up. Node 22, standard library only, no network.

import { readFileSync, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

// --- Load and validate POST.json -------------------------------------------

const postPath = join(root, "POST.json");
if (!existsSync(postPath)) {
  fail("POST.json not found in the repository root");
}

let post;
try {
  post = JSON.parse(readFileSync(postPath, "utf8"));
} catch (err) {
  fail(`POST.json is not valid JSON: ${err.message}`);
}

const url = post && post.url;
if (typeof url !== "string" || url.length === 0) {
  fail('POST.json must carry a string "url" naming the X post');
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail(`POST.json url is not a valid URL: ${url}`);
}

if (parsed.protocol !== "https:") {
  fail(`POST.json url must use https: ${url}`);
}
if (parsed.hostname !== "x.com" && parsed.hostname !== "twitter.com") {
  fail(`POST.json url host must be x.com or twitter.com: ${url}`);
}
if (!/^\/[^/]+\/status\/\d+$/.test(parsed.pathname)) {
  fail(`POST.json url is not a /<user>/status/<id> post URL: ${url}`);
}

// --- Check the meme image ---------------------------------------------------

const memePath = join(root, "meme.jpg");
if (!existsSync(memePath)) {
  fail("meme.jpg not found in the repository root");
}

const meme = readFileSync(memePath);
if (meme.length < 3 || meme[0] !== 0xff || meme[1] !== 0xd8 || meme[2] !== 0xff) {
  fail("meme.jpg does not start with the JPEG magic bytes (FF D8 FF)");
}
// A complete JPEG also ends with the end-of-image marker FF D9; its absence
// means the file was truncated.
if (meme[meme.length - 2] !== 0xff || meme[meme.length - 1] !== 0xd9) {
  fail("meme.jpg is missing the JPEG end-of-image marker (FF D9) — file looks truncated");
}

// --- Copy both files into the output directory ------------------------------

const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(process.cwd(), "output");
mkdirSync(outDir, { recursive: true });

// Clear only the contents: the grader mounts this directory, so it must
// never be removed itself.
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true });
}

copyFileSync(memePath, join(outDir, "meme.jpg"));
copyFileSync(postPath, join(outDir, "POST.json"));

// Verify the copies landed whole before reporting success.
const size = statSync(memePath).size;
if (statSync(join(outDir, "meme.jpg")).size !== size) {
  fail("copied meme.jpg size does not match the source — copy failed");
}
console.log(`gta6-meme-x-01: post ${url} — meme.jpg (${size} bytes) and POST.json copied to ${outDir}`);
