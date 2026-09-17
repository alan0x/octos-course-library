import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--") continue;
    if (!name.startsWith("--")) throw new Error(`Unexpected argument '${name}'`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for '${name}'`);
    values.set(name.slice(2), value);
    index += 1;
  }
  for (const required of ["authoring", "output", "profile", "pack-id", "version", "player-root"]) {
    if (!values.has(required)) throw new Error(`Missing required --${required} <value>`);
  }
  return Object.fromEntries(values);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function ensureTerminal(text) {
  const normalized = text.trim();
  return /[。！？!?；;：:]$/u.test(normalized) ? normalized : `${normalized}。`;
}

function mediaType(path) {
  if (path.endsWith(".jsonl")) return "application/x-ndjson";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".mp3")) return "audio/mpeg";
  return "text/plain";
}

function role(path) {
  if (path === "course.oll.jsonl") return "lesson";
  if (path === "board.json") return "board";
  if (path === "thumbnail.svg") return "thumbnail";
  if (path === "course.authoring.json") return "asset";
  if (path.startsWith("audio/")) return "narration";
  return "license";
}

async function synthesize(text, config) {
  const body = {
    app: { appid: config.appId, token: config.token, cluster: config.cluster },
    user: { uid: "octos-course-library-authoring" },
    audio: { voice_type: config.voice, encoding: "mp3", speed_ratio: 1.0 },
    request: {
      reqid: randomUUID(),
      text: ensureTerminal(text),
      operation: "query",
      text_type: "plain",
    },
  };
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
        method: "POST",
        headers: {
          authorization: `Bearer;${config.token}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`Volcengine TTS HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.code !== 3000 || typeof payload.data !== "string" || payload.data === "") {
        throw new Error(payload.message || "Volcengine TTS returned no audio");
      }
      return Buffer.from(payload.data, "base64");
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
    }
  }
  throw lastError;
}

function durationMs(path) {
  const seconds = Number(execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ], { encoding: "utf8" }).trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`Cannot read narration duration: ${path}`);
  return Math.round(seconds * 1000);
}

function thumbnail(title, variant = "generic") {
  const safeTitle = title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  if (variant === "linear-function") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#f7f2e8"/>
  <g transform="translate(120 80)">
    <rect width="500" height="390" rx="28" fill="#fffdf8" stroke="#d9d2c5" stroke-width="4"/>
    <path d="M70 315 H440 M250 45 V350" stroke="#65716b" stroke-width="5"/>
    <path d="M90 330 L420 75" fill="none" stroke="#167d78" stroke-width="12" stroke-linecap="round"/>
    <circle cx="250" cy="206" r="12" fill="#e18b56"/>
    <text x="275" y="198" fill="#183b3a" font-family="system-ui, sans-serif" font-size="30">b</text>
  </g>
  <text x="700" y="190" fill="#183b3a" font-family="system-ui, sans-serif" font-size="68" font-weight="700">y = mx + b</text>
  <text x="700" y="270" fill="#0d6f6b" font-family="system-ui, sans-serif" font-size="34">slope · intercept · graph</text>
  <text x="80" y="570" fill="#202925" font-family="system-ui, sans-serif" font-size="58" font-weight="700">${safeTitle}</text>
  <text x="84" y="620" fill="#65716b" font-family="system-ui, sans-serif" font-size="25">Octos Learn · Curated course</text>
</svg>
`;
  }
  const squares = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      squares.push(`<rect x="${116 + column * 86}" y="${142 + row * 86}" width="82" height="82" rx="8"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#f7f2e8"/>
  <g fill="#d9f1ee" stroke="#167d78" stroke-width="4">${squares.join("")}</g>
  <text x="570" y="214" fill="#183b3a" font-family="system-ui, sans-serif" font-size="32">4 columns</text>
  <text x="570" y="268" fill="#183b3a" font-family="system-ui, sans-serif" font-size="32">3 rows</text>
  <text x="570" y="338" fill="#0d6f6b" font-family="system-ui, sans-serif" font-size="52" font-weight="700">4 × 3 = 12</text>
  <text x="80" y="570" fill="#202925" font-family="system-ui, sans-serif" font-size="58" font-weight="700">${safeTitle}</text>
  <text x="84" y="620" fill="#65716b" font-family="system-ui, sans-serif" font-size="25">Octos Learn · Curated course</text>
</svg>
`;
}

