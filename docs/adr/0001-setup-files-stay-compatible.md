# Setup files stay compatible from 1.0 on

quop is a static site with no accounts or server, so the one thing people keep from it is the setup file they export from the Experiment Builder. From v1.0, any setup file saved by a release keeps opening in every later release with nothing dropped. The alternative was to treat setup files as best-effort, but a colleague's saved setup silently losing components after an update is exactly the failure that would cost trust after launch, and the schema version and migration in the parser already make the promise cheap to keep.

## Consequences

- Any change to the shape of a setup bumps the schema version and adds a migration from the previous one; old files are never rejected.
- The parser is lenient and drops what it does not recognise, so it cannot guard the promise on its own. Checked-in fixture files, one per schema version, must open with every component and beam intact, and CI runs that test before deploying.
- Only old files opening in new releases is promised, not the reverse, and the export filename is not part of it.
