# Changelog

<!--
   You should *NOT* be adding new change log entries to this file.
   You should create a file in the news directory instead.
   For helpful instructions, please see:
   https://github.com/kitconcept/image-checker
-->

<!-- towncrier release notes start -->

## 1.0.0 (2026-03-11)


### Feature

- Added GitHub Step Summary report showing total files checked, passed, and failed counts, plus per-file violation details when constraints are not met. @ericof 
- Added `fail-on-error` input (default `true`). Set to `false` to report constraint violations as warnings without failing the workflow. @ericof 


### Internal

- Replaced `sharp` with `image-size` for reading image dimensions, significantly reducing bundle size and removing native binary dependencies. @ericof 


### Documentation

- Updated action icon to a 512×512 design featuring a gradient magnifier glass over an image, better reflecting the action's purpose. @ericof
