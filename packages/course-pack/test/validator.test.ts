import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { zipSync } from "fflate";
import {
  buildCoursePack,
  inspectCoursePackArchive,
  isSafeCoursePackPath,
  validateCoursePackDirectory,
} from "../src/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixture = join(repositoryRoot, "courses/contract-smoke");

function temporaryDirectory(): string {
  return mkdtempSync(join(tmpdir(), "octos-course-pack-test-"));
}

function fixtureCopy(): { root: string; pack: string } {
  const root = temporaryDirectory();
  const pack = join(root, "pack");
  cpSync(fixture, pack, { recursive: true });
  return { root, pack };
}

test("validates the repository contract fixture", () => {
  const result = validateCoursePackDirectory(fixture);
  assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
  assert.equal(result.manifest?.packId, "contract-smoke");
  assert.match(result.packSha256 ?? "", /^[a-f0-9]{64}$/u);
});

test("builds and inspects an immutable .ocpack archive", () => {
  const root = temporaryDirectory();
  try {
    const archive = join(root, "contract-smoke.ocpack");
    const built = buildCoursePack(fixture, archive);
    assert.equal(built.manifest.packId, "contract-smoke");
    assert.equal(readFileSync(archive).length, built.bytes);
    assert.match(built.sha256, /^[a-f0-9]{64}$/u);

    const inspected = inspectCoursePackArchive(archive);
    assert.equal(inspected.valid, true, JSON.stringify(inspected.issues, null, 2));
    assert.equal(inspected.manifest?.version, "0.0.2");
    assert.equal(inspected.packSha256, built.sha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("build output is reproducible", () => {
  const root = temporaryDirectory();
  try {
    const first = buildCoursePack(fixture, join(root, "first.ocpack"));
    const second = buildCoursePack(fixture, join(root, "second.ocpack"));
    assert.equal(first.sha256, second.sha256);
    assert.deepEqual(
      readFileSync(first.path),
      readFileSync(second.path),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not write an archive into its source directory", () => {
  assert.throws(
    () => buildCoursePack(fixture, join(fixture, "unsafe-output.ocpack")),
    /outside the source directory/u,
  );
});

test("rejects a payload whose bytes no longer match the manifest", () => {
  const { root, pack } = fixtureCopy();
  try {
    writeFileSync(join(pack, "board.json"), "{}\n");
    const result = validateCoursePackDirectory(pack);
    assert.equal(result.valid, false);
    assert.equal(result.issues.some((item) => item.code === "PACK_FILE_DIGEST_MISMATCH"), true);
    assert.equal(result.issues.some((item) => item.code === "PACK_BOARD_SCHEMA"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("requires local audio for every narrated beat in an offline pack", () => {
  const { root, pack } = fixtureCopy();
  try {
    const manifestPath = join(pack, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      narration: { segments: unknown[] };
    };
    manifest.narration.segments = [];
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const result = validateCoursePackDirectory(pack);
    assert.equal(result.valid, false);
    assert.equal(result.issues.some((item) => item.code === "PACK_NARRATION_MISSING"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects runtime identity and remote resources in portable board state", () => {
  const { root, pack } = fixtureCopy();
  try {
    const boardPath = join(pack, "board.json");
    const board = JSON.parse(readFileSync(boardPath, "utf8")) as {
      items: Array<Record<string, unknown>>;
    };
    board.items.push({
      id: "unsafe",
      kind: "image",
      session_id: "server-session",
      source: "https://temporary.example/image.png",
    });
    writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`);
    const result = validateCoursePackDirectory(pack);
    assert.equal(result.valid, false);
    assert.equal(result.issues.some((item) => item.code === "PACK_RUNTIME_STATE_FORBIDDEN"), true);
    assert.equal(result.issues.some((item) => item.code === "PACK_REMOTE_RUNTIME_RESOURCE"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects unsafe archive paths", () => {
  const root = temporaryDirectory();
  try {
    const archive = join(root, "unsafe.ocpack");
    writeFileSync(archive, zipSync({ "../escape.txt": Buffer.from("escape") }));
    const result = inspectCoursePackArchive(archive);
    assert.equal(result.valid, false);
    assert.equal(
      result.issues.some((item) =>
        item.code === "PACK_UNSAFE_PATH" || item.code === "PACK_ARCHIVE_INVALID"),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts only normalized relative POSIX paths", () => {
  assert.equal(isSafeCoursePackPath("audio/narration-001.mp3"), true);
  assert.equal(isSafeCoursePackPath("../secret"), false);
  assert.equal(isSafeCoursePackPath("audio/../secret"), false);
  assert.equal(isSafeCoursePackPath("audio\\secret"), false);
  assert.equal(isSafeCoursePackPath("/absolute/path"), false);
  assert.equal(isSafeCoursePackPath("C:/absolute/path"), false);
});
