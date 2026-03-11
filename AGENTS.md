# AGENTS.md — Image Checker

This file provides guidance for AI agents working on the **Image Checker** GitHub Action (`kitconcept/image-checker`).

---

## Project overview

**Image Checker** is a GitHub Action that validates image files in a repository against configurable size and dimension constraints. It is designed to prevent large or oversized images from being committed to any project — not just Plone.

The action:
1. Accepts a comma-separated list of image file paths as input.
2. Checks each file for existence, file size, and pixel dimensions.
3. Reports violations per file and sets action outputs (`failed-files`, `failed-count`).
4. Fails the workflow if any file violates a constraint.

---

## Repository: `kitconcept/image-checker`

Any references to `image-checker`, `kitconcept/image-checker`, or Plone-specific branding in source files, workflows, documentation, or metadata should be updated to reflect the new identity:

- Action name: `Image Checker`
- Repository: `kitconcept/image-checker`
- npm package name: `image-checker`
- Author: `kitconcept GmbH`

---

## Tech stack

| Concern          | Technology                                      |
|------------------|-------------------------------------------------|
| Runtime          | Node.js 20                                      |
| Action framework | `@actions/core`                                 |
| Image decoding   | `sharp` (libvips-backed)                        |
| Bundler          | `@vercel/ncc` → `dist/index.js`                 |
| Tests            | Jest with coverage                              |
| Linter           | ESLint                                          |

---

## Project structure

```
image-checker/
├── action.yml                      # Action metadata (name, inputs, outputs, runs)
├── package.json
├── src/
│   ├── index.js                    # Entry point — calls run(), catches errors
│   ├── checker.js                  # Core logic: parsePaths, getOptionalInt, checkFile, run
│   └── imageUtils.js               # getImageDimensions(absolutePath) via sharp
├── __tests__/
│   └── checker.test.js             # Jest unit tests
├── dist/                           # Compiled bundle — committed to repo, never edit directly
└── .github/
    └── workflows/
        ├── ci.yml                  # Lint, test, build verification on every push/PR
        ├── release.yml             # Automated release on version tags (vX.Y.Z)
        └── example-consumer.yml   # Usage template for consumers
```

---

## Key source modules

### `src/checker.js`

- **`parsePaths(rawPaths)`** — splits a comma-separated string into a trimmed array of non-empty paths.
- **`getOptionalInt(name)`** — reads a named action input; returns `null` if blank, throws on non-integer.
- **`checkFile(filePath, constraints)`** — resolves the absolute path, checks existence, file size, and pixel dimensions; returns `{ file, violations[] }`.
- **`run()`** — main entry point: reads inputs, validates constraint logic (`min ≤ max`), iterates files, sets outputs, fails the action if any violations exist.

### `src/imageUtils.js`

- **`getImageDimensions(absolutePath)`** — calls `sharp(path).metadata()` and returns `{ width, height }`. Throws a descriptive error if dimensions cannot be determined.

### `action.yml`

Defines the action metadata: name, description, author, branding, inputs (`file-extensions`,`paths`, `min-size`, `max-size`, `min-width`, `max-width`, `min-height`, `max-height`), outputs (`failed-files`, `failed-count`), and the runner (`node24` → `dist/index.js`).

---

## Inputs and outputs

| Input        | Required | Type    | Description                                     |
|--------------|----------|---------|-------------------------------------------------|
| `file-extensions`      | Yes      | string  | Comma-separated file extensions for image files     |
| `paths`      | Yes      | string  | Comma-separated paths to search for images (repo-relative)     |
| `min-size`   | No       | integer | Minimum file size in bytes                      |
| `max-size`   | No       | integer | Maximum file size in bytes                      |
| `min-width`  | No       | integer | Minimum image width in pixels                   |
| `max-width`  | No       | integer | Maximum image width in pixels                   |
| `min-height` | No       | integer | Minimum image height in pixels                  |
| `max-height` | No       | integer | Maximum image height in pixels                  |

| Output         | Description                                          |
|----------------|------------------------------------------------------|
| `failed-files` | Comma-separated list of files that failed any check  |
| `failed-count` | Number of files that failed one or more checks       |

---

## Development workflow

### Install dependencies

```bash
make install
```

### Run tests

```bash
make test
```

Tests live in `__tests__/checker.test.js`. They use a temporary directory (`__tests__/__tmp__/`) that is created in `beforeAll` and removed in `afterAll`.

### Lint

```bash
make lint
make lint-fix   # auto-fix
```

### Build the distribution bundle

**Always rebuild `dist/` after changing any file under `src/`.**

```bash
make build
git add dist/
git commit -m "chore: rebuild dist"
```

The CI pipeline (`ci.yml`) verifies that `dist/` is in sync with `src/`.

---

## Supported image formats

Handled by `sharp` (libvips): **JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG, HEIF/HEIC**.

---

## Releasing

1. Tag the commit: `git tag v1.2.3 && git push origin v1.2.3`
2. The `release.yml` workflow runs tests, rebuilds `dist/`, and creates a GitHub Release.
3. Keep a floating major-version tag pointing to the latest stable release:

```bash
git tag -fa v1 -m "Update v1 tag"
git push origin v1 --force
```

Consumers should pin to `kitconcept/image-checker@v1`.

---

## Coding conventions

- CommonJS modules (`require`/`module.exports`) — do not introduce ESM unless explicitly requested.
- Async functions use `async/await` throughout.
- Constraints are passed as a plain object `{ minSize, maxSize, minWidth, maxWidth, minHeight, maxHeight }` with `null` for unset values.
- `core.info` for normal progress, `core.error` for per-file violations, `core.setFailed` to fail the action.
- Do not add dependencies without a clear reason; keep the bundle small.

---

## Testing conventions

- Write Jest tests in `__tests__/checker.test.js`.
- Use `beforeAll`/`afterAll` with a temp directory for file-system fixtures.
- Test `parsePaths` and `checkFile` directly (both are exported).
- For dimension tests, write a valid PNG buffer inline (see `makePngBuffer` helper in the test file) rather than committing binary fixtures.
- Mock `@actions/core` when testing `run()` to avoid real action I/O.

---

## What NOT to do

- Do not edit `dist/` directly — always rebuild via `make build`.
- Do not commit test fixture images; generate them in-memory or write them to `__tests__/__tmp__/`.
- Do not hard-code Plone-specific paths or names in new code.
- Do not introduce breaking changes to inputs/outputs without updating `action.yml`, `README.md`, and `AGENTS.md`.

---
## Changelog

- Every new feature or bugfix **must** include a news fragment in the `news/` directory.
- If the work is tracked by a GitHub issue, name the file `news/<issue-number>.<type>` (e.g. `news/42.feature`).
- If there is no issue, use an orphan fragment: `news/+<short-identifier>.<type>` (e.g. `news/+my-feature.feature`).
- Fragment types: `breaking`, `feature`, `bugfix`, `documentation`, `internal`, `tests`.
- Write fragments in past tense, user-oriented, ending with `@github_username`.
- Run `make changelog` to preview the rendered draft before committing.
