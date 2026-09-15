import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { compilePlaybackOperations } from "octos-lesson-language/player";
import {
  reduceCanonicalEvents,
  type CanonicalEvent,
} from "octos-lesson-language";
import { unzipSync, zipSync } from "fflate";
import boardSchema from "../schema/course-pack-board-v1.schema.json" with { type: "json" };
import manifestSchema from "../schema/course-pack-manifest-v1.schema.json" with { type: "json" };
import { isSafeCoursePackPath, sha256 } from "./integrity.js";
import type {
  CoursePackBoardV1,
  CoursePackIssue,
  CoursePackManifestV1,
  CoursePackValidationResult,
} from "./types.js";

const MANIFEST_PATH = "manifest.json";
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_FILE_COUNT = 20_000;
const MAX_SINGLE_FILE_BYTES = 512 * 1024 * 1024;
const FORBIDDEN_RUNTIME_KEYS = new Set([
  "accountId",
  "account_id",
  "jobId",
  "job_id",
  "profileId",
  "profile_id",
  "rpc",
  "sessionId",
  "session_id",
  "taskId",
  "task_id",
  "temporaryUrl",
  "temporary_url",
  "userId",
  "user_id",
]);

type PackFiles = Map<string, Uint8Array>;

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat("uri", {
  type: "string",
  validate(value: string): boolean {
    try {
      const url = new URL(value);
      return Boolean(url.protocol);
    } catch {
      return false;
    }
  },
});
const validateManifestSchema = ajv.compile<CoursePackManifestV1>(manifestSchema);
const validateBoardSchema = ajv.compile<CoursePackBoardV1>(boardSchema);

export class CoursePackValidationError extends Error {
  readonly issues: CoursePackIssue[];

  constructor(issues: CoursePackIssue[]) {
    super(issues.map((issue) => `${issue.code} ${issue.path}: ${issue.message}`).join("\n"));
    this.name = "CoursePackValidationError";
    this.issues = issues;
  }
}

function issue(
  issues: CoursePackIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function schemaIssues(
  issues: CoursePackIssue[],
  code: string,
  prefix: string,
  errors: ErrorObject[] | null | undefined,
): void {
  for (const error of errors ?? []) {
    issue(
      issues,
      code,
      `${prefix}${error.instancePath || "/"}`,
      error.message ?? "Schema validation failed",
    );
  }
}

function parseJson(
  bytes: Uint8Array | undefined,
  path: string,
  issues: CoursePackIssue[],
): unknown {
  if (!bytes) {
    issue(issues, "PACK_FILE_MISSING", path, "Required file is missing");
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch (error) {
    issue(
      issues,
      "PACK_INVALID_JSON",
      path,
      error instanceof Error ? error.message : "Invalid JSON",
    );
    return undefined;
  }
}

function collectDirectoryFiles(root: string): PackFiles {
  const absoluteRoot = resolve(root);
  const files: PackFiles = new Map();
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const absolutePath = join(directory, name);
      const fileStat = lstatSync(absolutePath);
      if (fileStat.isSymbolicLink()) {
        throw new Error(`Course packs cannot contain symbolic links: ${absolutePath}`);
      }
      if (fileStat.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!fileStat.isFile()) continue;
      const path = relative(absoluteRoot, absolutePath).split(sep).join("/");
      files.set(path, readFileSync(absolutePath));
    }
  };
  visit(absoluteRoot);
  return files;
}

