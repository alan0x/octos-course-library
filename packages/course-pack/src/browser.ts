import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import {
  compilePlaybackOperations,
} from "octos-lesson-language/player";
import {
  reduceCanonicalEvents,
  type CanonicalEvent,
} from "octos-lesson-language";
import { unzipSync } from "fflate";
import boardSchema from "../schema/course-pack-board-v1.schema.json" with { type: "json" };
import manifestSchema from "../schema/course-pack-manifest-v1.schema.json" with { type: "json" };
import { isSafeCoursePackPath } from "./path.js";
import type {
  CoursePackBoardV1,
  CoursePackIssue,
  CoursePackManifestV1,
} from "./types.js";

const MANIFEST_PATH = "manifest.json";
const DEFAULT_MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_MAX_SINGLE_FILE_BYTES = 512 * 1024 * 1024;
const DEFAULT_MAX_FILE_COUNT = 20_000;

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat("uri", {
  type: "string",
  validate(value: string): boolean {
    try {
      return Boolean(new URL(value).protocol);
    } catch {
      return false;
    }
  },
});
const validateManifest = ajv.compile<CoursePackManifestV1>(manifestSchema);
const validateBoard = ajv.compile<CoursePackBoardV1>(boardSchema);

export interface CoursePackArchiveLimits {
  maxArchiveBytes?: number;
  maxTotalUncompressedBytes?: number;
  maxSingleFileBytes?: number;
  maxFileCount?: number;
}

export interface LoadedCoursePack {
  manifest: CoursePackManifestV1;
  board: CoursePackBoardV1;
  events: CanonicalEvent[];
  files: ReadonlyMap<string, Uint8Array>;
  archiveSha256: string;
}

export class CoursePackLoadError extends Error {
  readonly issues: CoursePackIssue[];

