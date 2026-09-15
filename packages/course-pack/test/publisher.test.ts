import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { unzipSync, zipSync } from "fflate";
import {
  initializeCoursePackCatalog,
  publishCoursePack,
  withdrawCoursePack,
  type PublicCoursePackCatalog,
} from "../src/publisher.js";

const fixture = resolve("fixtures/contract-smoke-0.0.1.ocpack");
const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const path = mkdtempSync(join(tmpdir(), "course-publish-test-"));
  temporaryRoots.push(path);
  return path;
}

function catalog(root: string): PublicCoursePackCatalog {
  return JSON.parse(readFileSync(join(root, "catalog.json"), "utf8")) as PublicCoursePackCatalog;
}

function alteredFixture(root: string, version: string): string {
  const entries = unzipSync(readFileSync(fixture));
  const manifest = JSON.parse(Buffer.from(entries["manifest.json"]!).toString("utf8")) as Record<string, unknown>;
  manifest.version = version;
  entries["manifest.json"] = Buffer.from(`${JSON.stringify(manifest)}\n`);
  const path = join(root, `source-${version}.ocpack`);
  writeFileSync(path, zipSync(entries, { level: 0 }));
  return path;
}

afterEach(() => {
  for (const path of temporaryRoots.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

test("publishes validated bytes and files at immutable same-origin paths", () => {
  const root = temporaryRoot();
  const published = publishCoursePack(fixture, root, new Date("2026-09-15T00:00:00Z"));
  const base = join(root, "releases", published.packId, published.version);
  const publicCatalog = catalog(root);
  assert.equal(publicCatalog.packs.length, 1);
  assert.equal(publicCatalog.packs[0]?.recommended, true);
  assert.equal(publicCatalog.packs[0]?.archiveUrl,
    "/api/learn/course-packs/contract-smoke/0.0.1/archive.ocpack");
  assert.equal(publicCatalog.packs[0]?.thumbnailUrl,
    "/api/learn/course-packs/contract-smoke/0.0.1/files/thumbnail.svg");
  assert.deepEqual(readFileSync(join(base, "archive.ocpack")), readFileSync(fixture));
  assert.ok(existsSync(join(base, "manifest.json")));
  assert.ok(existsSync(join(base, "files", "audio", "intro.mp3")));
  assert.equal(statSync(join(base, "archive.ocpack")).mode & 0o777, 0o644);
  assert.equal(statSync(join(base, "files", "audio")).mode & 0o777, 0o755);
  assert.equal(statSync(join(root, "catalog.source.json")).mode & 0o777, 0o600);
  assert.equal(statSync(join(root, "catalog.json")).mode & 0o777, 0o644);
  assert.equal(publishCoursePack(fixture, root).archiveSha256, published.archiveSha256);
  assert.equal(readFileSync(join(root, "audit.ndjson"), "utf8").trim().split("\n").length, 1);
  assert.equal(existsSync(join(root, ".publish-lock")), false);
});

test("initializes an empty public catalog without publishing the fixture", () => {
  const root = temporaryRoot();
  assert.deepEqual(initializeCoursePackCatalog(root).packs, []);
  assert.deepEqual(catalog(root).packs, []);
  assert.equal(existsSync(join(root, "releases")), false);
  publishCoursePack(fixture, root);
  assert.equal(initializeCoursePackCatalog(root).packs.length, 1);
});

test("operator CLI initializes and publishes without a running server", () => {
  const root = temporaryRoot();
  const cli = resolve("dist/src/publisher-cli.js");
  const initialized = spawnSync(process.execPath, [cli, "init", "--root", root], { encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.deepEqual(catalog(root).packs, []);
  const published = spawnSync(process.execPath, [
    cli, "publish", fixture, "--root", root,
  ], { encoding: "utf8" });
  assert.equal(published.status, 0, published.stderr);
  assert.equal(catalog(root).packs.length, 1);
});

test("never overwrites a published version with different archive bytes", () => {
  const root = temporaryRoot();
  const original = publishCoursePack(fixture, root);
  const archive = alteredFixture(root, "0.0.1");
  assert.throws(() => publishCoursePack(archive, root), /cannot be overwritten/u);
  assert.equal(catalog(root).packs[0]?.archiveSha256, original.archiveSha256);
  assert.deepEqual(
    readFileSync(join(root, "releases", "contract-smoke", "0.0.1", "archive.ocpack")),
    readFileSync(fixture),
  );
});

test("withdrawal hides discovery without deleting pinned files", () => {
  const root = temporaryRoot();
  publishCoursePack(fixture, root);
  publishCoursePack(alteredFixture(root, "0.0.2"), root);
  assert.equal(catalog(root).packs.find((item) => item.version === "0.0.2")?.recommended, true);
  const withdrawn = withdrawCoursePack("contract-smoke", "0.0.2", root);
  assert.ok(withdrawn.withdrawnAt);
  assert.deepEqual(catalog(root).packs.map((item) => item.version), ["0.0.1"]);
  assert.equal(catalog(root).packs[0]?.recommended, true);
  assert.ok(existsSync(join(root, "releases", "contract-smoke", "0.0.2", "archive.ocpack")));
  assert.equal(withdrawCoursePack("contract-smoke", "0.0.2", root).withdrawnAt, withdrawn.withdrawnAt);
  assert.equal(readFileSync(join(root, "audit.ndjson"), "utf8").trim().split("\n").length, 3);
});

test("recommends SemVer order including numeric prerelease identifiers", () => {
  const root = temporaryRoot();
  publishCoursePack(alteredFixture(root, "1.0.0-2"), root);
  publishCoursePack(alteredFixture(root, "1.0.0-10"), root);
  assert.equal(catalog(root).packs.find((item) => item.recommended)?.version, "1.0.0-10");
  publishCoursePack(alteredFixture(root, "1.0.0"), root);
  assert.equal(catalog(root).packs.find((item) => item.recommended)?.version, "1.0.0");
  withdrawCoursePack("contract-smoke", "1.0.0", root);
  assert.equal(catalog(root).packs.find((item) => item.recommended)?.version, "1.0.0-10");
});

test("rejects invalid input before creating a public release", () => {
  const root = temporaryRoot();
  const invalid = join(root, "invalid.ocpack");
  writeFileSync(invalid, "not a zip");
  assert.throws(() => publishCoursePack(invalid, root), /PACK_ARCHIVE_INVALID/u);
  assert.equal(existsSync(join(root, "releases")), false);
  assert.throws(() => withdrawCoursePack("../other", "0.0.1", root), /Invalid course-pack identity/u);
});

test("never follows a symlinked public releases directory", () => {
  const root = temporaryRoot();
  const outside = temporaryRoot();
  symlinkSync(outside, join(root, "releases"));
  assert.throws(() => publishCoursePack(fixture, root), /real directory/u);
  assert.equal(existsSync(join(outside, "contract-smoke")), false);
});
