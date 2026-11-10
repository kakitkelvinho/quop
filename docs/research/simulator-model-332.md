# Which rate equations model the polariton power series (#332)

Findings note, 2026-11-09. Input for the experiment simulator (#331); not a plan.

Sources, all read in full:

- **[PRB]** Shishkov, Andrianov, Zasedatelev, *Room-temperature optomechanics with light-matter condensates*, Phys. Rev. B 110, 134321 (2024).
- **[PRL24]** Shishkov, Andrianov, Tretiak, Whaley, Zasedatelev, *Sympathetic mechanism for vibrational condensation enabled by polariton optomechanical interaction*, Phys. Rev. Lett. 133, 186903 (2024). Back to back with [PRB]; same equations.
- **[PRL22]** Shishkov, Andrianov, Zasedatelev, Lagoudakis, Lozovik, *Exact analytical solution for the density matrix of a nonequilibrium polariton Bose-Einstein condensate*, Phys. Rev. Lett. 128, 065301 (2022).

Marked **(read)** where a statement comes from the papers and **(run)** where it comes from the throwaway script `research/simulator-model/ladder.py`.

## Answer

Use three tiers of the same model. Each is the one above it with terms removed, so the simulator can grow without changing shape.

| Tier | Populations | What it gives on the frame | Status |
| --- | --- | --- | --- |
| 0. Two populations | dark excitons, polaritons at $k=0$ | threshold, input–output curve | this is #335 as filed |
| **1. Ladder (recommended for the first slice)** | dark excitons, $N+1$ energy bins up the lower polariton branch | all of tier 0, plus the thermal tail along the dispersion, its collapse into $k=0$, and the effective temperature | new ticket |
| 2. Full [PRB] | tier 1 plus bright excitons at the pump wave vector, dark and bright vibrations | vibrational condensation; needs a Raman probe arm to see | later slice |

Tier 0 alone cannot draw a dispersion image: it has no occupation along the branch. Tier 1 is about 100 coupled equations and solves in milliseconds.

## The model

Rates are written as energies (divide by $\hbar = 0.658\ \text{eV fs}$ for a rate). Occupations $n$ are numbers of quanta; $n_{\text{Exc}_D}$ and $n_{\text{Vib}_D}$ are per molecule.

### Tier 1: reservoir and a thermalising ladder

From [PRB] Eqs. (C12)–(C13), with the vibrational occupations set to zero (thermal occupation of a 200 meV vibration at 290 K is $3\times10^{-4}$) and the pump fed straight into the dark excitons. The bins $j = 0 \dots N$ are equally spaced in energy from the bottom of the lower branch; $D_j$ is the number of polariton states in bin $j$.

$$\frac{dn_{\text{Exc}_D}}{dt} = \gamma_\text{Exc}\Big(\frac{\varkappa}{N_\text{mol}} - n_{\text{Exc}_D}\Big) - \sum_m \frac{G_m}{N_\text{mol}}\, n_{\text{Exc}_D}\,(n_m + D_m)$$

$$\frac{dn_j}{dt} = -\gamma_j n_j + G_j\, n_{\text{Exc}_D}\,(n_j + D_j) + \sum_m \Big[\gamma_\text{th}^{jm}\,(n_j + D_j)\,n_m - \gamma_\text{th}^{mj}\,(n_m + D_m)\,n_j\Big]$$

- $\varkappa$: pump parameter. $\varkappa/N_\text{mol}$ is the fraction of molecules that would be excited with no cavity; the absorbed photon rate is $\gamma_\text{Exc}\varkappa$.
- $G_j$: the vibron-assisted scattering constant, [PRB] Eq. (39). It is a Lorentzian in the detuning from the vibron resonance, of width $\Gamma_\text{Exc}$:
  $$G_k = \frac{\Lambda^2\,\Omega_R^2\,\Gamma_\text{Exc}\cos^2\varphi_k}{(\omega_\text{Exc} - \omega_{\text{Pol}|k} - \omega_\text{Vib})^2 + (\Gamma_\text{Exc}/2)^2}$$
- $\gamma_j = \gamma_\text{Cav}\cos^2\varphi_j + \gamma_\text{Exc}\sin^2\varphi_j$: polariton decay; $\cos^2\varphi$ is the photon fraction.
- $\gamma_\text{th}^{jm}$: thermalisation from bin $m$ to bin $j$. Downward it is a constant; upward it is that constant times $e^{-(E_j - E_m)/k_BT}$.
- $D_0 = 1$, $D_{j>0} = S\,\delta E/(4\pi\alpha_\text{Pol})$ for pumped area $S$, bin width $\delta E$ and branch curvature $\alpha_\text{Pol}$.

**Tier 0** is this with one bin. Then #335's parameters are $R = G_0/N_\text{mol}$, $\gamma_R = \gamma_\text{Exc}$, $\gamma_0 = \gamma_{j=0}$, $P = \gamma_\text{Exc}\varkappa$, and its threshold $P_\text{th} = \gamma_R\gamma_0/R$ is [PRL24] Eq. (8), $\varkappa_\text{th} = N_\text{mol}\,\gamma_0/G_0$.

**Tier 2** adds [PRB] Eqs. (31), (34), (35): bright excitons at $k_\text{ex}$, dark vibrations, and bright vibrations at $k_\text{ex} - k$.

### Defaults ([PRB] Table II) (read)

| Symbol | Meaning | Value | As a time |
| --- | --- | --- | --- |
| $\hbar\omega_\text{Cav}(0)$, $\alpha_\text{Cav}$ | cavity energy at normal incidence, curvature | 2.52 eV, 2 meV µm² | |
| $\hbar\omega_\text{Exc}$ | dressed exciton | 2.72 eV | |
| $\hbar\Omega_R$ | Rabi energy (half the splitting at resonance) | 50 meV | |
| $\hbar\omega_\text{Vib}$, $\Lambda^2$ | vibration quantum, Huang–Rhys factor | 200 meV, 1 | |
| $N_\text{mol}$, $S$ | molecules, pumped area | $10^8$, 500 µm² | |
| $\gamma_\text{Cav}$ | cavity decay | 2.5 meV | 0.26 ps |
| $\gamma_\text{Exc}$ | exciton decay | 0.01 meV | 66 ps |
| $\Gamma_\text{Exc}$ | exciton dephasing | 10 meV | 66 fs |
| $\gamma_\text{Vib}$ | vibration decay | 2 meV (3 meV in the text of Sec. II) | 0.33 ps |
| $\gamma_\text{th}$ | thermalisation, per pair of states | 0.01 meV | |
| $T$ | environment | 290 K | |
| ladder | $N = 100$ bins over $\lvert k\rvert \le 2$ µm⁻¹ | 7.6 meV span, 160 states | |

Derived: lower polariton at $k=0$ is 2.508 eV (494 nm), photon fraction 0.95.

### What the check showed (run)

`python3 research/simulator-model/ladder.py` solves tier 1 for the steady state.

- The threshold lands on $\varkappa_\text{th}/N_\text{mol} = \gamma_0/G_0$, and above it the reservoir clamps at that value while $n_0$ grows linearly. Ground-state occupation goes from about 1 to several thousand within a decade of pump, as in [PRL24] Fig. 2 and [PRB] Fig. 6.
- **The threshold is very sensitive to the vibron detuning.** With Table II's energies as printed, $G_0 = 0.14$ eV and the threshold is 1.6 % of molecules excited. Table II itself quotes $G_0 = 0.5$ eV, which needs the detuning to be 5 meV, not the 12 meV the printed energies give. On exact resonance $G_0 = 0.95$ eV and the threshold is 0.25 %. So a 5 meV change in cavity energy moves the threshold by a factor of 2 to 3; energies quoted to 10 meV do not fix it.
- The occupation along the branch steepens across threshold. A straight-line fit to $\ln n(E)$ over the 7.6 meV window gives about 95 K below threshold and about 29 K above when the resonance sits at or below the branch minimum. This is the same direction as the stimulated cooling of [PRL22] and [PRL24] Fig. 3, but not their numbers (140 K, and 0.6 of that); they fit a Bose–Einstein form with a free chemical potential, and include terms tier 1 drops.
- **Below threshold the slope is not a temperature.** Thermalisation is slower than decay there, so the occupation follows the feeding profile $G_j/\gamma_j$. With the resonance above the branch minimum the fitted "temperature" is negative.

## What each term does to the frame

"Frame" is a time-integrated energy–angle image of the lower branch.

| Term | Sets | On a time-integrating spectrometer? |
| --- | --- | --- |
| $G_0$: $\Lambda^2$, $\Omega_R$, detuning from the vibron resonance | threshold; threshold against detuning is a Lorentzian of width $\Gamma_\text{Exc}$ | **Yes.** Power series at several cavity detunings (thickness gradient) or pump energies |
| $\gamma_\text{Cav}$ | threshold; linewidth below threshold (2.4 meV = 0.47 nm at 494 nm) | **Yes**, if the spectrometer resolves better than about 0.2 nm |
| photon fraction $\cos^2\varphi_k$ | brightness along the branch for a given occupation | **Yes**, and it must be divided out before any fit of $n(E)$ |
| $\gamma_\text{th}$, $T$ | slope of $n(E)$ along the branch, its change across threshold | **Yes, with care**: needs 3 to 4 decades of dynamic range in one frame, and the result depends on the fit form and window |
| $T_\text{eff}$, $\mu_\text{eff}$ ([PRL22] Eq. 14) | Bose–Einstein fit to $n(E)$ | **Yes**: this is the stimulated-cooling measurement. Over a few meV the three fit parameters are nearly degenerate |
| $\gamma_\text{Exc}$ | reservoir lifetime; with pulses, how long emission lasts | Only time-resolved |
| $N_\text{mol}$, $S$ | the scale between $\varkappa$ and absorbed fluence; number of states | Only as the absolute threshold fluence |
| pump wave vector $k_\text{ex}$ | which bright state is pumped, phase matching | Geometry of the pump beam in the setup; little effect on tier 1 |
| $\gamma_\text{Vib}$, $n_\text{Vib}$ | vibrational occupation, not the polariton threshold | **No.** Needs the Raman probe of [PRL24] Fig. 4 (anti-Stokes to Stokes ratio at the magic angle) |
| $g^{(2)}$, ground–excited anticorrelation ([PRL22] Figs. 3–4) | photon statistics | **No.** Needs photon correlation or shot-to-shot statistics |
| linewidth above threshold, blueshift | see below | Visible, but not in these models |

## What the models leave out

1. **Blueshift.** The Hamiltonians are harmonic; polariton interactions are neglected by assumption ([PRL22]). The measured blueshift has no term here. For the first slice it is an input to the emission map (#336), a phenomenological function of $n_{\text{Exc}_D}$ and $n_0$.
2. **Linewidth above threshold.** The equations give populations, not coherence. Below threshold the width is $\gamma_j$. Above it, treat the width as an input too.
3. **Pulses.** [PRB] assumes quasi-CW pumping (it cites nanosecond excitation). With a pulse shorter than 66 ps the reservoir is filled once and drains; the camera integrates a burst during which the populations, and in the lab the blueshift, change. The time-integrated frame is then a mix of below- and above-threshold moments. The solver in #335 already takes a pulsed pump; tier 1 should too.
4. **Lab units.** At threshold the absorbed fluence is roughly $(\gamma_0/G_0)\,\hbar\omega\,N_\text{mol}/S$. With Table II that is 20 to 140 nJ/cm², depending on the detuning. $N_\text{mol}$ is the papers' value; set it from the real film's chromophore density and thickness before comparing with a measured threshold.
5. **Pump angle.** [PRB] Sec. IV pumps at $k_\text{ex} = 16$ µm⁻¹. A 2.72 eV photon in air has at most 13.8 µm⁻¹ in-plane, so that wave vector cannot be reached from air; 45° incidence gives 9.7 µm⁻¹. Tier 2 should take $k_\text{ex}$ from the pump beam's angle in the setup.
6. **Space.** No pump-spot profile, disorder or real-space structure; the condensate's angular width is not predicted. Also absent: upper branch emission, uncoupled exciton emission, polarisation, bimolecular annihilation, bleaching.

## From populations to light

A polariton in state $k$ leaves as a photon at rate $\gamma_\text{Cav}\cos^2\varphi_k$. States are uniform in the $k$ plane, and a slit takes a strip through it, so the counts along the slit at angle $\theta$ and energy $E$ are proportional to the **occupation per state** $n_j/D_j$ times $\gamma_\text{Cav}\cos^2\varphi_j$, on a Lorentzian of width $\gamma_j$ centred on the branch. That is the input #336 asks for.

## For the tickets

- **#335** stands; it is tier 0. Its integrator must cope with stiffness: above threshold the stimulated terms reach 0.1 eV against a reservoir decay of 0.01 meV. An implicit step or a direct steady-state solve is needed for tier 1.
- **New ticket**: tier 1, with Table II defaults, tested against $\varkappa_\text{th} = N_\text{mol}\gamma_0/G_0$ and reservoir clamping.
- **#336**: occupation per state and $\gamma_\text{Cav}\cos^2\varphi$ as above; use [PRB] Eqs. (7), (A12) for the branch and Hopfield angle, which match the ticket's formula with $\hbar\Omega = 2\hbar\Omega_R$.
- **Later**: tier 2 with a Raman probe arm; the [PRL22] recursion (Eqs. 12–13) as an independent check of tier 1 in the fast-thermalisation limit.
