# Setup file fixtures

One setup file per schema version ever released, as that version saved it.
`setup-files.test.ts` checks that each still opens with every component and
beam intact: the promise in `docs/adr/0001-setup-files-stay-compatible.md`.

- **Bumping the schema version?** Add a migration, then add a new
  `setup-vN.json` saved by the new version and cover it in the test.
- **Never edit an existing fixture.** It stands for files people already
  hold; if the test fails on one, the parser is what broke.
