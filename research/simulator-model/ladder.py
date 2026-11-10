"""Throwaway check for #332: steady state of the polariton ladder.

Dark-exciton reservoir + N+1 lower-polariton energy bins with thermalisation,
i.e. Eqs. (C12)-(C13) of Shishkov, Andrianov, Zasedatelev, PRB 110, 134321
(2024) with the vibrational occupations set to zero and the pump fed straight
into the dark excitons. Rates in eV (hbar = 1). Parameters: their Table II.
"""
import numpy as np

kT = 0.025                      # 290 K
E_exc, E_cav0, a_cav = 2.72, 2.52, 2e-3   # eV, eV, eV um^2
import os
Om, E_vib, HR = 0.05, float(os.environ.get("E_VIB", 0.2)), 1.0  # Rabi energy, vibration quantum, Huang-Rhys
N_mol, S = 1e8, 500.0           # molecules, pumped area um^2
g_exc, G_exc, g_cav, g_th = 1e-5, 1e-2, 2.5e-3, 1e-5
N, kmax = 100, 2.0

def branch(k):
    Ec = E_cav0 + a_cav * k**2
    d = E_exc - Ec
    E = (E_exc + Ec) / 2 - np.sqrt(d**2 / 4 + Om**2)
    phi = np.arctan(np.sqrt((d**2 + 4 * Om**2) / (4 * Om**2)) - d / (2 * Om))
    return E, np.cos(phi)**2    # energy, photon fraction

E0, c0 = branch(0.0)
Emax, _ = branch(kmax)
dE = (Emax - E0) / N
E = E0 + dE * np.arange(N + 1)
# invert the (nearly parabolic) branch for k at each bin energy
ks = np.linspace(0, kmax, 20001); Es, cs = branch(ks)
k = np.interp(E, Es, ks); cos2 = np.interp(E, Es, cs)
a_pol = (Emax - E0) / kmax**2
D = np.full(N + 1, S * dE / (4 * np.pi * a_pol)); D[0] = 1.0
G = HR * Om**2 * G_exc * cos2 / ((E_exc - E - E_vib)**2 + (G_exc / 2)**2)
gam = g_cav * cos2 + g_exc * (1 - cos2)
# W[j, m]: rate from bin m into bin j (KMS: upward is Boltzmann-suppressed)
W = g_th * np.where(E[:, None] <= E[None, :], 1.0, np.exp(-(E[:, None] - E[None, :]) / kT))
np.fill_diagonal(W, 0.0)

def rhs(y, kappa):
    nD, n = y[0], y[1:]
    feed = G * nD * (n + D)
    therm = (n + D) * (W @ n) - n * (W.T @ (n + D))
    return np.concatenate([[g_exc * (kappa / N_mol - nD) - feed.sum() / N_mol], -gam * n + feed + therm])

def steady(kappa, y=None):
    y = np.full(N + 2, 1e-9) if y is None else y.copy()
    dt = 1.0                                    # 1/eV = 0.66 fs
    for _ in range(400):                        # implicit Euler, growing step
        y0 = y.copy()
        for _ in range(30):
            F = y - y0 - dt * rhs(y, kappa)
            J = np.empty((N + 2, N + 2)); h = 1e-6 * (np.abs(y) + 1e-6)
            for i in range(N + 2):
                yp = y.copy(); yp[i] += h[i]
                J[:, i] = ((yp - y0 - dt * rhs(yp, kappa)) - F) / h[i]
            step = np.linalg.solve(J, -F); y = np.maximum(y + step, 0.0)
            if np.max(np.abs(step) / (np.abs(y) + 1e-12)) < 1e-9: break
        if np.max(np.abs(rhs(y, kappa)) / (np.abs(y) * 1e-5 + 1e-30)) < 1e-6 and dt > 1e9: break
        dt *= 2.0
    return y

def fit_T(n):
    occ = n[1:] / D[1:]                         # per state, excited bins only
    x = E[1:] - E0
    sl = np.polyfit(x, np.log(occ), 1)[0]       # Boltzmann tail
    return -1 / sl / 8.617e-5

if __name__ == "__main__":
    print(f"E_LP(0)={E0:.4f} eV  photon fraction={c0:.3f}  G(0)={G[0]:.3f} eV  gamma_LP(0)={gam[0]*1e3:.2f} meV")
    print(f"span={1e3*(Emax-E0):.2f} meV  states/bin={D[1]:.2f}  total states={D.sum():.0f}")
    print(f"analytic threshold kappa/N = gamma/G = {gam[0]/G[0]:.3e}")
    y = None
    print(" kappa/N      nD         n0        sum(n)     T_eff[K]")
    for x in np.logspace(-4, -1, 13):
        y = steady(x * N_mol, y)
        print(f"{x:9.2e} {y[0]:10.3e} {y[1]:10.3e} {y[1:].sum():10.3e} {fit_T(y[1:]):8.1f}")
