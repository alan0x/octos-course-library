// Shared pipeline for revising a curated CoursePack into a new immutable
// version: write the reviewed authoring, re-materialize the lesson through the
// player's shared materializer, reuse existing narration audio (narration text
// must be unchanged), refresh the manifest, validate and build the archive.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildCoursePack, validateCoursePackDirectory } from "../packages/course-pack/dist/src/index.js";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Lookups over an authoring document that fail loudly when the reviewed
 * content is not where an edit module expects it.
 */
export function authoringTools(authoring) {
  const beat = (key) => {
    const [stepKey, beatKey] = key.split("/");
    const found = authoring.steps.find((step) => step.key === stepKey)?.beats.find((candidate) => candidate.key === beatKey);
    assert.ok(found, `Beat ${key} not found`);
    return found;
  };
  const action = (key, predicate, label) => {
    const actions = beat(key).actions.filter(predicate);
    assert.equal(actions.length, 1, `${key}: expected exactly one ${label}`);
    return actions[0];
  };
  const task = (as) => {
    const found = authoring.lesson.tasks?.find((candidate) => candidate.as === as);
    assert.ok(found, `Task ${as} not found`);
    return found;
  };
  // Removing a beat drops its narration and audio; every other narration
  // must stay unchanged so its audio can be reused.
  const removed = [];
  const removeBeat = (key) => {
    const [stepKey] = key.split("/");
    const step = authoring.steps.find((candidate) => candidate.key === stepKey);
    const found = beat(key);
    step.beats.splice(step.beats.indexOf(found), 1);
    assert.ok(step.beats.length > 0, `${stepKey}: removing ${key} would leave an empty step`);
    removed.push(key);
    return found;
  };
  return { beat, action, task, removeBeat, removedBeats: removed };
}

function narratedBeats(events) {
  return events.flatMap((event) => event.event === "lesson.step"
    ? event.step.beats.flatMap((beat) => beat.narration?.text?.trim()
      ? [{ id: beat.id, text: beat.narration.text.trim() }]
      : [])
    : []);
}

export async function reviseCuratedCourse({ packId, authoring, source, output, archive, version, playerRoot, noticeLine, removedBeats = [] }) {
  source = resolve(source); output = resolve(output); archive = resolve(archive); playerRoot = resolve(playerRoot);
  if (source === output || output.startsWith(`${source}/`)) throw new Error("Output must not overwrite source");
  try {
    await stat(output);
    throw new Error(`Output already exists: ${output}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const sourceManifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
  assert.equal(packId, sourceManifest.packId);
  assert.notEqual(version, sourceManifest.version, "A revision requires a new immutable version");
  const lessonId = `${packId}-${version}`;
  const sourceEvents = (await readFile(join(source, sourceManifest.entry), "utf8"))
    .split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
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
    "--board-id", packId,
    "--base-revision", "0",
    "--region-intent", "new_topic",
    "--region-id", `${lessonId}-region`,
  ], { stdio: "inherit" });
  const events = (await readFile(lessonPath, "utf8"))
    .split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  // Beat keys ("section-03/moment-01") map to canonical beat IDs by suffix.
  const removedSuffixes = removedBeats.map((key) => {
    const [stepKey, beatKey] = key.split("/");
    return `:step:${stepKey}:beat:${beatKey}`;
  });
  const isRemoved = (beatId) => removedSuffixes.some((suffix) => beatId.endsWith(suffix));
  const sourceNarration = narratedBeats(sourceEvents);
  const oldNarration = sourceNarration.filter((beat) => !isRemoved(beat.id));
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

  const removedAudio = new Set(sourceNarration.filter((beat) => isRemoved(beat.id))
    .map((beat) => sourceSegments.get(beat.id)?.file).filter(Boolean));
  assert.equal(removedAudio.size, removedBeats.length, "Every removed beat must own exactly one narration clip");
  for (const file of sourceManifest.files) {
    if (removedAudio.has(file.path)) continue;
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
  await writeFile(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8");
  const notice = await readFile(join(source, "NOTICE.txt"), "utf8");
  const stableNotice = notice
    .split(/\r?\n/u)
    // Keep one line per review kind: replace an earlier line of the same kind.
    .filter((line) => !line.startsWith(`${noticeLine.split(":")[0]}:`))
    .join("\n")
    .trimEnd();
  await writeFile(join(output, "NOTICE.txt"), `${stableNotice}\n${noticeLine}\n`);
  const manifest = {
    ...sourceManifest,
    version,
    ...(removedBeats.length ? { durationSeconds: Math.ceil(narration.reduce((sum, segment) => sum + segment.durationMs, 0) / 1000) } : {}),
    narration: { ...sourceManifest.narration, segments: narration },
    licenses: sourceManifest.licenses.map((license, index) => {
      const appliesTo = license.appliesTo.filter((path) => !removedAudio.has(path));
      return index === 0
        ? { ...license, appliesTo: [...new Set([...appliesTo, "course.authoring.json"])] }
        : { ...license, appliesTo };
    }),
    files: await Promise.all([
      ...sourceManifest.files.filter((file) => file.path !== "course.authoring.json" && !removedAudio.has(file.path)),
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
  return { packId, version, archive: built.path, sha256: built.sha256, narrationSegmentsReused: narration.length };
}
