#!/usr/bin/env node
// Replays every course in courses/ with the headless OLL player and prints a
// digest of each lesson's checkpoints and final state.
//
//   node scripts/replay-courses.mjs            compare with courses/replay-digests.json
//   node scripts/replay-courses.mjs --record   rewrite courses/replay-digests.json
//   node scripts/replay-courses.mjs --player <dir of another OLL install>
//
// The digests change only when playback changes, so an OLL upgrade that leaves
// them alone replays every published course exactly as before.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const record = args.includes("--record");
const playerDir = args.includes("--player") ? resolve(args[args.indexOf("--player") + 1]) : undefined;
const playerUrl = playerDir
  ? pathToFileURL(resolve(playerDir, "dist/packages/player-core/src/index.js")).href
  : pathToFileURL(createRequire(resolve(root, "package.json")).resolve("octos-lesson-language/player")).href;
const { HeadlessLessonPlayer } = await import(playerUrl);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
const digest = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 16);

const digests = {};
for (const entry of (await readdir(resolve(root, "courses"), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  let text;
  try {
    text = await readFile(resolve(root, "courses", entry.name, "course.oll.jsonl"), "utf8");
  } catch {
    continue;
  }
  const events = text.trim().split("\n").map((line) => JSON.parse(line));
  const player = new HeadlessLessonPlayer(events);
  const frames = createHash("sha256");
  let operations = 0;
  while (player.status !== "completed") {
    const frame = player.advance();
    operations += 1;
    if (frame.operation.type === "action.apply") frames.update(JSON.stringify(stable(player.checkpoint())));
  }
  digests[entry.name] = { operations, checkpoints: frames.digest("hex").slice(0, 16), final_state: digest(player.finalState()) };
}

const file = resolve(root, "courses/replay-digests.json");
if (record) {
  await writeFile(file, `${JSON.stringify(digests, null, 2)}\n`);
  console.log(`recorded ${Object.keys(digests).length} courses`);
} else {
  const expected = JSON.parse(await readFile(file, "utf8"));
  const names = [...new Set([...Object.keys(expected), ...Object.keys(digests)])].sort();
  const changed = names.filter((name) => JSON.stringify(expected[name]) !== JSON.stringify(digests[name]));
  for (const name of names) console.log(`${changed.includes(name) ? "CHANGED" : "same   "} ${name}`);
  if (changed.length) {
    console.error(`${changed.length} of ${names.length} courses replay differently`);
    process.exit(1);
  }
  console.log(`${names.length} courses replay unchanged`);
}
