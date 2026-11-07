/** Sample size for a two-sided test of two proportions, used by docs/experiment-plan.md. */
const Z_ALPHA = 1.959964; // 5% significance, two-sided.
const Z_POWER = 0.841621; // 80% power.

/**
 * n = (z_alpha + z_power)^2 * (p1 * q1 + p2 * q2) / (p2 - p1)^2
 * @param {number} baseline conversion rate of the control group
 * @param {number} relativeLift smallest lift worth detecting, such as 0.1 for +10%
 * @returns {number} visitors needed in each group
 */
function sampleSizePerGroup(baseline, relativeLift) {
  const treated = baseline * (1 + relativeLift);
  const variance = baseline * (1 - baseline) + treated * (1 - treated);
  return Math.ceil(((Z_ALPHA + Z_POWER) ** 2 * variance) / (treated - baseline) ** 2);
}

module.exports = { sampleSizePerGroup };
