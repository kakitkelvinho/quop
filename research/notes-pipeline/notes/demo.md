# Demo note

Prose with x < y, a {brace} and an HTML comment <!-- hidden -->. MARKER-1

Inline $\ket{\psi} \in \R^n$ uses config macros.

$$
\newcommand{\half}{\tfrac{1}{2}}
\begin{equation}
E = \half m v^2 \label{eq:energy}
\end{equation}
$$

Back reference $\eqref{eq:energy}$, forward reference $\eqref{eq:later}$.

$$
\begin{align}
a &= b + c \label{eq:a} \\
d &= \half e \nonumber \\
f &= g \label{eq:later}
\end{align}
$$

Macro from an earlier block, reused: $\half$. Reference $\eqref{eq:a}$.

$$
x = \half y
$$

::chart{data="1,2,3" title="directive"}

```chart
{"data": [4, 5, 6], "title": "fence"}
```
