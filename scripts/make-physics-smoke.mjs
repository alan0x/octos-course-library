// Rebuilds the physics CoursePack test fixture (courses/physics-smoke) from
// its authoring lesson, with this repository's pinned OLL. The fixture checks
// that the CoursePack path handles a non-mathematics pack (subject plan P2,
// step 3). It is repository test data, not a published course: its narration
// reuses the contract fixture's placeholder audio, and nothing is synthesized.
//
// The lesson is compiled by the player's own pipeline (Octos Learn's
// `oll:materialize`), as materialize-course-pack.mjs does for real packs, so
// Learn's parity check accepts it.
//
//   node scripts/make-physics-smoke.mjs --player-root ../octos-learn
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateAuthoringLesson } from "octos-lesson-language";

const directory = resolve("courses/physics-smoke");
const packId = "physics-smoke";
const version = "0.0.1";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const authoring = JSON.parse(await readFile(resolve(directory, "course.authoring.json"), "utf8"));
validateAuthoringLesson(authoring);
const playerRootIndex = process.argv.indexOf("--player-root");
if (playerRootIndex < 0 || !process.argv[playerRootIndex + 1]) throw new Error("Missing required --player-root <octos-learn checkout>");
const lessonId = `${packId}-${version}`;
execFileSync("pnpm", ["--dir", resolve(process.argv[playerRootIndex + 1]), "oll:materialize", "--",
  "--authoring", resolve(directory, "course.authoring.json"), "--output", resolve(directory, "course.oll.jsonl"),
  "--report", resolve(directory, "compilation.json"), "--lesson-id", lessonId, "--board-id", packId,
  "--base-revision", "0", "--region-intent", "new_topic", "--region-id", `${lessonId}-region`], { stdio: ["ignore", "ignore", "inherit"] });
const report = JSON.parse(await readFile(resolve(directory, "compilation.json"), "utf8"));
const events = (await readFile(resolve(directory, "course.oll.jsonl"), "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
const requirements = { minimumPlayerVersion: report.minimumPlayerVersion, requiredCapabilities: report.requiredCapabilities ?? [] };

await mkdir(resolve(directory, "audio"), { recursive: true });
const beats = events.flatMap((event) => event.event === "lesson.step" ? event.step.beats : []).filter((beat) => beat.narration?.text?.trim());
const segments = [];
for (const [index, beat] of beats.entries()) {
  const file = `audio/${String(index + 1).padStart(3, "0")}.mp3`;
  await copyFile(resolve("courses/contract-smoke/audio/intro.mp3"), resolve(directory, file));
  segments.push({ beatId: beat.id, file, textSha256: sha256(Buffer.from(beat.narration.text.trim(), "utf8")), durationMs: 2146 });
}
await writeFile(resolve(directory, "board.json"), `${JSON.stringify({
  schemaVersion: 1, boardId: packId, initialViewport: { x: 0, y: 0, zoom: 1 }, studentInk: null,
  items: [{ id: "course-region", kind: "playback.course-region", x: 20, y: 20, reservedWidth: 1300 }],
}, null, 2)}\n`);
await writeFile(resolve(directory, "NOTICE.txt"), [
  "Copyright 2026 Octos Course Library contributors.",
  "",
  "This physics fixture is provided for repository testing and is not a",
  "published curriculum. Its narration reuses the contract fixture's placeholder audio.",
  "",
].join("\n"));
await writeFile(resolve(directory, "thumbnail.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#f7f2e8"/><path d="M40 60H280" stroke="#65716b" stroke-width="4" stroke-dasharray="10 8"/><circle cx="170" cy="60" r="10" fill="#e18b56"/><path d="M40 150L280 90" stroke="#167d78" stroke-width="6"/></svg>\n');

const media = { json: "application/json", jsonl: "application/x-ndjson", svg: "image/svg+xml", mp3: "audio/mpeg", txt: "text/plain" };
const roles = { "NOTICE.txt": "license", "board.json": "board", "course.oll.jsonl": "lesson", "thumbnail.svg": "thumbnail", "course.authoring.json": "asset", "compilation.json": "asset" };
const paths = ["NOTICE.txt", ...segments.map((segment) => segment.file), "board.json", "compilation.json", "course.authoring.json", "course.oll.jsonl", "thumbnail.svg"];
const files = [];
for (const path of paths) {
  const bytes = await readFile(resolve(directory, path));
  files.push({ path, sha256: sha256(bytes), bytes: bytes.length, mediaType: media[path.split(".").at(-1)], role: roles[path] ?? "narration" });
}
const manifest = {
  schemaVersion: 1, packId, version,
  title: "Physics CoursePack smoke lesson",
  description: "A minimal physics fixture: constant-speed motion with its distance–time graph.",
  locale: "en-US", subject: "physics", grade: "contract-test",
  durationSeconds: Math.ceil(segments.length * 2.146),
  minimumPlayerVersion: requirements.minimumPlayerVersion,
  ...(requirements.requiredCapabilities.length ? { requiredCapabilities: requirements.requiredCapabilities } : {}),
  compilation: report.compilation,
  entry: "course.oll.jsonl", board: "board.json", thumbnail: "thumbnail.svg",
  capabilities: { offlinePlayback: true, offlineNarration: true, interactiveWhiteboard: true, liveAi: "optional", asr: "optional", camera: "none" },
  narration: { voiceId: "contract-fixture", segments },
  files,
  licenses: [{ name: "Fixture-only repository content", attribution: "Copyright 2026 Octos Course Library contributors.", appliesTo: paths }],
};
await writeFile(resolve(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ packId, version, events: events.length, narration: segments.length, ...requirements }));