const args = parseArguments(process.argv.slice(2));
const authoringPath = resolve(args.authoring);
const outputDirectory = resolve(args.output);
const profilePath = resolve(args.profile);
const playerRoot = resolve(args["player-root"]);
const metadataPath = args.metadata ? resolve(args.metadata) : undefined;
const packId = requireString(args["pack-id"], "pack-id");
const version = requireString(args.version, "version");
if (await exists(outputDirectory)) throw new Error(`Course source already exists: ${outputDirectory}`);

const authoring = JSON.parse(await readFile(authoringPath, "utf8"));
const metadata = metadataPath ? JSON.parse(await readFile(metadataPath, "utf8")) : {};
const title = requireString(authoring?.lesson?.title, "authoring lesson.title");
const locale = requireString(authoring?.lesson?.language ?? "zh-CN", "authoring lesson.language");
const description = requireString(
  metadata.description ?? "Octos Learn curated mathematics course.",
  "course metadata.description",
);
const subject = requireString(metadata.subject ?? "mathematics", "course metadata.subject");
const grade = requireString(metadata.grade ?? "unspecified", "course metadata.grade");
const thumbnailVariant = requireString(metadata.thumbnailVariant ?? "generic", "course metadata.thumbnailVariant");
await mkdir(resolve(outputDirectory, "audio"), { recursive: true });
const canonicalPath = resolve(outputDirectory, "course.oll.jsonl");
const lessonId = `${packId}-${version}`;
const regionId = `${packId}-${version}-region`;
const materializationOutput = execFileSync("pnpm", [
  "--dir", playerRoot,
  "oll:materialize",
  "--",
  "--authoring", authoringPath,
  "--output", canonicalPath,
  "--lesson-id", lessonId,
  "--board-id", packId,
  "--base-revision", "0",
  "--region-intent", "new_topic",
  "--region-id", regionId,
], { encoding: "utf8" });
process.stdout.write(materializationOutput);
const events = (await readFile(canonicalPath, "utf8"))
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const narrations = events.flatMap((event) => event.event === "lesson.step"
  ? event.step.beats.flatMap((beat) => beat.narration?.text?.trim()
    ? [{ beatId: beat.id, text: beat.narration.text.trim() }]
    : [])
  : []);
if (narrations.length === 0) throw new Error("Authoring lesson has no narration");

const profile = JSON.parse(await readFile(profilePath, "utf8"));
const cloud = profile?.config?.tts_cloud;
const tokenName = "VOLC_TTS_TOKEN";
const tts = {
  appId: requireString(cloud?.appid, "profile config.tts_cloud.appid"),
  token: requireString(profile?.config?.env_vars?.[tokenName], `profile config.env_vars.${tokenName}`),
  cluster: requireString(cloud?.cluster ?? "volcano_tts", "profile config.tts_cloud.cluster"),
  voice: requireString(cloud?.voice ?? "zh_female_xiaohe_uranus_bigtts", "profile config.tts_cloud.voice"),
};
if (tts.token.startsWith("keychain:")) throw new Error("Keychain-backed TTS credentials require the Octos profile launcher");

