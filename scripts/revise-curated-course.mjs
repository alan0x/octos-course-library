// Revise a curated course with a reviewed edit module (authoring changes that
// keep every narration text unchanged), then produce a new immutable version
// through the shared revision pipeline.
//
// node scripts/revise-curated-course.mjs --edits authoring/reviews/<id>-<date>.mjs \
//   --authoring courses/<id>/course.authoring.json --source courses/<id> \
//   --output courses/revisions/<id>/<version> --archive /tmp/<id>-<version>.ocpack \
//   --version <version> --player-root ../octos-learn
//
// An edit module exports `packId`, `summary` (one line for NOTICE.txt) and
// `apply(authoring, tools)`, which mutates the authoring clone and returns a
// list of human-readable changes. `tools` offers beat/task lookups that fail
// loudly when the expected content is not found, and `removeBeat(key)` for a
// reviewed beat removal: that beat's narration clip is dropped and every
// remaining narration must stay unchanged.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { authoringTools, reviseCuratedCourse } from "./curated-revision.mjs";

function argumentsByName(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Expected --name value, received ${key ?? "<end>"}`);
    }
    result[key.slice(2)] = value;
  }
  for (const key of ["edits", "authoring", "source", "output", "archive", "version", "player-root"]) {
    if (!result[key]) throw new Error(`Missing --${key}`);
  }
  return result;
}

const args = argumentsByName(process.argv.slice(2));
const edits = await import(pathToFileURL(resolve(args.edits)).href);
const sourceAuthoring = JSON.parse(await readFile(resolve(args.authoring), "utf8"));
const authoring = structuredClone(sourceAuthoring);
const tools = authoringTools(authoring);
const changes = edits.apply(authoring, tools);
const removed = new Set(tools.removedBeats);
const sayBefore = JSON.stringify(sourceAuthoring.steps.map((step) => step.beats
  .filter((beat) => !removed.has(`${step.key}/${beat.key}`)).map((beat) => beat.say)));
assert.equal(JSON.stringify(authoring.steps.map((step) => step.beats.map((beat) => beat.say))), sayBefore,
  "Edits must not change narration; synthesize new audio for narration changes");
const result = await reviseCuratedCourse({
  packId: edits.packId,
  authoring,
  source: args.source,
  output: args.output,
  archive: args.archive,
  version: args.version,
  playerRoot: args["player-root"],
  noticeLine: `Content review: ${edits.summary} (${args.version}); narration unchanged.`,
  removedBeats: tools.removedBeats,
});
process.stdout.write(`${JSON.stringify({ ...result, changes }, null, 2)}\n`);
