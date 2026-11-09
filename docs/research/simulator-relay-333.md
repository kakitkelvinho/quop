# What an ideal relay needs from a setup file (#333)

Findings note, 2026-11-09. Input for the experiment simulator (#331); not a plan. Where the missing numbers are stored is left to #334.

Worked from the builder's types (`src/components/builder/types.ts`) and the angular spectrum code in `kakitkelvinho/backpropagation` (`Functions/propTF.m`). The sampling numbers are hand calculations, not measurements.

## Answer

1. A Tabletop beam already reduces to what a ray-matrix model needs: an ordered list of lenses with focal lengths and the distances between them. The objective is the exception and needs its own element.
2. About twenty numbers are missing from a setup, across six kinds of component (table below).
3. One interface serves both models if the sample's light is described as a list of mutually incoherent modes. Plain angular spectrum propagation is feasible in a browser between the lenses, but not through the objective; that step should be a single Fourier transform.

## 1. From a beam to a ray matrix

`beamPoints(components, beam.path)` gives the reference points a beam runs through and `beamLegLengthsMm` the distances between them. Walking the path:

| Component on the beam | Element |
| --- | --- |
| `lens` | thin lens, `focalLength` (mm, already in the setup) |
| the gap between two stops | free space, the leg length |
| `mirror-mount`, `periscope`, `periscope-top` | nothing (a fold) |
| `beam-splitter`, `waveplate`, `filter`, `iris` | nothing in the ray matrix; a transmission or an aperture |
| `delay-line` | free space, its added path |
| `objective` | see below |
| `sample` | the input plane |
| `spectrometer` | the output plane: its entrance port is the slit |

With system matrix $\begin{pmatrix}A & B\\ C & D\end{pmatrix}$ from sample to slit, acting on (position, angle):

- $B = 0$: the slit is an **image** of the sample, magnification $A$. The frame is energy against position.
- $A = 0$: the slit is a **Fourier plane**. A ray leaving at angle $\theta$ lands at $x = B\,\theta$ wherever it started. The frame is energy against angle.
- Neither: with emitting spot radius $w$, the angle picture is blurred by $\delta\theta = A\,w/B$. So the ideal relay already shows what a misplaced lens does, before any wave optics.

### The objective

A thin lens at the objective's reference point is wrong twice over. The reference point is its threaded plate, not a principal plane, so the sample-to-plate distance in the drawing is not the focal length. And at NA 0.4 the paraxial $x = f\theta$ is off by 3 % against the true $x = f\sin\theta$ of a corrected objective (10 % against $f\tan\theta$).

Treat it as one element that takes the sample plane to the back focal plane:

$$x_\text{BFP} = f_\text{obj}\,\sin\theta, \qquad \lvert\sin\theta\rvert \le \text{NA}$$

with the back focal plane a fixed offset from the plate, and a defocus term for a sample that is not at the focus. Everything after it is paraxial (angles under about 10 mrad), so ray matrices are accurate there.

### A worked path

Objective $f_\text{obj} = 4$ mm, NA 0.42; lens $f_1 = 150$ mm one focal length after the back focal plane; an image plane $f_1$ later; lens $f_2 = 300$ mm one focal length after that; slit $f_2$ later.

- Back focal plane to slit is a 4f relay, magnification $-f_2/f_1 = -2$.
- Position on the slit: $x = -2 \times 4\ \text{mm} \times \sin\theta$, so the full aperture is 6.7 mm tall.
- With 13 µm pixels: 0.0016 in $\sin\theta$ per pixel, or 0.02 µm⁻¹ at 494 nm. The papers' thermal tail, $\lvert k\rvert \le 2$ µm⁻¹, spans ±97 pixels.
- In energy, 1200 grooves/mm at 500 mm focal length gives about 0.02 nm per pixel; the 7.6 meV tail is 1.5 nm, about 75 pixels.

## 2. What a setup does not hold

`COMPONENT_SPECS` gives a `lens` its `focalLength`. Every other optical number is absent.

| Component | Missing | Used for |
| --- | --- | --- |
| `objective` | focal length; NA; back-focal-plane offset from the plate | angle-to-position scale; largest angle collected; where the relay starts |
| `spectrometer` | focal length; groove density; centre wavelength; slit width; included angle | dispersion and spectral resolution (#338) |
| `camera`, or the spectrometer's own sensor | pixel size; pixel counts; quantum efficiency; read noise | the frame's axes and noise (#338) |
| `laser-source` | wavelength; power or pulse energy; pulse duration; spot size at the sample | pump rate in the model (#332) |
| `iris`, `filter`, `beam-splitter` | aperture diameter; pass band; split ratio | clipping; blocking the pump; collection efficiency |
| `lens` | clear aperture (a 1-inch default would do) | clipping |
| `sample` | nothing optical; its physics model belongs to the simulator | |

Two things come from geometry and need no new field: the lens spacings, and the pump's angle of incidence, from the direction of the pump beam against the sample's rotation.

A Tabletop spectrometer and camera are separate components. A beam that ends on a spectrometer has no camera on it, so the sensor's numbers need a home on the spectrometer or in the simulator.

## 3. One interface for the ideal relay and wave optics

### What goes in

The sample's light as a list of **modes that do not interfere with each other**, each with:

- a complex field over the sample plane, $u(x)$;
- a spectrum (centre energy, linewidth);
- a weight (photons emitted).

The condensate is one mode: the pump-spot envelope, flat phase. Each thermal state is one mode: the same envelope times $e^{ikx}$. This is what the populations of #332 turn into, and it carries the spot size, which a bare $I(\theta, E)$ map (#336) does not.

### What comes out

Intensity on the slit plane against position along the slit and energy, plus a report: image, Fourier plane or neither; the scale; the defocus; where the light was clipped.

```ts
interface DetectionPath {
  toSlit(modes: EmissionMode[]): SlitLight;   // I(position along slit, energy)
  report(): PathReport;                       // kind, scale, defocus, clipping
}
```

- **Ideal relay**: each mode is a spot of radius $w$ at angle $\theta$; it lands at $A x + B\sin\theta$ as a blur of width $A w$. Closed form, instant.
- **Wave optics**: each mode's field is propagated plane by plane and its intensity added. Same input, same output.

### Sampling for the wave version

At 494 nm, a 25 µm spot, NA 0.42, lenses of 150 to 300 mm:

| Stage | Field extent | Sample spacing needed | Grid |
| --- | --- | --- | --- |
| at the sample | 25 µm spot | $\lambda/2\text{NA} = 0.59$ µm | small |
| just after the objective | 3.4 mm pupil | still 0.59 µm if the objective is done as a phase mask | 8192², about 1 GB: **not feasible** |
| between the relay lenses | 3.4 mm pupil, images up to 1 mm | $\lambda/2\sin\theta_\text{max} = 22$ µm for cones of 11 mrad | 1024² at 10 µm over 10 mm: fine |

So:

- **Through the objective, use one Fourier transform**, not a lens phase mask. A 1024-point sample grid at 0.25 µm maps to a back-focal-plane grid of $\lambda f/(N\,\delta x) = 7.7$ µm over 7.9 mm, which is already the grid the rest of the path wants, and has $\sin\theta$ built in.
- **Between lenses, plain angular spectrum works** as in `propTF.m`, up to a distance of about $L/(2\tan\theta_\text{max})$ before the field wraps round the grid: 0.45 m for a 10 mm grid and 11 mrad. Longer legs need a wider grid or a band-limited transfer function.
- **Cost.** A 1024² FFT in plain TypeScript is of order 100 ms (an estimate; #339 records the real figure), so a six-leg path is about a second per mode. The 160 thermal states of the ladder would take minutes in 2D: a button and a worker, not a slider.
- **Start in 1D.** Only the direction along the slit matters for the frame. A 1D field of 2¹⁶ points propagates in a few milliseconds, so all modes run live. 2D is for effects that are not separable (astigmatism, a tilted lens).
- **One wavelength is enough.** The band of interest is 0.4 % wide; propagate at the centre and let the spectrometer disperse.

## For the tickets

- **#337**: add the objective element ($x = f\sin\theta$, NA, back-focal-plane offset, defocus) and the blur $A w$ for a path that is neither an image nor a Fourier plane.
- **#339**: add the single-transform objective step with its output grid spacing $\lambda f/(N\,\delta x)$; make the 1D propagator the first deliverable.
- **#336 / #340**: the emission should also be available as a list of modes (field, spectrum, weight), with the $I(\theta, E)$ map derived from it.
- **#334** decides where these numbers live. Most of them describe instruments (objective, spectrometer, camera, laser) and would be the same in every setup that contains that instrument.
