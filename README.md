# Metroloom

Measurement uncertainty budgets and conformity assessment for calibration and
testing laboratories. Work in progress — the web tool will be published at
[metroloom.net](https://metroloom.net).

## What it does

- **Uncertainty budget (GUM, JCGM 100:2008)**: Type A evaluation from repeated
  readings, Type B components (normal, rectangular, triangular, U-shaped),
  sensitivity coefficients, contribution of each component, combined standard
  uncertainty, Welch-Satterthwaite effective degrees of freedom, coverage factor
  and expanded uncertainty.
- **Conformity assessment with uncertainty (ILAC G8:09/2019)**: tolerance limits
  (two-sided or one-sided), guard bands, pass / conditional pass / conditional
  fail / fail statements, probability of conformance and test uncertainty ratio.

The tool calculates and shows the result of the criteria the user chooses. The
decision on conformity is always made and signed by the user.

## Development

The calculation engine is plain JavaScript (ES modules) with no dependencies, so
the same code runs in the browser and in Node.

```
npm test
```

Coverage factors are checked against GUM table G.2. Validation against the worked
examples of EA-4/02 M is in progress.

## Author

Anna Badanina — MSc in Metrology and Information-Measuring Technology.
