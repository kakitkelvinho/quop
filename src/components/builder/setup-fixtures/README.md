# Setup file fixtures

One setup file per schema version ever released, in the shape that version
saved. `setup-files.test.ts` checks that each still opens with every
component, beam and connection intact: the promise in
`docs/adr/0001-setup-files-stay-compatible.md`.

v1 to v5 are hand-written. v3 is the first with fibre and cable
connections, and carries a laser with a built-in path; v1 and v2 open with
no connections and no built-in paths. v4 is the first with a hidden beam: it
is v3's setup plus a reference arm with `"hidden": true`; v1 to v3 open with
every beam shown. v5 is the first with frames: v4's setup plus a shown frame and a
hidden one; v1 to v4 open with no frames. v1 also carries the beam cube names from
before files were versioned (`beamsplitter`, `pbs-cube`), which open as beam cubes.

- **Bumping the schema version?** Add a migration, then save a setup from the
  new version as `setup-vN.json` and add it to `FIXTURES` in the test.
- **Never edit an existing fixture.** It stands for files people already
  hold; if the test fails on one, the parser is what broke.
