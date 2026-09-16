# CoursePack server publishing

The publisher writes validated, immutable CoursePack versions to a local
directory. The Octos Learn Nginx configuration serves only `catalog.json` and
`releases/` from that directory. This first distribution workstream does not
introduce a second network service or store packs as learner sessions.

## Build and publish

Initialize a `200` empty catalog before the first reviewed release:

```bash
pnpm install --frozen-lockfile
pnpm course-pack:publish init --root /opt/octos-learn/course-packs
```

This command is idempotent and never publishes the contract fixture.

Use an approved source directory, not the contract-smoke fixture as a public
curriculum:

```bash
pnpm install --frozen-lockfile
pnpm course-pack build courses/approved-course --out /tmp/approved-course-1.0.0.ocpack
pnpm course-pack:publish publish /tmp/approved-course-1.0.0.ocpack --root /opt/octos-learn/course-packs
```

The publisher validates the archive before exposing it. Its root must be an
operator-owned directory on the same filesystem as its `releases/` staging
directory. All parent directories must be traversable by the Nginx worker.
Published files are world-readable; `catalog.source.json` and `audit.ndjson`
are operator-readable only. The lock directory `.publish-lock` serializes
publishers. If a process dies while holding the lock, an operator must confirm
that no publisher is running before removing that *specific* stale lock.

The output layout is:

```text
course-packs/
├── catalog.json                  public discovery (short cache)
├── catalog.source.json           private source including withdrawn releases
├── audit.ndjson                  private append-only operator audit
└── releases/
    └── <pack-id>/<version>/
        ├── archive.ocpack
        ├── manifest.json
        └── files/<declared path>
```

The catalog includes metadata, versions, recommended flags, SHA-256 archive
digests and immutable same-origin URLs. A new version becomes recommended for
its `packId`; older listed versions remain discoverable. The server exposes:

```text
GET /api/learn/course-packs
GET /api/learn/course-packs/<pack-id>/<version>/archive.ocpack
GET /api/learn/course-packs/<pack-id>/<version>/manifest.json
GET /api/learn/course-packs/<pack-id>/<version>/files/<path>
```

Publishing the same version and digest is idempotent. A different archive
digest for the same `packId + version` is rejected; create a new version to
correct course content. A crash after the complete release directory is
exposed but before catalog replacement can be retried with the *same* archive
to recover discovery.

## Withdrawal

```bash
pnpm course-pack:publish withdraw approved-course 1.0.0 --root /opt/octos-learn/course-packs
```

Withdrawal removes the release from public discovery and chooses the highest
remaining active version as recommended. It does not delete the release files,
so existing learner instances pinned to that version continue to resolve it.
Only an operator can update the catalog; there is no public write endpoint.

## Verification

After configuring the Nginx alias and reloading Nginx, verify the catalog is
`200 application/json` with a short cache policy, and an archive is `200` with
a one-year immutable cache policy. Fetch the archived bytes and compare their
SHA-256 with the catalog digest. A withdrawn release must disappear from the
catalog but its immutable archive URL must still return the same bytes.

This workstream provides digest validation and operator audit; manifest
signatures and a remote publication authority remain release gates before
untrusted third-party packs are accepted.