await copyFile(authoringPath, resolve(outputDirectory, "course.authoring.json"));
await writeFile(resolve(outputDirectory, "board.json"), `${JSON.stringify({
  schemaVersion: 1,
  boardId: packId,
  initialViewport: { x: 0, y: 0, zoom: 1 },
  studentInk: null,
  items: [{
    id: "course-region",
    kind: "playback.course-region",
    x: 20,
    y: 20,
    reservedWidth: 1300,
  }, {
    id: "generated-camera-policy",
    kind: "playback.camera-policy",
    policy: "automatic",
  }],
}, null, 2)}\n`, "utf8");
await writeFile(resolve(outputDirectory, "thumbnail.svg"), thumbnail(title, thumbnailVariant), "utf8");
await writeFile(resolve(outputDirectory, "NOTICE.txt"), [
  `${title}`,
  "",
  "Original Octos lesson content and packaging: Copyright 2026 Octos Course Library contributors.",
  "",
  "Adapted from Marble Skill Taxonomy (v1).",
  "Copyright Generative Spark, Inc. (Marble). https://withmarble.com",
  "Database licensed under ODbL 1.0; textual content licensed under CC BY-SA 4.0.",
  "",
  `Source candidate: ${basename(dirname(authoringPath))}/${basename(authoringPath)}`,
  "Narration voice: Volcengine Xiaohe (zh_female_xiaohe_uranus_bigtts).",
  "",
].join("\n"), "utf8");

const narrationSegments = [];
let totalDurationMs = 0;
for (let index = 0; index < narrations.length; index += 1) {
  const narration = narrations[index];
  const file = `audio/${String(index + 1).padStart(3, "0")}.mp3`;
  const absoluteFile = resolve(outputDirectory, file);
  const bytes = await synthesize(narration.text, tts);
  await writeFile(absoluteFile, bytes);
  const segmentDurationMs = durationMs(absoluteFile);
  totalDurationMs += segmentDurationMs;
  narrationSegments.push({
    beatId: narration.beatId,
    file,
    textSha256: sha256(Buffer.from(narration.text, "utf8")),
    durationMs: segmentDurationMs,
  });
  process.stdout.write(`${JSON.stringify({ stage: "narration", completed: index + 1, total: narrations.length })}\n`);
}

const payloadPaths = [
  "NOTICE.txt",
  "board.json",
  "course.authoring.json",
  "course.oll.jsonl",
  "thumbnail.svg",
  ...narrationSegments.map((segment) => segment.file),
];
const files = [];
for (const path of payloadPaths) {
  const bytes = await readFile(resolve(outputDirectory, path));
  files.push({ path, sha256: sha256(bytes), bytes: bytes.length, mediaType: mediaType(path), role: role(path) });
}
const allPayloadPaths = [...payloadPaths];
const manifest = {
  schemaVersion: 1,
  packId,
  version,
  title,
  description,
  locale,
  subject,
  grade,
  durationSeconds: Math.ceil(totalDurationMs / 1000),
  minimumPlayerVersion: "0.1.0",
  entry: "course.oll.jsonl",
  board: "board.json",
  thumbnail: "thumbnail.svg",
  capabilities: {
    offlinePlayback: true,
    offlineNarration: true,
    interactiveWhiteboard: true,
    liveAi: "optional",
    asr: "optional",
    camera: "none",
  },
  narration: { voiceId: tts.voice, segments: narrationSegments },
  files,
  licenses: [
    {
      name: "Octos curated lesson content",
      attribution: "Copyright 2026 Octos Course Library contributors.",
      appliesTo: allPayloadPaths,
    },
    {
      name: "Marble Skill Taxonomy v1",
      url: "https://withmarble.com",
      attribution: "© Generative Spark, Inc. (Marble); ODbL 1.0 and CC BY-SA 4.0.",
      appliesTo: ["NOTICE.txt", "course.oll.jsonl"],
    },
  ],
};
await writeFile(resolve(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({
  status: "materialized",
  output: outputDirectory,
  narration_segments: narrationSegments.length,
  duration_seconds: manifest.durationSeconds,
  voice: tts.voice,
})}\n`);
