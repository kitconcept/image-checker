<p align="center">
  <a href="https://github.com/marketplace/actions/image-checker">
    <img alt="Image Checker GitHub Actions logo" width="200px" src="https://raw.githubusercontent.com/kitconcept/image-checker/main/docs/icon.svg">
  </a>
</p>

<h1 align="center">
  Image Checker
</h1>

<div align="center">

[![GitHub Actions Marketplace](https://img.shields.io/badge/action-marketplace-blue.svg?logo=github&color=orange)](https://github.com/marketplace/actions/image-checker)
[![Release version badge](https://img.shields.io/github/v/release/kitconcept/image-checker)](https://github.com/kitconcept/image-checker/releases)

![GitHub Repo stars](https://img.shields.io/github/stars/kitconcept/image-checker?style=flat-square)
[![license badge](https://img.shields.io/github/license/kitconcept/image-checker)](./LICENSE)

</div>

A GitHub Action that validates image files added to a repository against configurable size and dimension constraints.
Designed to prevent large or oversized images from being committed to projects.


## Configuration options

| GitHub Action Input   | Summary                                                                   | Default Value                          | Required |
|-----------------------|---------------------------------------------------------------------------|----------------------------------------|----------|
| `paths`               | Comma-separated directory paths to scan for images (repository-relative). |                                        | ✅       |
| `file-extensions`     | Comma-separated file extensions to match when scanning `paths`.           | `png,jpg,jpeg,gif,webp,avif,tiff,svg`  |          |
| `min-size`            | Minimum file size in **bytes**. Files smaller than this are flagged.      |                                        |          |
| `max-size`            | Maximum file size in **bytes**. Files larger than this are flagged.       |                                        |          |
| `min-width`           | Minimum image width in **pixels**. Images narrower than this are flagged. |                                        |          |
| `max-width`           | Maximum image width in **pixels**. Images wider than this are flagged.    |                                        |          |
| `min-height`          | Minimum image height in **pixels**. Images shorter than this are flagged. |                                        |          |
| `max-height`          | Maximum image height in **pixels**. Images taller than this are flagged.  |                                        |          |
| `fail-on-error`       | Set to `false` to report violations as warnings without failing the workflow. | `true`                             |          |

> All size/dimension inputs are optional. If none are provided, the action
> simply verifies that all matched files exist.

## Outputs

| Output         | Summary                                           |
|----------------|-------------------------------------------------------|
| `failed-files` | Comma-separated list of files that failed any check.  |
| `failed-count` | Number of files that failed one or more checks.       |

---

## Usage

### Basic example

```yaml
- name: Check images
  uses: kitconcept/image-checker@v1
  with:
    file-extensions: 'jpg,png'
    paths: 'src/plonetheme.mytheme/static, docs'
    max-size: '2097152'   # 2 MB
    max-width: '1920'
    max-height: '1080'
```

### With a changed-files step (recommended for PRs)

Pair with [tj-actions/changed-files](https://github.com/tj-actions/changed-files) to automatically check only the images modified in a pull request.
```yaml
name: Check New Images

# ---------------------------------------------------------------------------
# Example: how a project would consume the image-checker action.
#
# Copy this file into YOUR project repository at:
#   .github/workflows/check-images.yml
#
# Adjust the `with:` block to match your project's requirements.
# ---------------------------------------------------------------------------

on:
  pull_request:
    paths:
      # Only run when image files are touched in the PR.
      - '**/*.png'
      - '**/*.jpg'
      - '**/*.jpeg'
      - '**/*.gif'
      - '**/*.webp'
      - '**/*.avif'
      - '**/*.tiff'
      - '**/*.svg'

jobs:
  image-check:
    name: Validate Images
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Detect changed image files
        id: changed
        uses: tj-actions/changed-files@v44
        with:
          files: |
            **/*.png
            **/*.jpg
            **/*.jpeg
            **/*.gif
            **/*.webp
            **/*.avif
            **/*.tiff
            **/*.svg

      - name: Run Image Checker
        if: steps.changed.outputs.any_changed == 'true'
        id: image-check
        uses: kitconcept/image-checker@v1   # <-- replace with your repo
        with:
          # Comma-separated list of changed files (provided by tj-actions/changed-files)
          paths: ${{ steps.changed.outputs.all_changed_files }}

          # File-size limits (bytes)
          max-size: '2097152'   # 2 MB – block large raw assets

          # Dimension limits (pixels)
          max-width:  '3840'    # 4 K width
          max-height: '2160'    # 4 K height

      - name: Report results
        if: always() && steps.changed.outputs.any_changed == 'true'
        run: |
          echo "Failed files : ${{ steps.image-check.outputs.failed-files }}"
          echo "Failed count : ${{ steps.image-check.outputs.failed-count }}"

```

---

## Supported image formats

Dimension detection is handled by [image-size](https://github.com/image-size/image-size),
which supports: **JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG, HEIF/HEIC, BMP, ICO, and more**.

---

## Contribute

- [Issue Tracker](https://github.com/kitconcept/image-checker/issues)
- [Source Code](https://github.com/kitconcept/image-checker/)
- [Documentation](https://github.com/kitconcept/image-checker/)

### Development

Please **DO NOT** commit to version branches directly. Even for the smallest and most trivial fix.

**ALWAYS** open a pull request and ask somebody else to merge your code. **NEVER** merge it yourself.


#### Project structure

```
image-checker/
├── action.yml                      # Action metadata
├── package.json
├── src/
│   ├── index.js                    # Entry point
│   ├── checker.js                  # Core validation logic
│   └── imageUtils.js               # Image dimension helpers (image-size)
├── __tests__/
│   └── checker.test.js             # Jest unit tests
├── dist/                           # Compiled bundle (committed to repo)
└── .github/
    └── workflows/
        ├── ci.yml                  # CI: lint, test, build verification
        ├── release.yml             # Automated releases on version tags
        └── example-consumer.yml   # Template for Plone projects
```

#### Prerequisites

- Node.js 24+
- pnpm 10+

#### Setup

```bash
git clone https://github.com/kitconcept/image-checker.git
cd image-checker
make install
```

#### Running tests

```bash
make test
```

#### Testing the action locally

Two options are available depending on how closely you want to simulate the real CI environment:

**Option 1 — `make check` (quick filesystem test)**

Calls the checker functions directly, no GitHub Actions runtime involved.
Useful for fast iteration on paths and constraints.

```bash
make check PATHS=src/content EXTENSIONS=png,jpg MAX_SIZE=2097152
```

**Option 2 — `make local-action` (full runtime simulation)**

Uses [`@github/local-action`](https://github.com/github/local-action) to emulate
the `@actions/core` runtime, reading inputs from a `.env` file. Closer to what
happens in CI.

```bash
cp .env.example .env
# edit .env to set INPUT_PATHS and any constraints
make local-action
```

#### Building the distribution bundle

The action runs from `dist/index.js`, a self-contained bundle produced by
[`@vercel/ncc`](https://github.com/vercel/ncc). **Always rebuild and commit
`dist/` when you change source files.**

```bash
make build
git add dist/
git commit -m "chore: rebuild dist"
```

**The CI pipeline will fail if `dist/` is out of sync with the source.**


### Changelog

Every feature, bug fix, or notable change must include a news fragment in `news/` before merging.

**Naming convention:**

| Scenario | Filename |
|---|---|
| Work tracked by a GitHub issue | `news/<issue-number>.<type>` |
| No issue | `news/+<short-identifier>.<type>` |

**Fragment types:** `breaking`, `feature`, `bugfix`, `documentation`, `internal`, `tests`

Write the text in past tense, user-oriented, and end with `@github_username`:

```
# news/42.feature
Added support for AVIF images. @ericof
```

Preview the rendered draft at any time (nothing is modified):

```bash
make changelog
```

### Releasing the action

Releases are managed locally with [release-it](https://github.com/release-it/release-it).
No CI workflow creates releases — everything runs from your machine.

**Dry-run first** (no commits, no deletions, no pushes, no GitHub release):

```bash
make dry-run
```

**Publish a release** (interactive wizard):

```bash
make release
```

`make release` will, in order:

1. Run the linter and test suite
2. Show the changelog draft (contents of `news/` fragments)
3. Ask for the new version number
4. Update `CHANGES.md`, delete consumed news fragments, rebuild `dist/`
5. Create a single commit, tag it `v<version>`, and push to GitHub
6. Create a GitHub Release with the changelog as release notes

After releasing, advance the floating major-version tag so consumers using
`kitconcept/image-checker@v1` automatically get the latest stable release:

```bash
git tag -fa v1 -m "Update v1 tag"
git push origin v1 --force
```

## Credits

[![kitconcept GmbH](https://raw.githubusercontent.com/kitconcept/image-checker/main/docs/kitconcept.png)](https://kitconcept.com)

## License

The project is licensed under [MIT License](./LICENSE)
