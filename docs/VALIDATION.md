# Validation report

The Metroloom calculation engine is checked against published worked examples.
Every check below runs as an automated test (`npm test`,
`test/validation-ea402.test.js` and `test/stats.test.js`) whenever the code changes.

**Reference:** EA-4/02 M:2022 *Evaluation of the Uncertainty of Measurement in
Calibration* (European co-operation for Accreditation, approved 5 November 2021),
supplement with worked examples and table E.1. The numbers were taken from the
German translation (DAkkS, 31 August 2022).

**Pass criterion:** the engine result must match the value printed by EA to within
half a unit of the last printed digit.

## Coverage factors (EA-4/02 table E.1, GUM table G.2)

Coverage factor k for p = 95.45 % and νeff = 1 to 20, 25, 30, 35, 40, 45, 50 and ∞:
**all match**, with one exception:

| νeff | EA-4/02 table E.1 | Engine | Comment |
|---|---|---|---|
| 11 | 2.24 | 2.2549 | Misprint in the table. The exact t-quantile is 2.2549, confirmed by an independent numerical integration of the t density, and it fits between 2.28 (ν = 10) and 2.23 (ν = 12). The engine uses the exact value. |

As EA-4/02 E.2 (c) requires, a non-integer νeff is rounded down to the next lower
integer before k is determined.

## S2: calibration of a 10 kg weight (mg)

| Component | Input | EA ui(y) | Engine |
|---|---|---|---|
| mS reference standard | U = 45 mg, k = 2 | 22.5 | 22.500 |
| δmD drift | ±15 mg, rectangular | 8.66 | 8.660 |
| δm observed difference | pooled s = 25 mg, n = 3 | 14.4 | 14.434 |
| δmC eccentricity, magnetism | ±10 mg, rectangular | 5.77 | 5.774 |
| δB air buoyancy | ±1·10⁻⁶ × 10 kg, rectangular | 5.77 | 5.774 |
| **u(mX)** | | **29.3** | **29.262** |
| **U (k = 2)** | | **59** | **58.52** |

## S3: calibration of a 10 kΩ standard resistor (mΩ)

| Component | Input | EA ui(y) | Engine |
|---|---|---|---|
| RS reference standard | U = 5 mΩ, k = 2 | 2.5 | 2.500 |
| δRD drift | ±10 mΩ, rectangular | 5.8 | 5.774 |
| δRTS temperature, reference | ±2.75 mΩ, rectangular | 1.6 | 1.588 |
| δRTX temperature, unknown | ±5.5 mΩ, rectangular | 3.2 | 3.175 |
| rC DMM correction | ±1·10⁻⁶, triangular, c = 10 000 Ω | 4.1 | 4.082 |
| r observed ratio | 5 readings (Type A) | 0.7 | 0.707 |
| **u(RX)** | | **8.33** | **8.328** |
| **U (k = 2)** | | **17** | **16.66** |

## S4: calibration of a 50 mm gauge block (nm)

| Component | Input | EA ui(y) | Engine |
|---|---|---|---|
| lS reference gauge block | U = 30 nm, k = 2 | 15.0 | 15.000 |
| δlD drift | ±30 nm, triangular | 12.2 | 12.247 |
| δl observed difference | pooled s = 12 nm, n = 5 | 5.37 | 5.367 |
| δlC comparator | u = 18.5 nm (as printed) | 18.5 | 18.500 |
| δt temperature difference | ±0.05 K, rectangular, c = −575 nm/K | −16.6 | −16.599 |
| δα·θ product term | u = 0.236·10⁻⁶, c = −50 mm | −11.8 | −11.800 |
| δlV off-centre probing | ±6.7 nm, rectangular, c = −1 | −3.87 | −3.868 |
| **u(lX)** | | **34.3** | **34.290** |
| **U (k = 2)** | | **69** | **68.58** |

The table above shows signed contributions ci·u(xi). The engine works with their
magnitudes, which give the same combined uncertainty.

## Notes for users

- **Pooled standard deviation.** In S2 and S4 the standard deviation comes from
  earlier evaluations (pooled), and EA treats it as reliable. Enter the degrees of
  freedom of the pooled estimate, not n − 1. If S2 is calculated with n − 1 = 2,
  then νeff ≈ 34, k ≈ 2.07 and U ≈ 61 mg instead of 59 mg (this is covered by a test).
- **S4 comparator.** For δlC the translation states limits of 50 nm, but the budget
  prints u = 18.5 nm (consistent with limits of about 32 nm). The validation uses
  the printed standard uncertainty.
- **Not yet covered:** S5–S7 (thermocouple, power sensor, attenuator), correlated
  input quantities (EA-4/02 annex D) and Monte Carlo (GUM Supplement 1).
