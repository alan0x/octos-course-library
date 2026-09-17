import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
  for (const required of ["input", "output", "profile", "learning-coach"]) {
    if (!values.has(required)) throw new Error(`Missing required --${required} <path>`);
  }
  return Object.fromEntries(values);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function normalizeProvider(family) {
  if (family === "google" || family === "gemini") return "gemini";
  if (family === "vertex" || family === "vertex-ai" || family === "vertexai") return "vertex";
  if (family === "ark" || family === "volcengine" || family === "bytedance") return "ark";
  throw new Error(`Unsupported development-profile provider '${family}'`);
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function gitState(repository) {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=no"], {
    cwd: repository,
    encoding: "utf8",
  });
  const diff = execFileSync("git", ["diff", "--binary", "HEAD", "--", "src", "package.json"], {
    cwd: repository,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    revision,
    dirty: status.trim() !== "",
    source_diff_sha256: createHash("sha256").update(diff).digest("hex"),
  };
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function requestMetrics(request) {
  return {
    system_prompt_bytes: Buffer.byteLength(request.systemPrompt ?? "", "utf8"),
    prompt_bytes: Buffer.byteLength(request.prompt ?? "", "utf8"),
    response_schema_bytes: Buffer.byteLength(JSON.stringify(request.responseSchema ?? {}), "utf8"),
  };
}

function summarizeModelCalls(calls) {
  return calls.reduce((summary, call) => ({
    model_calls: summary.model_calls + 1,
    model_elapsed_ms: summary.model_elapsed_ms + call.elapsed_ms,
    system_prompt_bytes: summary.system_prompt_bytes + call.request_metrics.system_prompt_bytes,
    prompt_bytes: summary.prompt_bytes + call.request_metrics.prompt_bytes,
    response_schema_bytes: summary.response_schema_bytes + call.request_metrics.response_schema_bytes,
  }), {
    model_calls: 0,
    model_elapsed_ms: 0,
    system_prompt_bytes: 0,
    prompt_bytes: 0,
    response_schema_bytes: 0,
  });
}

const args = parseArguments(process.argv.slice(2));
const inputPath = resolve(args.input);
const outputDirectory = resolve(args.output);
const profilePath = resolve(args.profile);
const learningCoachRoot = resolve(args["learning-coach"]);
const learningCoachState = gitState(learningCoachRoot);

if (await pathExists(outputDirectory)) {
  throw new Error(`Candidate output already exists: ${outputDirectory}`);
}

const input = JSON.parse(await readFile(inputPath, "utf8"));
const learnerRequest = requireString(input.learner_request, "learner_request");
const language = requireString(input.language ?? "zh-CN", "language");
const requestParts = input.request_parts;
if (!Array.isArray(requestParts) || requestParts.length === 0) {
  throw new Error("request_parts must be a non-empty array");
}
requestParts.forEach((part, index) => requireString(part, `request_parts[${index}]`));

const profile = JSON.parse(await readFile(profilePath, "utf8"));
const primary = profile?.config?.llm?.primary;
const family = requireString(primary?.family_id, "profile config.llm.primary.family_id");
const model = requireString(primary?.model_id, "profile config.llm.primary.model_id");
const provider = normalizeProvider(family);
const credentialName = requireString(primary?.route?.api_key_env, "profile primary route api_key_env");
const credential = requireString(profile?.config?.env_vars?.[credentialName], `profile config.env_vars.${credentialName}`);
if (credential.startsWith("keychain:")) {
  throw new Error(`Credential ${credentialName} is keychain-backed; run through the Octos profile launcher`);
}

process.env.OLL_PROVIDER = provider;
process.env.OLL_MODEL = model;
process.env.OCTOS_PROFILE_LLM_PROVIDER = family;
process.env.OCTOS_PROFILE_LLM_MODEL = model;
process.env[credentialName] = credential;
delete process.env.OLL_FALLBACK_PROVIDER;

const esbuildPath = resolve(learningCoachRoot, "node_modules/esbuild/lib/main.js");
const { build } = await import(pathToFileURL(esbuildPath).href);
const entry = [
  `export { generateLessonPlanWithVertex } from ${JSON.stringify(resolve(learningCoachRoot, "src/lesson-plan-live.ts"))};`,
  `export { createStructuredModelRouter } from ${JSON.stringify(resolve(learningCoachRoot, "src/main.ts"))};`,
].join("\n");
const bundle = await build({
  stdin: { contents: entry, resolveDir: learningCoachRoot, sourcefile: "course-library-authoring-entry.ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  write: false,
  logLevel: "silent",
});
const live = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

const underlyingRouter = await live.createStructuredModelRouter();
const rawModelCalls = [];
const router = {
  primaryClient: underlyingRouter.primaryClient,
  fallbackClient: underlyingRouter.fallbackClient,
  hedgeDelayMs: underlyingRouter.hedgeDelayMs,
  rejectLastResponse: () => underlyingRouter.rejectLastResponse(),
  call: async (request) => {
    const startedAt = Date.now();
    try {
      const response = await underlyingRouter.call(request);
      rawModelCalls.push({
        request,
        response,
        elapsed_ms: Date.now() - startedAt,
        request_metrics: requestMetrics(request),
        status: "completed",
      });
      return response;
    } catch (error) {
      rawModelCalls.push({
        request,
        elapsed_ms: Date.now() - startedAt,
        request_metrics: requestMetrics(request),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

const rejectedParts = [];
const programAdjustments = [];
const playablePrefixes = [];
const startedAt = Date.now();
const turnId = `course-library-${input.id ?? "candidate"}-${Date.now()}`;
let generated;
try {
  generated = await live.generateLessonPlanWithVertex({
    turn_id: turnId,
    learner_request: learnerRequest,
    request_parts: requestParts,
    language,
  }, {
    router,
    on_rejected_part: (event) => rejectedParts.push(event),
    on_program_adjustment: (event) => programAdjustments.push(event),
    on_playable_prefix: ({ completed_sections }) => playablePrefixes.push({
      completed_sections,
      elapsed_ms: Date.now() - startedAt,
    }),
  });
} catch (error) {
  await mkdir(outputDirectory, { recursive: true });
  await writeJson(resolve(outputDirectory, "generation-report.json"), {
    status: "failed",
    generated_at: new Date().toISOString(),
    elapsed_ms: Date.now() - startedAt,
    provider,
    model,
    learning_coach: learningCoachState,
    error: error instanceof Error ? error.message : String(error),
    rejected_parts: rejectedParts,
    program_adjustments: programAdjustments,
    playable_prefixes: playablePrefixes,
    request_metrics: summarizeModelCalls(rawModelCalls),
  });
  await writeJson(resolve(outputDirectory, "raw-model-calls.json"), rawModelCalls);
  throw error;
}

await mkdir(outputDirectory, { recursive: true });
await writeJson(resolve(outputDirectory, "generation-input.json"), input);
await writeJson(resolve(outputDirectory, "raw-model-calls.json"), rawModelCalls);

if ("disposition" in generated) {
  await writeJson(resolve(outputDirectory, "generation-report.json"), {
    status: generated.disposition,
    generated_at: new Date().toISOString(),
    elapsed_ms: Date.now() - startedAt,
    provider,
    model,
    learning_coach: learningCoachState,
    model_calls: generated.model_calls,
    learner_response: generated.learner_response,
    rejected_parts: rejectedParts,
    program_adjustments: programAdjustments,
    playable_prefixes: playablePrefixes,
    request_metrics: summarizeModelCalls(rawModelCalls),
  });
  throw new Error(`Generator returned '${generated.disposition}': ${generated.learner_response}`);
}

await writeJson(resolve(outputDirectory, "outline.json"), generated.outline);
await writeJson(resolve(outputDirectory, "section-drafts.json"), generated.drafts);
await writeJson(resolve(outputDirectory, "resolved-plan.json"), generated.resolved);
await writeJson(resolve(outputDirectory, "course.authoring.json"), generated.lesson);
await writeJson(resolve(outputDirectory, "generation-report.json"), {
  status: "generated",
  generated_at: new Date().toISOString(),
  elapsed_ms: Date.now() - startedAt,
  provider,
  model,
  learning_coach: learningCoachState,
  model_calls: generated.model_calls,
  sections: generated.lesson.steps.length,
  beats: generated.lesson.steps.reduce((sum, step) => sum + step.beats.length, 0),
  rejected_parts: rejectedParts,
  program_adjustments: programAdjustments,
  playable_prefixes: playablePrefixes,
  request_metrics: summarizeModelCalls(rawModelCalls),
  credential_source: "local-development-profile",
});

process.stdout.write(`${JSON.stringify({
  status: "generated",
  output: outputDirectory,
  provider,
  model,
  sections: generated.lesson.steps.length,
  elapsed_ms: Date.now() - startedAt,
})}\n`);
