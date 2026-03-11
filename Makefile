### Defensive settings for make:
#     https://tech.davis-hansson.com/p/make/
SHELL:=bash
.ONESHELL:
.SHELLFLAGS:=-xeu -o pipefail -O inherit_errexit -c
.SILENT:
.DELETE_ON_ERROR:
MAKEFLAGS+=--warn-undefined-variables
MAKEFLAGS+=--no-builtin-rules

# We like colors
# From: https://coderwall.com/p/izxssa/colored-makefile-for-golang-projects
RED=`tput setaf 1`
GREEN=`tput setaf 2`
RESET=`tput sgr0`
YELLOW=`tput setaf 3`

# Add the following 'help' target to your Makefile
# And add help text after each target name starting with '\#\#'
.PHONY: help
help: ## This help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: all install build test lint lint-fix clean local-action check

all: install build ## Install dependencies and build the distribution bundle

install: ## Install project dependencies
	pnpm install

build: ## Build the distribution bundle (dist/index.js) via ncc
	pnpm run build
	node -e "['dist/index.js','dist/sourcemap-register.js'].forEach(f=>{try{const s=require('fs');s.writeFileSync(f,s.readFileSync(f,'utf8').replace(/\r\n/g,'\n'))}catch(_){}})"

test: ## Run Jest tests with coverage
	pnpm test

lint: ## Lint source and test files with ESLint
	pnpm run lint

lint-fix: ## Auto-fix ESLint issues in source and test files
	pnpm run lint:fix

clean: ## Remove node_modules, dist, and coverage directories
	rm -rf node_modules dist coverage

# Optional constraint variables for the check target (override on the command line)
PATHS      ?=
EXTENSIONS ?= png,jpg,jpeg,gif,webp,avif,tiff,svg
MAX_SIZE   ?= 2097152
MIN_SIZE   ?=
MAX_WIDTH  ?= 1980
MIN_WIDTH  ?=
MAX_HEIGHT ?=
MIN_HEIGHT ?=

local-action: ## Simulate the full GitHub Actions runtime locally (requires .env — copy from .env.example)
	test -f .env || { echo "$(RED)Error:$(RESET) No .env file found. Run: cp .env.example .env"; exit 1; }
	npx @github/local-action run . src/index.js .env

check: ## Run the action locally against a directory (usage: make check PATHS=src [EXTENSIONS=png,jpg] [MAX_SIZE=N] ...)
	node scripts/run-local.js \
		--paths "$(PATHS)" \
		$(if $(EXTENSIONS),--file-extensions "$(EXTENSIONS)") \
		$(if $(MAX_SIZE),--max-size "$(MAX_SIZE)") \
		$(if $(MIN_SIZE),--min-size "$(MIN_SIZE)") \
		$(if $(MAX_WIDTH),--max-width "$(MAX_WIDTH)") \
		$(if $(MIN_WIDTH),--min-width "$(MIN_WIDTH)") \
		$(if $(MAX_HEIGHT),--max-height "$(MAX_HEIGHT)") \
		$(if $(MIN_HEIGHT),--min-height "$(MIN_HEIGHT)")

############################################
# Release
############################################
.PHONY: changelog
changelog: ## Display the draft changelog (news fragments, no files modified)
	@uvx towncrier build --draft --yes --version 0.0.0

.PHONY: dry-run
dry-run: lint test ## Simulate a release: shows changelog draft, no commits, no pushes, no GitHub release
	@echo "📋 Changelog draft:"
	@uvx towncrier build --draft --yes --version 0.0.0
	@echo ""
	@echo "🔍 Dry-run (no changes will be made):"
	@pnpm run dry-release

.PHONY: release
release: lint test  ## Create a new release (interactive: bumps version, updates changelog, pushes tag, creates GitHub release)
	@echo "🚀 Starting release..."
	@pnpm run release
