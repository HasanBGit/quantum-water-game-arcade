// How fast the number of plans grows. BigInt keeps 2^240 exact.

/** Plans for n on/off slots: 2^n. */
export function plansForSlots(n) {
  return 2n ** BigInt(n);
}

/** Square root of 2^n, for even n: 2^(n/2). Null for odd n. */
export function sqrtPlansForSlots(n) {
  return n % 2 === 0 ? 2n ** BigInt(n / 2) : null;
}

/** 16777216 for small values, "1.77 × 10^72" for large ones. */
export function formatBig(value) {
  const s = value.toString();
  if (s.length <= 9) return Number(value).toLocaleString("en-US");
  let exponent = s.length - 1;
  let mantissa = Math.round(Number(s.slice(0, 4)) / 10) / 100;
  if (mantissa >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  return `${mantissa.toFixed(2)} × 10^${exponent}`;
}
