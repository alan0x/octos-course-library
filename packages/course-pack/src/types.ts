export const COURSE_PACK_SCHEMA_VERSION = 1 as const;

export type CoursePackFileRole =
  | "lesson"
  | "board"
  | "thumbnail"
  | "narration"
  | "asset"
  | "license";

export interface CoursePackFile {
  path: string;
  sha256: string;
  bytes: number;
  mediaType: string;
  role: CoursePackFileRole;
}

export interface CoursePackNarrationSegment {
  beatId: string;
  file: string;
  textSha256: string;
  durationMs: number;
}

export interface CoursePackLicense {
  name: string;
  url?: string;
  attribution?: string;
  appliesTo: string[];
}

export interface CoursePackManifestV1 {
  schemaVersion: typeof COURSE_PACK_SCHEMA_VERSION;
  packId: string;
  version: string;
  title: string;
  description: string;
  locale: string;
  subject: string;
  grade: string;
  durationSeconds: number;
  minimumPlayerVersion: string;
  entry: string;
  board: string;
  thumbnail: string;
  capabilities: {
    offlinePlayback: boolean;
    offlineNarration: boolean;
    interactiveWhiteboard: boolean;
    liveAi: "none" | "optional" | "required";
    asr?: "none" | "optional" | "required";
    camera?: "none" | "optional" | "required";
  };
  narration: {
    voiceId: string;
    segments: CoursePackNarrationSegment[];
  };
  files: CoursePackFile[];
  licenses: CoursePackLicense[];
}

export interface CoursePackBoardV1 {
  schemaVersion: 1;
  boardId: string;
  initialViewport: { x: number; y: number; zoom: number };
  studentInk: null | { format: "oll.student-ink.svg"; file: string };
  items: Array<{ id: string; kind: string; [key: string]: unknown }>;
}

export interface CoursePackIssue {
  code: string;
  path: string;
  message: string;
}

export interface CoursePackValidationResult {
  valid: boolean;
  manifest?: CoursePackManifestV1;
  issues: CoursePackIssue[];
  packSha256?: string;
}
