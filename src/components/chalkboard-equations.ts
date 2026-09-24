import katex from "katex";

/** wide: one long line; narrow: a short line; tall: a stacked block. */
export type Shape = "narrow" | "tall" | "wide";

export type Equation = {
  accent?: boolean;
  html: string;
  id: string;
  shape: Shape;
  /** Relative to --eq-size, which scales with the viewport. */
  size: number;
};

type Source = Omit<Equation, "html"> & { tex: string };

const SOURCES: Source[] = [
  {
    id: "maxwell",
    shape: "tall",
    size: 0.72,
    // slashes and ∂ₜ rather than stacked fractions, so the block stays short
    // enough for the corners of the board
    tex: String.raw`\begin{aligned}
      \nabla \cdot \mathbf{E} &= \rho / \varepsilon_0 \\
      \nabla \cdot \mathbf{B} &= 0 \\
      \nabla \times \mathbf{E} &= -\partial_t \mathbf{B} \\
      \nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \, \partial_t \mathbf{E}
    \end{aligned}`,
  },
  {
    id: "qho",
    shape: "narrow",
    size: 1.05,
    tex: String.raw`\hat H = \hbar\omega \left( \hat a^\dagger \hat a + \tfrac{1}{2} \right)`,
  },
  {
    id: "waist",
    shape: "wide",
    size: 1,
    tex: String.raw`w(z) = w_0 \sqrt{1 + \left( \frac{z}{z_R} \right)^2}`,
  },
  {
    accent: true,
    id: "schrodinger",
    shape: "narrow",
    size: 1.2,
    tex: String.raw`\hat H \lvert \psi \rangle = E \lvert \psi \rangle`,
  },
  {
    id: "jaynes-cummings",
    shape: "wide",
    size: 0.85,
    tex: String.raw`\hat H = \hbar\omega_c \hat a^\dagger \hat a + \tfrac{1}{2} \hbar\omega_a \hat\sigma_z + \hbar g \left( \hat a \hat\sigma_+ + \hat a^\dagger \hat\sigma_- \right)`,
  },
  {
    id: "gross-pitaevskii",
    shape: "wide",
    size: 0.9,
    tex: String.raw`i\hbar \frac{\partial \psi}{\partial t} = \left( -\frac{\hbar^2 \nabla^2}{2m} + V + g \lvert \psi \rvert^2 \right) \psi`,
  },
  {
    id: "coherent",
    shape: "wide",
    size: 0.95,
    tex: String.raw`\lvert \alpha \rangle = e^{-\lvert \alpha \rvert^2 / 2} \sum_{n} \frac{\alpha^n}{\sqrt{n!}} \lvert n \rangle`,
  },
  {
    id: "commutator",
    shape: "narrow",
    size: 1.15,
    tex: String.raw`[\hat a, \hat a^\dagger] = 1`,
  },
  {
    id: "photon",
    shape: "narrow",
    size: 1.1,
    tex: String.raw`E = \hbar\omega = \frac{hc}{\lambda}`,
  },
  {
    id: "fourier",
    shape: "wide",
    size: 0.95,
    tex: String.raw`\tilde f(\omega) = \int_{-\infty}^{\infty} f(t)\, e^{-i\omega t} \, dt`,
  },
  {
    id: "bose-einstein",
    shape: "narrow",
    size: 1,
    tex: String.raw`\bar n = \frac{1}{e^{\hbar\omega / k_B T} - 1}`,
  },
  {
    id: "heisenberg",
    shape: "narrow",
    size: 1.1,
    tex: String.raw`\Delta x \, \Delta p \geq \frac{\hbar}{2}`,
  },
];

/** Typeset on the server, at build time: the board only ever sees finished
 *  HTML, so KaTeX's JavaScript never ships to the browser, only its CSS and
 *  the fonts the markup uses. The board is decorative, hence no MathML. */
export function renderEquations(): Equation[] {
  return SOURCES.map(({ tex, ...rest }) => ({
    ...rest,
    html: katex.renderToString(String.raw`\displaystyle ${tex}`, {
      output: "html",
      throwOnError: true,
    }),
  }));
}
