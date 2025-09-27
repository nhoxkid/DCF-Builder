# Valuation Engine

The valuation engine exposes a stable contract defined in `@dcf-builder/engine-contract`. Engines return net present value and optional IRR when invoked with the canonical fixed-point payload.

## Input Contract

```ts
interface DcfInput {
  cashflows: { dateEpochDays: number; amount: Money }[];
  discountRateBps: number;
  compounding: 'annual' | 'monthly';
  asOfEpochDays: number;
}
```

UI schedules (working capital, PP&E, leases, tax, WACC) are collapsed into derived free cash flows before reaching the core engine. Terminal value can be produced via Gordon growth or exit multiple with mid-year convention adjustments.

## Engine Variants

- **WASM**: Rust `dcf` crate compiled with `wasm-bindgen`
- **TypeScript**: Deterministic fallback for parity testing and CI

Both paths share the same `computeValuation` helper which performs validation, sensitivity grids, and metadata stamping prior to dispatch.

## Extending

1. Update `ValuationContext` in `apps/web/src/lib/model.ts`
2. Implement deterministic math inside `apps/web/src/lib/calculators.ts`
3. Mirror behaviour in `crates/dcf/src/lib.rs`
4. Add Vitest coverage and regression vectors for new schedules
