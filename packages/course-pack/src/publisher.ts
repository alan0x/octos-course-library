import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { unzipSync } from "fflate";
import { sha256 } from "./integrity.js";
import { isSafeCoursePackPath } from "./path.js";
import { inspectCoursePackArchive } from "./validator.js";
import type { CoursePackManifestV1 } from "./types.js";

const PACK_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/u;

export interface PublishedCoursePack {
  packId: string;
  version: string;
  title: string;
  description: string;
  locale: string;
  subject: string;
  grade: string;
  durationSeconds: number;
  minimumPlayerVersion: string;
  capabilities: CoursePackManifestV1["capabilities"];
  archiveSha256: string;
  archiveBytes: number;
  thumbnail: string;
  publishedAt: string;
  withdrawnAt: string | null;
}

export interface PublicCoursePack extends Omit<PublishedCoursePack, "withdrawnAt" | "thumbnail"> {
  recommended: boolean;
  archiveUrl: string;
  manifestUrl: string;
  thumbnailUrl: string;
}

interface CatalogSource {
  schemaVersion: 1;
  releases: PublishedCoursePack[];
}

export interface PublicCoursePackCatalog {
  schemaVersion: 1;
  generatedAt: string;
  packs: PublicCoursePack[];
}

function readSource(root: string): CatalogSource {
  const path = join(root, "catalog.source.json");
  if (!existsSync(path)) return { schemaVersion: 1, releases: [] };
  const value = JSON.parse(readFileSync(path, "utf8")) as CatalogSource;
  if (value.schemaVersion !== 1 || !Array.isArray(value.releases)) {
    throw new Error("Unsupported course-pack catalog source");
  }
  for (const release of value.releases) {
    if (!release || !PACK_ID.test(release.packId) || !VERSION.test(release.version)
      || !/^[a-f0-9]{64}$/u.test(release.archiveSha256)
      || !isSafeCoursePackPath(release.thumbnail)
      || (release.withdrawnAt !== null && typeof release.withdrawnAt !== "string")) {
      throw new Error("Course-pack catalog source contains an invalid release");
    }
  }
  return value;
}