  constructor(issues: CoursePackIssue[]) {
    super(issues.map((entry) => `${entry.code} ${entry.path}: ${entry.message}`).join("\n"));
    this.name = "CoursePackLoadError";
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

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function parseJson(bytes: Uint8Array | undefined, path: string): unknown {
  if (!bytes) {
    throw new CoursePackLoadError([{
      code: "PACK_FILE_MISSING",
      path,
      message: "Required file is missing",
    }]);
  }
  try {
    return JSON.parse(decodeUtf8(bytes)) as unknown;
  } catch (error) {
    throw new CoursePackLoadError([{
      code: "PACK_INVALID_JSON",
      path,
      message: error instanceof Error ? error.message : "Invalid JSON",
    }]);
  }
}

async function sha256(value: Uint8Array): Promise<string> {
  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi) {
    throw new Error("Web Crypto SHA-256 is unavailable");
  }
  const copy = value.slice();
  const digest = await cryptoApi.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseEvents(bytes: Uint8Array, path: string): CanonicalEvent[] {
  const issues: CoursePackIssue[] = [];
  const events = decodeUtf8(bytes)
    .split(/\r?\n/u)
    .flatMap((line, index) => {
      if (!line.trim()) return [];
      try {
        const value = JSON.parse(line) as unknown;
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("Expected a JSON object");
        }
        return [value as CanonicalEvent];
      } catch (error) {
        issue(
          issues,
          "PACK_INVALID_OLL_JSONL",
          `/${path}/line/${index + 1}`,
          error instanceof Error ? error.message : "Invalid JSONL event",
        );
        return [];
      }
    });
  if (events.length === 0) {
    issue(issues, "PACK_EMPTY_OLL", `/${path}`, "OLL entry must contain events");
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
  if (issues.length > 0) throw new CoursePackLoadError(issues);
  return events;
}

/**
 * Read and verify an immutable CoursePack archive in a browser or WebView.
 * The returned byte map is intentionally read-only and remains the source for
 * packaged narration and other local assets during playback.
 */
export async function loadCoursePackArchive(
  input: ArrayBuffer | Uint8Array,
  limits: CoursePackArchiveLimits = {},
): Promise<LoadedCoursePack> {
  const archive = input instanceof Uint8Array ? input : new Uint8Array(input);
  const maxArchiveBytes = limits.maxArchiveBytes ?? DEFAULT_MAX_ARCHIVE_BYTES;
  const maxTotalUncompressedBytes = limits.maxTotalUncompressedBytes
    ?? DEFAULT_MAX_TOTAL_UNCOMPRESSED_BYTES;
  const maxSingleFileBytes = limits.maxSingleFileBytes
    ?? DEFAULT_MAX_SINGLE_FILE_BYTES;
  const maxFileCount = limits.maxFileCount ?? DEFAULT_MAX_FILE_COUNT;
  if (archive.byteLength > maxArchiveBytes) {
    throw new CoursePackLoadError([{
      code: "PACK_ARCHIVE_TOO_LARGE",
      path: "/",
      message: "Archive exceeds the supported size limit",
    }]);
  }

  let fileCount = 0;
  let totalBytes = 0;
  let unpacked: Record<string, Uint8Array>;
  try {
    unpacked = unzipSync(archive, {
      filter(file) {
        fileCount += 1;
        totalBytes += file.originalSize;
        if (fileCount > maxFileCount) throw new Error("Archive contains too many files");
        if (file.originalSize > maxSingleFileBytes) {
          throw new Error(`Archive file is too large: ${file.name}`);
        }
        if (totalBytes > maxTotalUncompressedBytes) {
          throw new Error("Archive uncompressed size exceeds the supported limit");
        }
        if (!isSafeCoursePackPath(file.name)) {
          throw new Error(`Archive contains an unsafe path: ${file.name}`);
        }
        return true;
      },
    });
  } catch (error) {
    throw new CoursePackLoadError([{
      code: "PACK_ARCHIVE_INVALID",
      path: "/",
      message: error instanceof Error ? error.message : "Unable to unpack archive",
    }]);
  }
  const files = new Map(Object.entries(unpacked));
  const rawManifest = parseJson(files.get(MANIFEST_PATH), MANIFEST_PATH);
  if (!validateManifest(rawManifest)) {
    const issues: CoursePackIssue[] = [];
    schemaIssues(issues, "PACK_MANIFEST_SCHEMA", "/manifest.json", validateManifest.errors);
    throw new CoursePackLoadError(issues);
  }
  const manifest = rawManifest;
  const issues: CoursePackIssue[] = [];
  const declared = new Map(manifest.files.map((file) => [file.path, file]));
  for (const file of manifest.files) {
    if (!isSafeCoursePackPath(file.path)) {
      issue(issues, "PACK_UNSAFE_PATH", `/${file.path}`, "Declared path is not safe");
      continue;
    }
    const bytes = files.get(file.path);
    if (!bytes) {
      issue(issues, "PACK_FILE_MISSING", `/${file.path}`, "Declared file is missing");
      continue;
    }
    if (bytes.byteLength !== file.bytes) {
      issue(
        issues,
        "PACK_FILE_SIZE_MISMATCH",
        `/${file.path}`,
        `Expected ${file.bytes} bytes, received ${bytes.byteLength}`,
      );
    }
    const digest = await sha256(bytes);
    if (digest !== file.sha256) {
      issue(
        issues,
        "PACK_FILE_DIGEST_MISMATCH",
        `/${file.path}`,
        `Expected ${file.sha256}, received ${digest}`,
      );
    }
  }
  for (const path of files.keys()) {
    if (path !== MANIFEST_PATH && !declared.has(path)) {
      issue(issues, "PACK_UNDECLARED_FILE", `/${path}`, "File is not declared");
    }
  }
  const rawBoard = parseJson(files.get(manifest.board), manifest.board);
  if (!validateBoard(rawBoard)) {
    schemaIssues(issues, "PACK_BOARD_SCHEMA", `/${manifest.board}`, validateBoard.errors);
  }
  if (issues.length > 0) throw new CoursePackLoadError(issues);
  const entry = files.get(manifest.entry);
  if (!entry) {
    throw new CoursePackLoadError([{
      code: "PACK_FILE_MISSING",
      path: manifest.entry,
      message: "OLL entry file is missing",
    }]);
  }
  return {
    manifest,
    board: rawBoard as CoursePackBoardV1,
    events: parseEvents(entry, manifest.entry),
    files,
    archiveSha256: await sha256(archive),
  };
}

export function coursePackFileBlob(
  pack: LoadedCoursePack,
  path: string,
): Blob | null {
  const bytes = pack.files.get(path);
  if (!bytes) return null;
  const mediaType = pack.manifest.files.find((file) => file.path === path)?.mediaType;
  return new Blob([bytes.slice().buffer], { type: mediaType ?? "application/octet-stream" });
}

export type {
  CoursePackBoardV1,
  CoursePackFile,
  CoursePackFileRole,
  CoursePackLicense,
  CoursePackManifestV1,
  CoursePackNarrationSegment,
} from "./types.js";
