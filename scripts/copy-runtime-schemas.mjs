import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaNames = [
  "course-pack-board-v1.schema.json",
  "course-pack-manifest-v1.schema.json",
];

const sourceDirectory = resolve(root, "packages/course-pack/schema");
const outputDirectory = resolve(root, "packages/course-pack/dist/schema");

await mkdir(outputDirectory, { recursive: true });
await Promise.all(schemaNames.map((name) => copyFile(
  resolve(sourceDirectory, name),
  resolve(outputDirectory, name),
)));

// Git dependencies are prepared in a temporary checkout before pnpm stores
// them. Copying the runtime schemas explicitly keeps the generated imports in
// dist/src usable even when a package manager omits TypeScript's JSON output.
console.log(`Copied ${schemaNames.length} runtime schemas to ${outputDirectory}`);