function writeAtomically(path: string, contents: string, mode = 0o600): void {
  const temporary = `${path}.${randomUUID()}.part`;
  try {
    writeFileSync(temporary, contents, { mode, flag: "wx" });
    chmodSync(temporary, mode);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function compareVersions(a: string, b: string): number {
  const aDash = a.indexOf("-");
  const bDash = b.indexOf("-");
  const aCore = aDash === -1 ? a : a.slice(0, aDash);
  const bCore = bDash === -1 ? b : b.slice(0, bDash);
  const aParts = aCore.split(".");
  const bParts = bCore.split(".");
  for (let index = 0; index < 3; index += 1) {
    const left = BigInt(aParts[index]!);
    const right = BigInt(bParts[index]!);
    if (left !== right) return left > right ? 1 : -1;
  }
  if (aDash === -1 && bDash !== -1) return 1;
  if (bDash === -1 && aDash !== -1) return -1;
  if (aDash === -1 && bDash === -1) return 0;
  const aPrerelease = a.slice(aDash + 1).split(".");
  const bPrerelease = b.slice(bDash + 1).split(".");
  for (let index = 0; index < Math.min(aPrerelease.length, bPrerelease.length); index += 1) {
    const left = aPrerelease[index]!;
    const right = bPrerelease[index]!;
    const leftNumeric = /^[0-9]+$/u.test(left);
    const rightNumeric = /^[0-9]+$/u.test(right);
    if (leftNumeric && rightNumeric) {
      const difference = BigInt(left) - BigInt(right);
      if (difference) return difference > 0n ? 1 : -1;
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else if (left !== right) {
      return left < right ? -1 : 1;
    }
  }
  return Math.sign(aPrerelease.length - bPrerelease.length);
}

export function renderPublicCatalog(
  source: CatalogSource,
  now = new Date(),
): PublicCoursePackCatalog {
  const active = source.releases.filter((release) => release.withdrawnAt === null);
  const latest = new Map<string, string>();
  for (const release of active) {
    const previous = latest.get(release.packId);
    if (!previous || compareVersions(release.version, previous) > 0) {
      latest.set(release.packId, release.version);
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    packs: active
      .map((release) => {
        const { withdrawnAt: _withdrawnAt, thumbnail: _thumbnail, ...visible } = release;
        const base = `/api/learn/course-packs/${release.packId}/${release.version}`;
        return {
          ...visible,
          recommended: latest.get(release.packId) === release.version,
          archiveUrl: `${base}/archive.ocpack`,
          manifestUrl: `${base}/manifest.json`,
          thumbnailUrl: `${base}/files/${release.thumbnail.split("/").map(encodeURIComponent).join("/")}`,
        };
      })
      .sort((a, b) => a.packId.localeCompare(b.packId)
        || compareVersions(b.version, a.version)),
  };
}

function publishCatalog(root: string, source: CatalogSource, now: Date): void {
  writeAtomically(join(root, "catalog.source.json"), `${JSON.stringify(source, null, 2)}\n`);
  writeAtomically(join(root, "catalog.json"), `${JSON.stringify(renderPublicCatalog(source, now), null, 2)}\n`, 0o644);
}

function withPublisherLock<T>(rootPath: string, action: (root: string) => T): T {
  const root = resolve(rootPath);
  mkdirSync(root, { recursive: true, mode: 0o755 });
  if (!lstatSync(root).isDirectory()) throw new Error("Publication root must be a real directory");
  chmodSync(root, 0o755);
  const lock = join(root, ".publish-lock");
  mkdirSync(lock, { mode: 0o700 });
  try {
    return action(root);
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

function requireRealDirectory(path: string): void {
  if (existsSync(path)) {
    if (!lstatSync(path).isDirectory()) {
      throw new Error(`Publication path must be a real directory: ${path}`);
    }
  } else {
    mkdirSync(path, { mode: 0o755 });
  }
  chmodSync(path, 0o755);
}

function publicizeTree(directory: string): void {
  chmodSync(directory, 0o755);
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Published files cannot contain symbolic links: ${path}`);
    if (stat.isDirectory()) publicizeTree(path);
    else if (stat.isFile()) chmodSync(path, 0o644);
  }
}

function audit(root: string, action: string, packId: string, version: string, now: Date): void {
  const path = join(root, "audit.ndjson");
  if (existsSync(path) && !lstatSync(path).isFile()) {
    throw new Error("Publisher audit path must be a regular file");
  }
  appendFileSync(path, `${JSON.stringify({
    at: now.toISOString(), action, packId, version,
  })}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function initializeCoursePackCatalog(
  rootPath: string,
  now = new Date(),
): PublicCoursePackCatalog {
  return withPublisherLock(rootPath, (root) => {
    const source = readSource(root);
    publishCatalog(root, source, now);
    return renderPublicCatalog(source, now);
  });
}

export function publishCoursePack(
  archivePath: string,
  rootPath: string,
  now = new Date(),
): PublishedCoursePack {
  const inspected = inspectCoursePackArchive(resolve(archivePath));
  if (!inspected.valid || !inspected.manifest || !inspected.packSha256) {
    throw new Error(inspected.issues.map((issue) => `${issue.code} ${issue.path}: ${issue.message}`).join("\n"));
  }
  const manifest = inspected.manifest;
  return withPublisherLock(rootPath, (root) => {
    const source = readSource(root);
    const existing = source.releases.find((release) => release.packId === manifest.packId
      && release.version === manifest.version);
    const final = join(root, "releases", manifest.packId, manifest.version);
    if (existing) {
      if (existing.archiveSha256 === inspected.packSha256
        && existsSync(join(final, "archive.ocpack"))
        && sha256(readFileSync(join(final, "archive.ocpack"))) === inspected.packSha256) {
        publishCatalog(root, source, now);
        return existing;
      }
      throw new Error(`Course pack ${manifest.packId}@${manifest.version} already exists; published bytes cannot be overwritten`);
    }

    const archive = readFileSync(resolve(archivePath));
    if (sha256(archive) !== inspected.packSha256) {
      throw new Error("Course pack changed between inspection and publication");
    }
    if (existsSync(final)
      && (!existsSync(join(final, "archive.ocpack"))
        || sha256(readFileSync(join(final, "archive.ocpack"))) !== inspected.packSha256)) {
      throw new Error(`Course pack ${manifest.packId}@${manifest.version} already exists; published bytes cannot be overwritten`);
    }

    if (!existsSync(final)) {
      const staged = join(root, ".staging", randomUUID());
      mkdirSync(staged, { recursive: true, mode: 0o755 });
      chmodSync(staged, 0o755);
      try {
        const archiveTarget = join(staged, "archive.ocpack");
        writeFileSync(archiveTarget, archive, { mode: 0o644, flag: "wx" });
        chmodSync(archiveTarget, 0o644);
        const files = unzipSync(archive);
        for (const [path, bytes] of Object.entries(files)) {
          const target = path === "manifest.json"
            ? join(staged, "manifest.json")
            : join(staged, "files", path);
          mkdirSync(dirname(target), { recursive: true, mode: 0o755 });
          chmodSync(dirname(target), 0o755);
          writeFileSync(target, bytes, { mode: 0o644, flag: "wx" });
          chmodSync(target, 0o644);
        }
        publicizeTree(staged);
        requireRealDirectory(join(root, "releases"));
        requireRealDirectory(dirname(final));
        renameSync(staged, final);
      } finally {
        rmSync(staged, { recursive: true, force: true });
      }
    }
    const record: PublishedCoursePack = {
      packId: manifest.packId,
      version: manifest.version,
      title: manifest.title,
      description: manifest.description,
      locale: manifest.locale,
      subject: manifest.subject,
      grade: manifest.grade,
      durationSeconds: manifest.durationSeconds,
      minimumPlayerVersion: manifest.minimumPlayerVersion,
      capabilities: manifest.capabilities,
      archiveSha256: inspected.packSha256,
      archiveBytes: archive.byteLength,
      thumbnail: manifest.thumbnail,
      publishedAt: now.toISOString(),
      withdrawnAt: null,
    };
    source.releases.push(record);
    publishCatalog(root, source, now);
    audit(root, "publish", manifest.packId, manifest.version, now);
    return record;
  });
}

export function withdrawCoursePack(
  packId: string,
  version: string,
  rootPath: string,
  now = new Date(),
): PublishedCoursePack {
  if (!PACK_ID.test(packId) || !VERSION.test(version)) {
    throw new Error("Invalid course-pack identity");
  }
  return withPublisherLock(rootPath, (root) => {
    const source = readSource(root);
    const release = source.releases.find((candidate) => candidate.packId === packId
      && candidate.version === version);
    if (!release) throw new Error(`Unknown course pack ${packId}@${version}`);
    if (release.withdrawnAt) return release;
    release.withdrawnAt = now.toISOString();
    publishCatalog(root, source, now);
    audit(root, "withdraw", packId, version, now);
    return release;
  });
}
