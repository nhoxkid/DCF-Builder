# DCF Builder Technical Overview

## Abstract
Discounted cash flow (DCF) Builder is a full-stack financial modeling platform that combines a React/Vite front end with a Rust valuation core compiled to WebAssembly. The system delivers institutional-grade valuation, sensitivity, and Monte Carlo analysis through a workstation-class user experience that runs entirely in the browser.

## 1. Introduction
Accurate enterprise valuation requires deterministic cash-flow forecasting, cost-of-capital calibration, and stochastic risk assessment. DCF Builder operationalizes these tasks for equity analysts and corporate finance teams by coupling an interactive cash-flow editor with a high-performance calculation engine. The project is organized as a pnpm monorepo containing the web client, shared TypeScript libraries, and Rust crates that can be deployed to native servers or WebAssembly targets.

## 2. System Architecture
- **Front-End Application (`apps/web`)**: TypeScript + React UI that orchestrates forecasting, scenario configuration, analytics visualisation, and data ingestion. Vite and TailwindCSS provide the build and styling toolchain.
- **Valuation Engine (`crates/dcf`)**: Core valuation logic written in Rust. The crate exports deterministic NPV, IRR, and Monte Carlo routines and can be compiled to native binaries or WebAssembly.
- **Engine Bindings (`packages/engine-*`)**: A set of packages that define the engine contract, provide WASM loaders, and expose a TypeScript facade for the browser.
- **Shared Domain Libraries (`apps/web/src/lib`)**: Type-safe utilities for financial math, CSV and Parquet ingestion, and data-provider integrations.
- **Automation (`scripts`, GitHub Actions)**: CI workflows call `pnpm build/test` to keep the TypeScript and Rust artefacts synchronized.

## 3. Functional Capabilities
1. **Forecast Modeling**: Multi-period revenue and margin projections with support for CAPEX, working-capital, leasing, and tax assumptions.
2. **Scenario Management**: Deterministic deltas (growth, margin, exit multiple, discount rate) that can be switched at runtime without data reloads.
3. **Sensitivity Analysis**: Automated grid generation across WACC vs terminal growth or exit multiples.
4. **Monte Carlo Simulation**: Configurable drivers (normal, lognormal, triangular) sampling enterprise value distributions.
5. **Valuation Diagnostics**: EV bridge decomposition, validation checks, and sum-of-the-parts reporting.
6. **Data Integration**: Structured CSV/Parquet import with normalization and Alpha Vantage snapshots for public tickers.

## 4. Implementation Details
- **State Management**: `useBuilderState` reduces nested React state handling by providing typed updater methods for each valuation sub-domain.
- **UI Composition**: Reusable primitives (`SectionCard`, `NumberField`, `SensitivityTable`) ensure consistent interaction surfaces across control panels.
- **Analytics Panels**: Dedicated feature modules assemble metric cards, charts, EV bridges, and metadata while keeping `App.tsx` declarative.
- **Finance Utilities**: `lib/finance.ts` exports composable defaults (`createDefaultForecast`, `createDefaultContext`) and shared formatters for currency, percentages, and millions.
- **Streaming Telemetry**: An optional console surfaces valuation events, data-import warnings, and engine lifecycle updates.

## 5. Usage Guide
### 5.1 Prerequisites
- Node.js 20+
- pnpm 9+
- Rust toolchain (for native engine builds)

### 5.2 Install Dependencies
```bash
pnpm install
```

### 5.3 Development Workflow
```bash
pnpm dev                  # Start the React/Vite development server
pnpm --filter web test    # Execute Vitest suites
pnpm lint                 # Enforce ESLint rules across the monorepo
pnpm typecheck            # Run TypeScript compiler with no emit
pnpm wasm:build           # Compile the Rust engine to WebAssembly
```

### 5.4 Data Operations
- Import `.csv` or `.parquet` files via the UI to hydrate the forecast grid.
- Provide an Alpha Vantage API key and ticker for automated balance-sheet snapshots.
- Toggle stream mode to audit calculations, data loads, and Monte Carlo runs.

## 6. Analytical Workflows
1. Configure base assumptions in the control panel (working capital, CAPEX, WACC, terminal value).
2. Switch scenarios or edit assumptions; the system recomputes valuations using the Rust engine through the WASM bridge.
3. Inspect sensitivity grids to understand terminal-value span versus discount-rate movement.
4. Run Monte Carlo simulations to review percentile outcomes and volatility of enterprise value.
5. Review the EV bridge, validation summary, and SOTP output to reconcile enterprise and equity value drivers.

## 7. Quality Assurance
- **Testing**: Vitest suites cover calculators, CSV normalization, and UI behaviour. Rust crates include unit tests executed through `cargo test` (invoked by CI).
- **Linting**: ESLint and Ruff (for Python tooling) enforce style and error prevention heuristics.
- **Type Safety**: TypeScript type-checking and generated engine contracts guarantee API alignment between the UI and Rust core.

## 8. Deployment Considerations
- Vite build artefacts are output to `apps/web/dist` and can be hosted on any static site provider.
- The WASM engine is loaded dynamically through `@dcf-builder/engine-loader`, enabling CDN deployment without custom workers.
- Native Rust builds (from `crates/dcf`) can be integrated into CLI or batch-processing pipelines when server-side execution is required.

## 9. Future Enhancements
- Expand comps and market-data providers beyond Alpha Vantage (e.g., Polygon, FactSet adapters).
- Introduce collaborative session state backed by a lightweight API service.
- Extend Monte Carlo drivers with correlation matrices and regime-switching logic.
- Add scripted exports (PowerPoint, Excel) for investment committee packs.

## References
1. Damodaran, A., *Investment Valuation*, John Wiley & Sons, 3rd ed.
2. Rust and Wasm Working Group, "wasm-bindgen" project documentation.
3. Official React 18 Documentation, https://react.dev.
