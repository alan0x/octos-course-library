# `@octos/course-pack`

The package defines and validates immutable Octos CoursePack v1 directories.

## CLI

```bash
octos-course-pack validate <directory> [--json]
octos-course-pack build <directory> --out <file.ocpack>
octos-course-pack inspect <file.ocpack> [--json]
```

`build` validates before writing and creates the destination atomically.
`inspect` validates the complete archive in memory. Client-side streaming and
signature verification are separate delivery workstreams.

## Contract guarantees

- safe, normalized POSIX paths;
- exact payload inventory with SHA-256 and byte lengths;
- immutable `packId + version` identity;
- complete local narration when `offlineNarration` is enabled;
- structurally valid board snapshots;
- compilable canonical OLL playback events;
- no user, session, task, RPC, or temporary server state in the manifest.
