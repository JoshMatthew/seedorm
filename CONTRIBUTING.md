# Contributing to SeedORM

Thanks for your interest in contributing to SeedORM! This guide will help you get set up and submit your first pull request.

## Getting started

1. Fork the repository and clone your fork:

```bash
git clone https://github.com/<your-username>/seedorm.git
cd seedorm
```

2. Install dependencies:

```bash
npm install
```

3. Run the tests to make sure everything works:

```bash
npm test
```

4. Build the project:

```bash
npm run build
```

## Development workflow

### Branch naming

Create a branch from `main` with a descriptive name:

- `feat/add-mysql-adapter`
- `fix/unique-constraint-race-condition`
- `docs/update-cli-reference`

### Making changes

1. Write your code
2. Add or update tests for your changes
3. Make sure all tests pass: `npm test`
4. Make sure the build succeeds: `npm run build`

### Running tests

```bash
# Run all tests
npm test

# Run a specific test file
npx vitest run tests/unit/filter.test.ts

# Run tests in watch mode
npx vitest
```

### Project structure

```
src/
├── index.ts              # Public exports
├── seedorm.ts            # Main SeedORM class
├── types.ts              # All TypeScript interfaces
├── errors.ts             # Error classes
├── model/                # Model class, schema validation, field types
├── adapters/             # Storage adapters (JSON, PostgreSQL)
├── query/                # Filter operators and in-memory query engine
├── migration/            # Migration engine, schema diffing, SQL export
├── cli/                  # CLI commands (init, start, studio, migrate)
└── studio/               # Visual data browser UI
```

## Pull request guidelines

### Before submitting

- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] New features include tests
- [ ] Bug fixes include a test that reproduces the issue

### PR title format

Use a clear, concise title that describes what the PR does:

- `feat: add MySQL adapter`
- `fix: handle empty schema in migration export`
- `docs: add query operators reference`
- `refactor: simplify write queue in file engine`

### PR description

Include:
- **What** the change does
- **Why** it's needed
- How to **test** it

### Keep PRs focused

One logical change per PR. If you find something unrelated that needs fixing, open a separate PR for it.

## Code style

- TypeScript strict mode
- No `any` types unless absolutely necessary (and add a comment explaining why)
- Prefer `const` over `let`
- Use descriptive variable names — clarity over brevity

## Reporting bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Node.js version and OS

## Suggesting features

Open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

## License

By contributing to SeedORM, you agree that your contributions will be licensed under the Apache License 2.0.
