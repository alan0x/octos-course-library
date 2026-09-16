#!/usr/bin/env node

import { resolve } from "node:path";
import {
  initializeCoursePackCatalog,
  publishCoursePack,
  withdrawCoursePack,
} from "./publisher.js";

function usage(): never {
  console.error(`Usage:
  octos-course-publish publish <file.ocpack> --root <publication-directory>
  octos-course-publish withdraw <pack-id> <version> --root <publication-directory>
  octos-course-publish init --root <publication-directory>`);
  process.exit(2);
}

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = rootIndex >= 0 ? args[rootIndex + 1] : undefined;
if (!root) usage();

const [action, first, second] = args;
if (action === "init") {
  console.log(JSON.stringify(initializeCoursePackCatalog(resolve(root)), null, 2));
} else if (action === "publish" && first) {
  console.log(JSON.stringify(publishCoursePack(resolve(first), resolve(root)), null, 2));
} else if (action === "withdraw" && first && second) {
  console.log(JSON.stringify(withdrawCoursePack(first, second, resolve(root)), null, 2));
} else {
  usage();
}
