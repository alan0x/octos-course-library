import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { unzipSync, zipSync } from "fflate";
import { assertDeclarationPlayable } from "octos-lesson-language";
import {
  CoursePackLoadError,
  coursePackFileBlob,
  loadCoursePackArchive,
} from "../src/browser.js";

const fixtureArchive = join(
  process.cwd(),
  "fixtures/contract-smoke-0.0.2.ocpack",
);

test("browser reader verifies and opens the packaged fixture", async () => {
  const pack = await loadCoursePackArchive(readFileSync(fixtureArchive));

  assert.equal(pack.manifest.packId, "contract-smoke");
  assert.equal(pack.events.length, 3);
  assert.equal(pack.board.boardId, "contract-smoke");
  assert.equal(pack.archiveSha256.length, 64);
  const narration = coursePackFileBlob(pack, "audio/intro.mp3");
  assert.equal(narration?.type, "audio/mpeg");
  assert.ok((narration?.size ?? 0) > 1_000);
});

test("browser reader opens a physics pack (subject plan P2 physics pilot)", async () => {
  const pack = await loadCoursePackArchive(readFileSync(join(process.cwd(), "fixtures/physics-smoke-0.0.1.ocpack")));
  assert.equal(pack.manifest.subject, "physics");
  assert.deepEqual(pack.events.map((event) => event.event), ["lesson.open", "lesson.step", "lesson.close"]);
  const actions = pack.events.flatMap((event) => event.step?.beats.flatMap((beat) => Object.values(beat.stage).flat()) ?? []);
  assert.deepEqual(actions.filter((action) => action.op === "board.create").map((action) => action.node?.kind), ["geometry", "plot"]);
  assert.equal(pack.manifest.minimumPlayerVersion, "0.2.0");
});

test("browser reader opens a number line pack, which needs the math plugin (OLL decision 0013)", async () => {
  const pack = await loadCoursePackArchive(readFileSync(join(process.cwd(), "fixtures/number-line-smoke-0.0.1.ocpack")));
  assert.ok(pack.manifest.requiredCapabilities?.includes("plugin:math/number-line@1"));
  const kinds = pack.events.flatMap((event) => event.step?.beats.flatMap((beat) => Object.values(beat.stage).flat()) ?? [])
    .flatMap((action) => action.node ? [action.node.kind] : []);
  assert.deepEqual(kinds, ["number_line"]);
  // A player without the math plugin refuses the pack from its declaration, before reading any lesson event.
  assert.throws(() => assertDeclarationPlayable(pack.manifest, undefined, { firstParty: false }), /requires the 'math' plugin/);
  assert.doesNotThrow(() => assertDeclarationPlayable(pack.manifest));
});

test("browser reader rejects modified payload bytes", async () => {
  const files = unzipSync(readFileSync(fixtureArchive));
  const lesson = files["course.oll.jsonl"]!;
  lesson[0] = (lesson[0] ?? 0) ^ 1;
  const modified = zipSync(files);

  await assert.rejects(
    () => loadCoursePackArchive(modified),
    (error: unknown) => error instanceof CoursePackLoadError
      && error.issues.some((entry) => entry.code === "PACK_FILE_DIGEST_MISMATCH"),
  );
});
