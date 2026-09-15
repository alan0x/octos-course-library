# Octos Course Library

Curated course sources, the versioned Octos CoursePack contract, validation,
and publishing tools for Octos Learn.

The repository is intentionally separate from the Octos Learn player:

- `octos-course-library` owns reviewed course content and immutable pack
  artifacts;
- `octos-lesson-language` owns the OLL language and playback semantics;
- `octos-learn` downloads, caches, imports, and plays published packs.

## Current scope

The contract workstream implements `OctosCoursePack v1` and a CLI that validates
source directories and builds `.ocpack` ZIP archives. The distribution
workstream adds an operator-only static publication tool. The fixture under
`courses/contract-smoke` is contract test data, not a published curriculum.

## Development

```bash
pnpm install
pnpm test
pnpm course-pack validate courses/contract-smoke
pnpm course-pack build courses/contract-smoke --out artifacts/contract-smoke-0.0.1.ocpack
```

The publication CLI can publish reviewed archives into a static same-origin
distribution directory. See [server publishing](docs/SERVER_PUBLISHING.md).

## Browser player integration

The repository root is installable directly from a pinned public Git commit.
Player applications should import the browser-safe entry point only:

```ts
import { loadCoursePackArchive } from "octos-course-library/browser";

const response = await fetch("/course-packs/example.ocpack");
const pack = await loadCoursePackArchive(await response.arrayBuffer());
```

This entry point verifies archive limits, paths, schemas, declared file hashes,
and OLL playback semantics without importing Node filesystem APIs. The Node CLI
remains the authoritative publication gate.
