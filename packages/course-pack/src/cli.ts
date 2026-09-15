#!/usr/bin/env node

import { resolve } from "node:path";
import {
  buildCoursePack,
  CoursePackValidationError,
  inspectCoursePackArchive,
  validateCoursePackDirectory,
} from "./validator.js";
import type { CoursePackValidationResult } from "./types.js";

function usage(): never {
  console.error(`Usage:
  octos-course-pack validate <directory> [--json]
  octos-course-pack build <directory> --out <file.ocpack>
  octos-course-pack inspect <file.ocpack> [--json]`);
  process.exit(2);
}

function printResult(result: CoursePackValidationResult, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.valid && result.manifest) {
    console.log(`valid ${result.manifest.packId}@${result.manifest.version} ${result.packSha256 ?? ""}`.trim());
    return;
  }
  for (const item of result.issues) {
    console.error(`${item.code} ${item.path}: ${item.message}`);
  }
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function main(args: string[]): void {
  const [command, input] = args;
  if (!command || !input) usage();
  const json = args.includes("--json");
  if (command === "validate") {
    const result = validateCoursePackDirectory(resolve(input));
    printResult(result, json);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === "inspect") {
    const result = inspectCoursePackArchive(resolve(input));
    printResult(result, json);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === "build") {
    const output = optionValue(args, "--out");
    if (!output) usage();
    try {
      const result = buildCoursePack(resolve(input), resolve(output));
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      if (error instanceof CoursePackValidationError) {
        printResult({ valid: false, issues: error.issues }, json);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
    return;
  }
  usage();
}

main(process.argv.slice(2));
