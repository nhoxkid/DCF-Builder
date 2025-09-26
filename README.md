# DCF Builder

A production-grade discounted cash flow (DCF) modeling workspace with a Rust (WASM) core and a TypeScript-first UI.

## Monorepo layout

```
apps/
  web/                # Vite + React + Tailwind Apple-style interface
packages/
  engine-contract/    # Stable engine types and helpers
  engine-ts/          # Pure TypeScript valuation engine
  engine-wasm/        # WASM loader wrapping the Rust core
  engine-loader/      # Runtime switch between WASM and TS engines
  engine-tests/       # Golden & parity tests across engine implementations
crates/
  dcf/                # Rust core compiled to WebAssembly via wasm-bindgen
```

## Quick start

1. Install tooling (Node 20+, pnpm 9+, Rust stable with `wasm32-unknown-unknown`, `wasm-pack`).
2. Install workspace dependencies:
   ```bash
   pnpm install
   ```
3. Build the Rust core and TypeScript packages:
   ```bash
   pnpm wasm:build
   pnpm build
   ```
4. Launch the web app:
   ```bash
   pnpm dev
   ```

## Testing & linting

- `pnpm test` – runs Vitest suites across packages (parity tests require the WASM bundle).
- `pnpm lint` / `pnpm format` – eslint (flat config) with optional `--fix`.
- `pnpm typecheck` – ensures TypeScript projects compile with the shared base config.

## Engine architecture

- **Rust core** (`crates/dcf`): fixed-point money, basis-point discounting, IRR via bisection, exported through `wasm-bindgen` with ergonomic TS bindings.
- **TypeScript fallback** (`packages/engine-ts`): deterministic Decimal.js implementation for CI parity and environments without WebAssembly.
- **Loader** (`packages/engine-loader`): chooses WASM when available, transparently falls back to TS.

## Web experience

- Apple-inspired glassmorphism with Tailwind, Framer Motion micro-interactions, and Recharts visualizations.
- Inline cashflow editor, discount controls, and live NPV / IRR / equity value outputs (in millions) with per-share computations.
- Engine status badge surfaces whether the Rust/WASM core is active.

## Notes

- WASM tooling: the `engine-wasm` build expects `wasm-pack` on PATH. Rebuild the crate whenever Rust sources change.
- Precision: money values are stored in micro-units (1e-6) and surfaced in the UI in millions with formatting helpers.
- Tests: the parity suite skips WASM assertions gracefully if the module is unavailable but will log the reason (ensure `pnpm wasm:build` ran for full coverage).

Happy modeling!
