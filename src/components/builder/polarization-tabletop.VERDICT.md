# Polarization Tabletop prototype verdict

Question: can polarization controls follow the Tabletop's normal select Component → Inspector → live Beam/Light readout workflow?

Verdict (22 Nov 2026): yes. The maintainer reviewed `polarization-tabletop.PROTOTYPE.html` and said it looks good. The earlier action-button demos did not resemble the Builder workflow and were replaced. The accepted demo lets an author select the λ/2 plate on the Table, set its fast axis in the Inspector, and watch P/S branch powers and detector readouts change. Adding a Polarizer exposes absorbed power in the same Light panel.

The HTML is a throwaway workflow source on `prototype/polarization-state`. It uses a pure Jones calculation, fixed Component positions, and no `traceScene` hit search. It does not validate production 3D basis transport or saved-file compatibility. Implementation belongs under [traced beams #357](https://github.com/kakitkelvinho/quop/issues/357); the branch power readout also informs [Power view #402](https://github.com/kakitkelvinho/quop/issues/402).

Agreed implementation scope from the design interview:

- A traced Beam carries normalized polarization and a fraction of its Laser source's power. Coherent recombination and interference are deferred.
- Laser input has an editable linear polarization angle; old Setups default to horizontal. A λ/2 plate and Polarizer use Component roll for their axes. Polarizer projection follows Malus' law.
- Beam cubes have a saved polarizing/non-polarizing mode; old Setups retain the current 50/50 behavior. Polarizing cubes transmit local P and reflect local S.
- A standalone Faraday rotator has an editable angle, default 45°. The existing Faraday isolator retains its ideal one-way behavior for now.
- Mirrors carry the polarization basis through 3D reflections, with optional S/P relative phase in degrees, default zero. Coating and wavelength dependence are not inferred.
- The first pass treats HWP, PBS and Faraday rules as lossless; Polarizer projection removes power. The Light/Power view shows branch fractions, and the selected Beam's details show polarization. Absolute mW waits for a Laser output-power setting.

Implementation needs a schema version bump, migration, fixture and Setup brief update for saved fields. The validated outcome here is the interaction model; the engine integration still needs to be built and checked.
