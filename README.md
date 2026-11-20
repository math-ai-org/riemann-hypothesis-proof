# Riemann Hypothesis Proof

A Lean 4 project, built with Lake on Mathlib, whose main file states the Riemann Hypothesis and the
generalized Riemann Hypothesis for Dirichlet L-functions as theorems.

## Source

The Lean project is from Levent Alpöge, published at https://alpo.ge/ (the archive `lean.tar.gz`,
downloaded November 20, 2026). This repository mirrors it unchanged; only this README and a
`.gitignore` were added.

## Main theorems

`src/Main.lean` proves the following. The statements other than `RiemannHypothesis`, which is
Mathlib's definition, are defined in `src/Statements.lean`, a file that imports only Mathlib.

| Theorem | Statement |
| --- | --- |
| `riemannHypothesis` | `RiemannHypothesis`, as defined in Mathlib |
| `riemannZeta_eq_zero_re` | Every zero of `riemannZeta` other than the trivial zeros `-2(n+1)` and `s = 1` has real part `1/2` |
| `LFunction_ne_zero_of_half_lt_re` | For every Dirichlet character `χ`, `L(χ, s) ≠ 0` when `Re s > 1/2`, except at the pole `χ = 1, s = 1` |
| `LFunction_eq_zero_re` | Every zero of a Dirichlet L-function in the strip `0 < Re s < 1` has real part `1/2` |
| `LFunction_eq_zero_re_of_isPrimitive` | The same statement for primitive Dirichlet characters |

## Layout

The sources are under `src/`, about 175,000 Lean files in total. `lakefile.toml` defines one Lake
library per top-level folder: `BuildAid`, `CompanionTheory`, `Development`, `Formalism`,
`GroundTheory`, `Lemmata`, `PositivityTheory`, `ReciprocityTheory` and `Supplements`, plus `Main`
for `Statements.lean` and `Main.lean`.

## Building

The toolchain is pinned to `leanprover/lean4:v4.33.1` in `lean-toolchain`, and Mathlib to commit
`0df444a` in `lakefile.toml`. With [elan](https://github.com/leanprover/elan) installed:

```sh
lake exe cache get   # download prebuilt Mathlib
lake build
```

The project raises `maxHeartbeats` to 4,000,000 and the thread stack (`--tstack`) to 400,000, and a
full build compiles every library listed above.

## Checking the axioms

After building, check which axioms the main theorem depends on:

```lean
import Main

#print axioms riemannHypothesis
```

A complete proof depends only on Lean's standard axioms: `propext`, `Classical.choice` and
`Quot.sound`.
