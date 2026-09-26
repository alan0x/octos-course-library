import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { reviseCuratedCourse } from "./curated-revision.mjs";

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
  for (const key of ["authoring", "plan", "source", "output", "archive", "version", "player-root"]) {
    if (!result[key]) throw new Error(`Missing --${key}`);
  }
  return result;
}



function applyCameraPlan(sourceAuthoring, plan) {
  const authoring = structuredClone(sourceAuthoring);
  const listed = new Set(Object.keys(plan.focus));
  const discovered = new Set();
  const created = new Set();
  const changes = [];
  for (const step of authoring.steps) {
    for (const beat of step.beats) {
      const key = `${step.key}/${beat.key}`;
      const decision = plan.focus[key];
      const reviewedTargets = [];
      const actionCount = beat.actions.length;
      beat.actions = beat.actions.flatMap((action) => {
        // Groups and connections are focusable board targets as well as cards.
        if (["write", "group", "connect"].includes(action.do) && action.as) {
          assert.ok(!created.has(action.as), `Duplicate board alias ${action.as}`);
          created.add(action.as);
        }
        if (action.do !== "focus") return [action];
        assert.ok(listed.has(key), `${key} has an unreviewed focus action`);
        assert.ok(!discovered.has(key), `${key} has multiple focus actions`);
        discovered.add(key);
        const before = [...action.targets];
        if (decision === null) {
          changes.push({ beat: key, before, after: [] });
          // Authoring Profile requires a non-empty action list. Preserve a
          // narration-only Beat as a neutral teacher expression, which has no
          // board or camera effect, instead of reintroducing an unwanted focus.
          return actionCount === 1
            ? [{ do: "expression", expression: "neutral", when: action.when }]
            : [];
        }
        assert.ok(Array.isArray(decision?.targets) && decision.targets.length > 0,
          `${key} needs a non-empty reviewed target list`);
        reviewedTargets.push(...decision.targets);
        action.targets = [...decision.targets];
        action.when = decision.when ?? action.when;
        changes.push({ beat: key, before, after: action.targets, when: action.when });
        return [action];
      });
      // A reviewed Beat without any focus action may receive one explicitly
      // ("add": true); it is appended after the Beat's own actions.
      if (!discovered.has(key) && decision?.add) {
        assert.ok(Array.isArray(decision.targets) && decision.targets.length > 0, `${key} needs targets to add`);
        assert.ok(typeof decision.intent === "string" && decision.intent.trim(), `${key} needs an intent to add`);
        beat.actions.push({ do: "focus", targets: [...decision.targets], intent: decision.intent,
          when: decision.when ?? "during_speech" });
        reviewedTargets.push(...decision.targets);
        discovered.add(key);
        changes.push({ beat: key, before: [], after: [...decision.targets], when: decision.when ?? "during_speech", added: true });
      }
      assert.ok(!(discovered.has(key) && decision?.add && beat.actions.filter((a) => a.do === "focus").length > 1),
        `${key} already has a focus action; do not add another`);
      for (const target of reviewedTargets) {
        assert.ok(created.has(target), `${key} focuses a card that has not been created: ${target}`);
      }
      assert.equal(discovered.has(key), listed.has(key), `${key} camera review mismatch`);
    }
  }
  assert.deepEqual([...discovered].sort(), [...listed].sort(), "Camera review must cover every focus action exactly once");
  return { authoring, changes };
}

const args = argumentsByName(process.argv.slice(2));
const plan = JSON.parse(await readFile(resolve(args.plan), "utf8"));
const sourceAuthoring = JSON.parse(await readFile(resolve(args.authoring), "utf8"));
const { authoring, changes } = applyCameraPlan(sourceAuthoring, plan);
const result = await reviseCuratedCourse({
  packId: plan.packId,
  authoring,
  source: args.source,
  output: args.output,
  archive: args.archive,
  version: args.version,
  playerRoot: args["player-root"],
  noticeLine: `Camera review: ${plan.sourceCandidate}, ${args.version}; narration unchanged.`,
});
process.stdout.write(`${JSON.stringify({ ...result, focusChanges: changes }, null, 2)}\n`);
