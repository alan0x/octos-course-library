import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCoursePackDirectory } from "../packages/course-pack/dist/src/index.js";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function lesson(root) {
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  const events = (await readFile(resolve(root, manifest.entry), "utf8"))
    .split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  return { manifest, events };
}

function focuses(events) {
  const result = new Map();
  for (const event of events) {
    if (event.event !== "lesson.step") continue;
    for (const beat of event.step.beats) {
      const key = `${event.step.id.split(":step:")[1]}/${beat.id.split(":beat:")[1]}`;
      for (const phase of ["before_speech", "during_speech", "after_speech"]) {
        for (const action of beat.stage[phase]) {
          if (action.op !== "board.focus") continue;
          assert.ok(!result.has(key), `Multiple camera targets in ${key}`);
          result.set(key, { targets: action.focus.targets, phase });
        }
      }
    }
  }
  return result;
}

const version = process.argv[2] ?? "0.1.4";

for (const [packId, planName] of [
  ["rectangle-area-from-tiles", "rectangle-area-explicit-camera-plan.json"],
  ["slope-and-intercept", "slope-and-intercept-explicit-camera-plan.json"],
]) {
  const originalRoot = resolve("courses", packId);
  const revisedRoot = resolve("courses/revisions", packId, version);
  const plan = JSON.parse(await readFile(resolve("authoring/reviews", planName), "utf8"));
  const original = await lesson(originalRoot);
  const revised = await lesson(revisedRoot);
  assert.equal(revised.manifest.packId, packId);
  assert.equal(revised.manifest.version, version);
  assert.equal(validateCoursePackDirectory(revisedRoot).valid, true);

  const actual = focuses(revised.events);
  const originalFocus = focuses(original.events);
  for (const [key, decision] of Object.entries(plan.focus)) {
    const expected = decision === null
      ? undefined
      : {
          targets: decision.targets.map((alias) => `${packId}-${version}:node:${alias}`),
          phase: decision.when ?? originalFocus.get(key)?.phase,
        };
    assert.deepEqual(actual.get(key), expected, `${packId} ${key} camera plan mismatch`);
  }
  assert.equal(actual.size, Object.values(plan.focus).filter(Boolean).length);
  assert.equal(revised.manifest.narration.segments.length, original.manifest.narration.segments.length);
  for (const [index, segment] of revised.manifest.narration.segments.entries()) {
    const prior = original.manifest.narration.segments[index];
    assert.equal(segment.textSha256, prior.textSha256, `Narration changed at ${packId} segment ${index}`);
    assert.equal(segment.file, prior.file);
    const [oldAudio, newAudio] = await Promise.all([
      readFile(resolve(originalRoot, prior.file)),
      readFile(resolve(revisedRoot, segment.file)),
    ]);
    assert.equal(sha256(newAudio), sha256(oldAudio), `Audio changed at ${packId} segment ${index}`);
  }
  process.stdout.write(`${packId}: ${originalFocus.size} -> ${actual.size} explicit focus actions; ${revised.manifest.narration.segments.length} audio segments unchanged\n`);
}
