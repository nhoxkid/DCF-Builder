# Getting Started

## Prerequisites

- Node.js 20+
- pnpm 9+
- Rust toolchain with wasm32-unknown-unknown target and `wasm-pack`
- (Optional) Python 3.11+ for linting and auxiliary analytics scripts

## Installation

```bash
pnpm install
pnpm wasm:build
pnpm dev
```

Use `pnpm build` to produce optimized bundles and `pnpm test` to run Vitest coverage.

## Workspace Layout

- `apps/web` – Vite + React front-end
- `packages/engine-*` – shared contracts, TS fallback, WASM loader
- `crates/dcf` – Rust valuation core compiled to WebAssembly

Refer to [Valuation Engine](valuation-engine.md) for API details or [Governance](governance.md) for compliance artifacts.
