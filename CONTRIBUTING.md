# Contributing

Thank you for investing time in DCF Builder. Please follow the steps below to propose enhancements or fixes.

## Development Workflow

1. Fork the repository and create a feature branch.
2. Install dependencies with `pnpm install` and build the WASM engine via `pnpm wasm:build`.
3. Run `pnpm test` and `pnpm lint` before submitting a pull request.
4. Ensure valuation outputs retain determinism between the Rust and TypeScript engines.
5. Update documentation under `docs/` and add an entry in `CHANGELOG.md`.

## Code Style

- TypeScript: follow the existing ESLint configuration and favour small, composable components.
- Rust: use `cargo fmt` and `cargo clippy`.
- Python utilities: format with `black`, lint with `ruff`, and type-check with `mypy` (see `pyproject.toml`).

## Commit Messages

- Use imperative mood (`Add Monte Carlo panel`).
- Reference issues when applicable (`Fix #123`).
- Group related changes into a single commit to ease review.

## Contributor License Agreement

By submitting a contribution, you agree that it will be licensed under the MIT License included in this repository.

For clarifications or help, reach out via discussions or open an issue.
