import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { unzipSync, zipSync } from "fflate";
import {
  CoursePackLoadError,
  coursePackFileBlob,
  loadCoursePackArchive,
} from "../src/browser.js";

const fixtureArchive = join(
  process.cwd(),
  "fixtures/contract-smoke-0.0.1.ocpack",
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
