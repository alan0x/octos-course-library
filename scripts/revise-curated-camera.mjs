import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildCoursePack, validateCoursePackDirectory } from "../packages/course-pack/dist/src/index.js";

function argumentsByName(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Expected --name value, received ${key ?? "<end>"}`);
    }
    result[key.slice(2)] = value;
  }
  for (const key of ["authoring", "plan", "source", "output", "archive", "version", "player-root"]) {
    if (!result[key]) throw new Error(`Missing --${key}`);
  }
  return result;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function narratedBeats(events) {
  return events.flatMap((event) => event.event === "lesson.step"
    ? event.step.beats.flatMap((beat) => beat.narration?.text?.trim()
      ? [{ id: beat.id, text: beat.narration.text.trim() }]
      : [])
    : []);
}

function applyCameraPlan(sourceAuthoring, plan) {
  const authoring = structuredClone(sourceAuthoring);
  const listed = new Set(Object.keys(plan.focus));
  const discovered = new Set();
  const created = new Set();
  const changes = [];
  for (const step of authoring.steps) {
    for (const beat of step.beats) {
      const key = `${step.key}/${beat.key}`;
      const decision = plan.focus[key];
      const reviewedTargets = [];
      const actionCount = beat.actions.length;
      beat.actions = beat.actions.flatMap((action) => {
        if (action.do === "write") {
          assert.ok(!created.has(action.as), `Duplicate board alias ${action.as}`);
          created.add(action.as);
        }
        if (action.do !== "focus") return [action];
        assert.ok(listed.has(key), `${key} has an unreviewed focus action`);
        assert.ok(!discovered.has(key), `${key} has multiple focus actions`);
        discovered.add(key);
        const before = [...action.targets];
        if (decision === null) {
          changes.push({ beat: key, before, after: [] });
          // Authoring Profile requires a non-empty action list. Preserve a
          // narration-only Beat as a neutral teacher expression, which has no
          // board or camera effect, instead of reintroducing an unwanted focus.
          return actionCount === 1
            ? [{ do: "expression", expression: "neutral", when: action.when }]
            : [];
        }
        assert.ok(Array.isArray(decision?.targets) && decision.targets.length > 0,
          `${key} needs a non-empty reviewed target list`);
        reviewedTargets.push(...decision.targets);
        action.targets = [...decision.targets];
        action.when = decision.when ?? action.when;
        changes.push({ beat: key, before, after: action.targets, when: action.when });
        return [action];
      });
      for (const target of reviewedTargets) {
        assert.ok(created.has(target), `${key} focuses a card that has not been created: ${target}`);
      }
      assert.equal(discovered.has(key), listed.has(key), `${key} camera review mismatch`);
    }
  }
  assert.deepEqual([...discovered].sort(), [...listed].sort(), "Camera review must cover every focus action exactly once");
  return { authoring, changes };
}

const args = argumentsByName(process.argv.slice(2));
const source = resolve(args.source);
const output = resolve(args.output);
const archive = resolve(args.archive);
const playerRoot = resolve(args["player-root"]);
if (source === output || output.startsWith(`${source}/`)) throw new Error("Output must not overwrite source");
try {
  await stat(output);
  throw new Error(`Output already exists: ${output}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const sourceManifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
const plan = JSON.parse(await readFile(resolve(args.plan), "utf8"));
assert.equal(plan.packId, sourceManifest.packId);
assert.notEqual(args.version, sourceManifest.version, "A camera revision requires a new immutable version");
const sourceAuthoring = JSON.parse(await readFile(resolve(args.authoring), "utf8"));
const lessonId = `${plan.packId}-${args.version}`;
const sourceEvents = (await readFile(join(source, sourceManifest.entry), "utf8"))
  .split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
const { authoring, changes } = applyCameraPlan(sourceAuthoring, plan);
const reviewedAuthoringPath = resolve(output, "course.authoring.json");
await mkdir(output, { recursive: true });
await writeFile(reviewedAuthoringPath, `${JSON.stringify(authoring, null, 2)}\n`, "utf8");
const lessonPath = resolve(output, sourceManifest.entry);
execFileSync("pnpm", [
  "--dir", playerRoot,
  "oll:materialize",
  "--",
  "--authoring", reviewedAuthoringPath,
  "--output", lessonPath,
  "--lesson-id", lessonId,
  "--board-id", plan.packId,
  "--base-revision", "0",
  "--region-intent", "new_topic",
  "--region-id", `${lessonId}-region`,
], { stdio: "inherit" });
const events = (await readFile(lessonPath, "utf8"))
  .split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
const oldNarration = narratedBeats(sourceEvents);
const newNarration = narratedBeats(events);
assert.equal(newNarration.length, oldNarration.length, "Narration count changed; existing audio cannot be reused");
const sourceSegments = new Map(sourceManifest.narration.segments.map((segment) => [segment.beatId, segment]));
const narration = oldNarration.map((oldBeat, index) => {
  const nextBeat = newNarration[index];
  assert.equal(nextBeat.text, oldBeat.text, `Narration changed at beat ${index + 1}; synthesize new audio instead`);
  const segment = sourceSegments.get(oldBeat.id);
  assert.ok(segment, `Missing source audio for ${oldBeat.id}`);
  assert.equal(segment.textSha256, digest(oldBeat.text));
  return { ...segment, beatId: nextBeat.id };
});

for (const file of sourceManifest.files) {
  const destination = join(output, file.path);
  await mkdir(dirname(destination), { recursive: true });
  if (file.path !== sourceManifest.entry && file.path !== "NOTICE.txt" && file.path !== "course.authoring.json") {
    await copyFile(join(source, file.path), destination);
  }
}
const boardPath = join(output, sourceManifest.board);
const board = JSON.parse(await readFile(boardPath, "utf8"));
board.items = (board.items ?? []).filter((item) => item.kind !== "playback.camera-policy");
if (!board.items.some((item) => item.kind === "playback.course-region")) {
  board.items.push({
    id: "course-region",
    kind: "playback.course-region",
    x: 20,
    y: 20,
    reservedWidth: 1300,
  });
}
board.items.push({
  id: "reviewed-camera-policy",
  kind: "playback.camera-policy",
  policy: "explicit",
});
await writeFile(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8");
const notice = await readFile(join(source, "NOTICE.txt"), "utf8");
const stableNotice = notice
  .split(/\r?\n/u)
  .filter((line) => !line.startsWith("Camera review:"))
  .join("\n")
  .trimEnd();
await writeFile(join(output, "NOTICE.txt"), `${stableNotice}\nCamera review: ${plan.sourceCandidate}, ${args.version}; narration unchanged.\n`);
const manifest = {
  ...sourceManifest,
  version: args.version,
  narration: { ...sourceManifest.narration, segments: narration },
  licenses: sourceManifest.licenses.map((license, index) => index === 0
    ? {
        ...license,
        appliesTo: [...new Set([...license.appliesTo, "course.authoring.json"])],
      }
    : license),
  files: await Promise.all([
    ...sourceManifest.files.filter((file) => file.path !== "course.authoring.json"),
    {
      path: "course.authoring.json",
      mediaType: "application/json",
      role: "asset",
    },
  ].map(async (file) => {
    const bytes = await readFile(join(output, file.path));
    return { ...file, bytes: bytes.length, sha256: digest(bytes) };
  })),
};
await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const validation = validateCoursePackDirectory(output);
assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));
const built = buildCoursePack(output, archive);
process.stdout.write(`${JSON.stringify({
  packId: plan.packId,
  version: args.version,
  archive: built.path,
  sha256: built.sha256,
  narrationSegmentsReused: narration.length,
  focusChanges: changes,
}, null, 2)}\n`);
