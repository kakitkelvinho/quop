#!/usr/bin/env python3
"""Render the homepage chalkboard's equations to public/equations/<id>.svg.

    python3 scripts/build-equations.py

Needs a TeX distribution with `latex`, `dvisvgm` and the EB Garamond fonts
(`ebgaramond`, `ebgaramond-maths`). The SVGs are committed, so this only has
to be run after an equation here changes. The ids must match EQUATIONS in
src/components/chalkboard-hero.tsx.
"""

import re
import subprocess
import sys
from pathlib import Path

from latex2svg import default_params, latex2svg

OUT = Path(__file__).resolve().parent.parent / "public" / "equations"

# EB Garamond, to match the site's serif (--font-serif), set up the way
# ebgaramond-maths recommends: newtxmath for the symbols, Garamond for the
# letters. Garamond has no \partial and no \mu (it sets a blank box), so
# those come from Computer Modern.
PREAMBLE = r"""
\usepackage[T1]{fontenc}
\usepackage{amsmath}
\usepackage[cmintegrals,cmbraces]{newtxmath}
\usepackage{ebgaramond-maths}
\DeclareSymbolFont{cmletters}{OML}{cmm}{m}{it}
\let\partial\relax
\DeclareMathSymbol{\partial}{\mathord}{cmletters}{"40}
\DeclareMathSymbol{\mu}{\mathalpha}{cmletters}{"16}
\usepackage{braket}
"""

EQUATIONS = {
    # set like eqnarray: the = in a column of its own, with room either side
    "maxwell": r"""
\renewcommand{\arraystretch}{1.6}
\begin{array}{r@{\quad}c@{\quad}l}
\nabla \cdot \mathbf{E} & = & \dfrac{\rho}{\varepsilon_0} \\
\nabla \cdot \mathbf{B} & = & 0 \\
\nabla \times \mathbf{E} & = & -\dfrac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} & = & \mu_0 \left(\mathbf{J} + \varepsilon_0 \dfrac{\partial \mathbf{E}}{\partial t}\right)
\end{array}
""",
    "qho": r"\hat{H} = \hbar\omega \left(\hat{a}^\dagger \hat{a} + \tfrac{1}{2}\right)",
    "waist": r"w(z) = w_0 \sqrt{1 + \left(z / z_R\right)^2}",
    "schrodinger": r"\hat{H} \ket{\psi} = E \ket{\psi}",
    "jaynes-cummings": r"\hat{H} = \hbar\omega_c \hat{a}^\dagger \hat{a} + \tfrac{1}{2}\hbar\omega_a \hat{\sigma}_z + \hbar g \left(\hat{a} \hat{\sigma}_+ + \hat{a}^\dagger \hat{\sigma}_-\right)",
    "gross-pitaevskii": r"i\hbar\, \partial_t \psi = \left(-\frac{\hbar^2 \nabla^2}{2m} + V + g\lvert\psi\rvert^2\right) \psi",
    "coherent": r"\ket{\alpha} = e^{-\lvert\alpha\rvert^2/2} \sum_n \frac{\alpha^n}{\sqrt{n!}} \ket{n}",
    "commutator": r"[\hat{a}, \hat{a}^\dagger] = 1",
    "photon": r"E = \hbar\omega = hc / \lambda",
    "fourier": r"\tilde{f}(\omega) = \int f(t)\, e^{-i\omega t} \, dt",
    "bose-einstein": r"\bar{n} = \frac{1}{e^{\hbar\omega / k_B T} - 1}",
    "heisenberg": r"\Delta x \, \Delta p \geq \hbar / 2",
}


def polish(svg: str, eq_id: str, width_em: float, height_em: float) -> str:
    """Make one SVG safe to inline next to the others and to colour with CSS."""
    # glyph ids are per-file; prefix them so several equations can share a page
    svg = re.sub(r"id='([^']+)'", lambda m: f"id='{eq_id}-{m.group(1)}'", svg)
    svg = re.sub(r"href='#([^']+)'", lambda m: f"href='#{eq_id}-{m.group(1)}'", svg)
    # size in em, so the chalk layer's font-size scales it; ink takes the text colour
    svg = re.sub(
        r"<svg ([^>]*?)width='[^']*' height='[^']*'",
        lambda m: f"<svg {m.group(1)}width='{width_em:.3f}em' height='{height_em:.3f}em' fill='currentColor'",
        svg,
        count=1,
    )
    # dvisvgm writes the glyph defs in no fixed order; sort them so a rebuild
    # only changes the files whose equations changed
    svg = re.sub(
        r"<defs>\n(.*?)</defs>",
        lambda m: "<defs>\n" + "".join(sorted(m.group(1).splitlines(keepends=True))) + "</defs>",
        svg,
        flags=re.S,
    )
    # dvisvgm's XML declaration and comment are noise once inlined
    svg = re.sub(r"<\?xml[^>]*\?>\s*", "", svg)
    svg = re.sub(r"<!--.*?-->\s*", "", svg, flags=re.S)
    return svg.strip() + "\n"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    params = {**default_params, "preamble": PREAMBLE}
    for eq_id, tex in EQUATIONS.items():
        try:
            out = latex2svg(rf"$\displaystyle {tex.strip()}$", params)
        except subprocess.CalledProcessError as error:
            # LaTeX reports on stdout; keep the "!" error line and what follows
            log = error.output.decode("utf-8", "replace")
            start = log.find("\n!")
            print(f"{eq_id}: failed\n{log[start:start + 600] if start >= 0 else log[-600:]}")
            return 1
        path = OUT / f"{eq_id}.svg"
        path.write_text(polish(out["svg"], eq_id, out["width"], out["height"]))
        print(f"{path.relative_to(OUT.parent.parent)}  {out['width']:.2f} x {out['height']:.2f} em")
    return 0


if __name__ == "__main__":
    sys.exit(main())