function scanPortableValue(
  value: unknown,
  path: string,
  issues: CoursePackIssue[],
): void {
  if (typeof value === "string") {
    if (/^https?:\/\//iu.test(value)) {
      issue(
        issues,
        "PACK_REMOTE_RUNTIME_RESOURCE",
        path,
        "Runtime content cannot require an HTTP resource",
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanPortableValue(child, `${path}/${index}`, issues));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}/${key}`;
    if (FORBIDDEN_RUNTIME_KEYS.has(key)) {
      issue(
        issues,
        "PACK_RUNTIME_STATE_FORBIDDEN",
        childPath,
        `Runtime identity or task field '${key}' is not portable`,
      );
    }
    scanPortableValue(child, childPath, issues);
  }
}

function parseCanonicalJsonl(
  bytes: Uint8Array | undefined,
  path: string,
  issues: CoursePackIssue[],
): CanonicalEvent[] | undefined {
  if (!bytes) {
    issue(issues, "PACK_FILE_MISSING", path, "OLL entry file is missing");
    return undefined;
  }
  const events: CanonicalEvent[] = [];
  const lines = Buffer.from(bytes).toString("utf8").split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    try {
      const value = JSON.parse(line) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Expected a JSON object");
      }
      scanPortableValue(value, `/${path}/line/${index + 1}`, issues);
      events.push(value as CanonicalEvent);
    } catch (error) {
      issue(
        issues,
        "PACK_INVALID_OLL_JSONL",
        `/${path}/line/${index + 1}`,
        error instanceof Error ? error.message : "Invalid JSONL event",
      );
    }
  }
  if (events.length === 0) {
    issue(issues, "PACK_EMPTY_OLL", `/${path}`, "OLL entry must contain events");
    return undefined;
  }
  try {
    compilePlaybackOperations(events);
    reduceCanonicalEvents(events);
  } catch (error) {
    issue(
      issues,
      "PACK_INVALID_OLL_PLAYBACK",
      `/${path}`,
      error instanceof Error ? error.message : "OLL playback compilation failed",
    );
  }
  return events;
}

function narrationByBeat(events: CanonicalEvent[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const event of events) {
    if (event.event !== "lesson.step" || !event.step) continue;
    for (const beat of event.step.beats) {
      const text = beat.narration?.text?.trim();
      if (text) result.set(beat.id, text);
    }
  }
  return result;
}

function logicalPackDigest(files: PackFiles): string {
  const inventory = [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, bytes]) => `${path}\0${bytes.length}\0${sha256(bytes)}`)
    .join("\n");
  return sha256(inventory);
}

function validatePackFiles(files: PackFiles): CoursePackValidationResult {
  const issues: CoursePackIssue[] = [];
  if (files.size > MAX_FILE_COUNT) {
    issue(issues, "PACK_TOO_MANY_FILES", "/", `Pack contains more than ${MAX_FILE_COUNT} files`);
  }
  let totalBytes = 0;
  for (const [path, bytes] of files) {
    if (!isSafeCoursePackPath(path)) {
      issue(issues, "PACK_UNSAFE_PATH", `/${path}`, "Path is not a normalized relative POSIX path");
    }
    totalBytes += bytes.length;
  }
  if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
    issue(issues, "PACK_TOO_LARGE", "/", "Uncompressed pack exceeds the supported size limit");
  }

  const rawManifest = parseJson(files.get(MANIFEST_PATH), MANIFEST_PATH, issues);
  if (!validateManifestSchema(rawManifest)) {
    schemaIssues(issues, "PACK_MANIFEST_SCHEMA", "/manifest.json", validateManifestSchema.errors);
    return { valid: false, issues, packSha256: logicalPackDigest(files) };
  }
  const manifest = rawManifest;

  const declaredPaths = new Set<string>();
  for (let index = 0; index < manifest.files.length; index += 1) {
    const declared = manifest.files[index]!;
    const path = `/manifest.json/files/${index}`;
    if (!isSafeCoursePackPath(declared.path)) {
      issue(issues, "PACK_UNSAFE_PATH", `${path}/path`, "Path is not safe");
      continue;
    }
    if (declared.path === MANIFEST_PATH) {
      issue(issues, "PACK_MANIFEST_SELF_REFERENCE", `${path}/path`, "Manifest cannot inventory itself");
    }
    if (declaredPaths.has(declared.path)) {
      issue(issues, "PACK_DUPLICATE_FILE", `${path}/path`, "File path is duplicated");
      continue;
    }
    declaredPaths.add(declared.path);
    const bytes = files.get(declared.path);
    if (!bytes) {
      issue(issues, "PACK_FILE_MISSING", `/${declared.path}`, "Declared file is missing");
      continue;
    }
    if (bytes.length !== declared.bytes) {
      issue(
        issues,
        "PACK_FILE_SIZE_MISMATCH",
        `/${declared.path}`,
        `Expected ${declared.bytes} bytes, received ${bytes.length}`,
      );
    }
    const digest = sha256(bytes);
    if (digest !== declared.sha256) {
      issue(
        issues,
        "PACK_FILE_DIGEST_MISMATCH",
        `/${declared.path}`,
        `Expected ${declared.sha256}, received ${digest}`,
      );
    }
  }

  for (const path of files.keys()) {
    if (path !== MANIFEST_PATH && !declaredPaths.has(path)) {
      issue(issues, "PACK_UNDECLARED_FILE", `/${path}`, "File is not declared in manifest.files");
    }
  }

  const requiredRoles = new Map([
    [manifest.entry, "lesson"],
    [manifest.board, "board"],
    [manifest.thumbnail, "thumbnail"],
  ]);
  for (const [path, role] of requiredRoles) {
    const declared = manifest.files.find((candidate) => candidate.path === path);
    if (!declared) {
      issue(issues, "PACK_REQUIRED_FILE_UNDECLARED", `/${path}`, `Required ${role} file is not declared`);
    } else if (declared.role !== role) {
      issue(issues, "PACK_FILE_ROLE_MISMATCH", `/${path}`, `Expected role '${role}', received '${declared.role}'`);
    }
  }

  const rawBoard = parseJson(files.get(manifest.board), manifest.board, issues);
  if (!validateBoardSchema(rawBoard)) {
    schemaIssues(issues, "PACK_BOARD_SCHEMA", `/${manifest.board}`, validateBoardSchema.errors);
  } else {
    scanPortableValue(rawBoard, `/${manifest.board}`, issues);
    if (rawBoard.studentInk && !declaredPaths.has(rawBoard.studentInk.file)) {
      issue(
        issues,
        "PACK_BOARD_INK_UNDECLARED",
        `/${manifest.board}/studentInk/file`,
        "Initial ink file is not declared",
      );
    }
  }

  const events = parseCanonicalJsonl(files.get(manifest.entry), manifest.entry, issues);
  if (events) {
    const expectedNarration = narrationByBeat(events);
    const segments = new Map<string, (typeof manifest.narration.segments)[number]>();
    for (let index = 0; index < manifest.narration.segments.length; index += 1) {
      const segment = manifest.narration.segments[index]!;
      const path = `/manifest.json/narration/segments/${index}`;
      if (segments.has(segment.beatId)) {
        issue(issues, "PACK_DUPLICATE_NARRATION", `${path}/beatId`, "Beat narration is duplicated");
      }
      segments.set(segment.beatId, segment);
      const declared = manifest.files.find((candidate) => candidate.path === segment.file);
      if (!declared) {
        issue(issues, "PACK_NARRATION_FILE_UNDECLARED", `${path}/file`, "Narration file is not declared");
      } else if (declared.role !== "narration" || !declared.mediaType.startsWith("audio/")) {
        issue(issues, "PACK_NARRATION_MEDIA_INVALID", `${path}/file`, "Narration must reference an audio file with narration role");
      }
      const text = expectedNarration.get(segment.beatId);
      if (!text) {
        issue(issues, "PACK_NARRATION_BEAT_UNKNOWN", `${path}/beatId`, "Narration references an unknown or silent beat");
      } else if (sha256(text) !== segment.textSha256) {
        issue(issues, "PACK_NARRATION_TEXT_MISMATCH", `${path}/textSha256`, "Narration text digest does not match OLL text");
      }
    }
    if (manifest.capabilities.offlineNarration) {
      for (const beatId of expectedNarration.keys()) {
        if (!segments.has(beatId)) {
          issue(
            issues,
            "PACK_NARRATION_MISSING",
            `/manifest.json/narration/segments`,
            `Offline narration is missing for beat '${beatId}'`,
          );
        }
      }
    }
  }

  const licensedPaths = new Set(manifest.licenses.flatMap((license) => license.appliesTo));
  for (const path of licensedPaths) {
    if (!declaredPaths.has(path)) {
      issue(issues, "PACK_LICENSE_PATH_UNKNOWN", "/manifest.json/licenses", `License references undeclared path '${path}'`);
    }
  }
  for (const path of declaredPaths) {
    if (!licensedPaths.has(path)) {
      issue(issues, "PACK_FILE_UNLICENSED", `/${path}`, "Every payload file must be covered by a license entry");
    }
  }

  return {
    valid: issues.length === 0,
    manifest,
    issues,
    packSha256: logicalPackDigest(files),
  };
}

export function validateCoursePackDirectory(directory: string): CoursePackValidationResult {
  try {
    const rootStat = statSync(directory);
    if (!rootStat.isDirectory()) {
      return { valid: false, issues: [{ code: "PACK_NOT_DIRECTORY", path: directory, message: "Expected a directory" }] };
    }
    return validatePackFiles(collectDirectoryFiles(directory));
  } catch (error) {
    return {
      valid: false,
      issues: [{
        code: "PACK_READ_FAILED",
        path: directory,
        message: error instanceof Error ? error.message : "Unable to read course pack",
      }],
    };
  }
}

export function inspectCoursePackArchive(archivePath: string): CoursePackValidationResult {
  try {
    const archiveStat = statSync(archivePath);
    if (!archiveStat.isFile()) throw new Error("Expected an archive file");
    if (archiveStat.size > MAX_ARCHIVE_BYTES) throw new Error("Archive exceeds the supported size limit");
    const archive = readFileSync(archivePath);
    let fileCount = 0;
    let totalUncompressedBytes = 0;
    const unpacked = unzipSync(archive, {
      filter(file) {
        fileCount += 1;
        totalUncompressedBytes += file.originalSize;
        if (fileCount > MAX_FILE_COUNT) throw new Error("Archive contains too many files");
        if (file.originalSize > MAX_SINGLE_FILE_BYTES) throw new Error(`Archive file is too large: ${file.name}`);
        if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          throw new Error("Archive uncompressed size exceeds the supported limit");
        }
        if (!isSafeCoursePackPath(file.name)) throw new Error(`Archive contains an unsafe path: ${file.name}`);
        return true;
      },
    });
    const files: PackFiles = new Map();
    for (const [path, bytes] of Object.entries(unpacked)) {
      files.set(path, bytes);
    }
    const result = validatePackFiles(files);
    return { ...result, packSha256: sha256(archive) };
  } catch (error) {
    return {
      valid: false,
      issues: [{
        code: "PACK_ARCHIVE_INVALID",
        path: archivePath,
        message: error instanceof Error ? error.message : "Unable to inspect archive",
      }],
    };
  }
}

export function buildCoursePack(
  directory: string,
  outputPath: string,
): { path: string; bytes: number; sha256: string; manifest: CoursePackManifestV1 } {
  const absoluteDirectory = resolve(directory);
  const absoluteOutput = resolve(outputPath);
  if (absoluteOutput === absoluteDirectory || absoluteOutput.startsWith(`${absoluteDirectory}${sep}`)) {
    throw new Error("CoursePack output must be outside the source directory");
  }
  const result = validateCoursePackDirectory(directory);
  if (!result.valid || !result.manifest) throw new CoursePackValidationError(result.issues);
  const files = collectDirectoryFiles(directory);
  const entries: Record<string, Uint8Array> = {};
  for (const [path, bytes] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    entries[path] = bytes;
  }
  const archive = Buffer.from(zipSync(entries, {
    level: 9,
    // ZIP stores timestamps. Pinning the timestamp makes the same reviewed
    // source produce the same archive digest on every build host.
    mtime: new Date(1980, 0, 1, 0, 0, 0),
  }));
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  const partial = `${absoluteOutput}.${process.pid}.part`;
  try {
    writeFileSync(partial, archive, { mode: 0o600 });
    renameSync(partial, absoluteOutput);
  } finally {
    rmSync(partial, { force: true });
  }
  return {
    path: absoluteOutput,
    bytes: archive.length,
    sha256: sha256(archive),
    manifest: result.manifest,
  };
}
