# Octos Course Library

Curated course sources, the versioned Octos CoursePack contract, validation,
and publishing tools for Octos Learn.

The repository is intentionally separate from the Octos Learn player:

- `octos-course-library` owns reviewed course content and immutable pack
  artifacts;
- `octos-lesson-language` owns the OLL language and playback semantics;
- `octos-learn` downloads, caches, imports, and plays published packs.

## Current scope

The first workstream implements `OctosCoursePack v1` and a CLI that validates
source directories and builds `.ocpack` ZIP archives. The fixture under
`courses/contract-smoke` is contract test data, not a published curriculum.

## Development

```bash
pnpm install
pnpm test
pnpm course-pack validate courses/contract-smoke
pnpm course-pack build courses/contract-smoke --out artifacts/contract-smoke-0.0.1.ocpack
```

Published course content, signing, and server upload will be added in later
workstreams.
