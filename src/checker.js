const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const { getImageDimensions } = require("./imageUtils");

/**
 * Parses a comma-separated list of file paths from the action input.
 * @param {string} rawPaths - Raw input string.
 * @returns {string[]} Array of trimmed, non-empty file paths.
 */
function parsePaths(rawPaths) {
  return rawPaths
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Parses a comma-separated list of file extensions, normalising each to
 * lowercase with a leading dot (e.g. "PNG" → ".png").
 * @param {string} rawExtensions - Raw input string.
 * @returns {string[]} Array of normalised extensions.
 */
function parseExtensions(rawExtensions) {
  return rawExtensions
    .split(",")
    .map((e) => {
      const ext = e.trim().toLowerCase();
      return ext.startsWith(".") ? ext : `.${ext}`;
    })
    .filter((e) => e.length > 1);
}

/**
 * Recursively finds all files under the given directory paths whose extension
 * matches one of the provided extensions.
 * @param {string[]} searchPaths - Directory paths to search.
 * @param {string[]} extensions  - Normalised extensions to match (e.g. ['.png']).
 * @returns {string[]} Absolute paths to matching files.
 */
function findFiles(searchPaths, extensions) {
  const extSet = new Set(extensions);
  const found = [];
  for (const searchPath of searchPaths) {
    const absPath = path.resolve(searchPath);
    if (!fs.existsSync(absPath)) {
      continue;
    }
    const stat = fs.statSync(absPath);
    if (!stat.isDirectory()) {
      continue;
    }
    const entries = fs.readdirSync(absPath, {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (extSet.has(ext)) {
        const dir = entry.parentPath || entry.path;
        found.push(path.join(dir, entry.name));
      }
    }
  }
  return found;
}

/**
 * Parses an optional integer input. Returns null if not provided or blank.
 * @param {string} name - The input name.
 * @returns {number|null}
 */
function getOptionalInt(name) {
  const value = core.getInput(name);
  if (!value || value.trim() === "") {
    return null;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Input '${name}' must be a valid integer, got: '${value}'`);
  }
  return parsed;
}

/**
 * Checks a single file against all provided constraints.
 * @param {string} filePath - Path to the image file.
 * @param {object} constraints - The constraints to check against.
 * @returns {Promise<{file: string, violations: string[]}>}
 */
async function checkFile(filePath, constraints) {
  const violations = [];
  const absolutePath = path.resolve(filePath);

  // --- Check file existence ---
  if (!fs.existsSync(absolutePath)) {
    violations.push(`File not found: ${filePath}`);
    return { file: filePath, violations };
  }

  // --- File size check ---
  if (constraints.minSize !== null || constraints.maxSize !== null) {
    const stats = fs.statSync(absolutePath);
    const fileSizeBytes = stats.size;

    if (constraints.minSize !== null && fileSizeBytes < constraints.minSize) {
      violations.push(
        `File size ${fileSizeBytes} bytes is below minimum ${constraints.minSize} bytes`,
      );
    }
    if (constraints.maxSize !== null && fileSizeBytes > constraints.maxSize) {
      violations.push(
        `File size ${fileSizeBytes} bytes exceeds maximum ${constraints.maxSize} bytes`,
      );
    }
  }

  // --- Image dimension checks ---
  const needsDimensions =
    constraints.minWidth !== null ||
    constraints.maxWidth !== null ||
    constraints.minHeight !== null ||
    constraints.maxHeight !== null;

  if (needsDimensions) {
    let dimensions;
    try {
      dimensions = await getImageDimensions(absolutePath);
    } catch (err) {
      violations.push(`Could not read image dimensions: ${err.message}`);
      return { file: filePath, violations };
    }

    const { width, height } = dimensions;

    if (constraints.minWidth !== null && width < constraints.minWidth) {
      violations.push(
        `Image width ${width}px is below minimum ${constraints.minWidth}px`,
      );
    }
    if (constraints.maxWidth !== null && width > constraints.maxWidth) {
      violations.push(
        `Image width ${width}px exceeds maximum ${constraints.maxWidth}px`,
      );
    }
    if (constraints.minHeight !== null && height < constraints.minHeight) {
      violations.push(
        `Image height ${height}px is below minimum ${constraints.minHeight}px`,
      );
    }
    if (constraints.maxHeight !== null && height > constraints.maxHeight) {
      violations.push(
        `Image height ${height}px exceeds maximum ${constraints.maxHeight}px`,
      );
    }
  }

  return { file: filePath, violations };
}

/**
 * Builds and writes the GitHub Step Summary for the image check results.
 * @param {object} params
 * @param {string[]} params.filePaths      - All files that were checked.
 * @param {string[]} params.failedFiles    - Files that failed one or more checks.
 * @param {Array<{filePath: string, violations: string[]}>} params.allViolations - Per-file violations.
 */
async function writeSummary({ filePaths, failedFiles, allViolations }) {
  const sum = core.summary.addHeading("Image Checker", 2);

  const summaryTable = [
    [
      { header: true, data: "" },
      { header: true, data: "Description" },
      { header: true, data: "Total" },
    ],
    [{ data: "🗄️" }, { data: "Files checked" }, { data: `${filePaths.length}` }],
    [{ data: "✅" }, { data: "Files passed" }, { data: `${filePaths.length - failedFiles.length}` }],
    [{ data: "🚫" }, { data: "Files failed" }, { data: `${failedFiles.length}` }],
  ];

  sum.addHeading("Summary", 3);
  sum.addTable(summaryTable);

  if (allViolations.length > 0) {
    sum.addHeading("Violations", 3);
    for (const violation of allViolations) {
      sum.addHeading(violation.filePath, 4);
      sum.addTable([
        [{ header: true, data: "Violation" }],
        ...violation.violations.map((v) => [{ data: v }]),
      ]);
    }
  }

  try {
    await sum.write();
  } catch (err) {
    core.debug(`Job summary unavailable: ${err.message}`);
  }
}

/**
 * Main entry point for the GitHub Action.
 */
async function run() {
  // --- Read inputs ---
  const rawPaths = core.getInput("paths", { required: true });
  const rawExtensions = core.getInput("file-extensions");
  const failOnError = core.getInput("fail-on-error") !== "false";
  const searchPaths = parsePaths(rawPaths);
  const extensions = parseExtensions(rawExtensions);

  core.info(
    `Scanning ${searchPaths.length} path(s) for extensions: ${extensions.join(", ")}`,
  );
  const filePaths = findFiles(searchPaths, extensions);
  core.info(`Found ${filePaths.length} file(s) to check.`);

  const constraints = {
    minSize: getOptionalInt("min-size"),
    maxSize: getOptionalInt("max-size"),
    minWidth: getOptionalInt("min-width"),
    maxWidth: getOptionalInt("max-width"),
    minHeight: getOptionalInt("min-height"),
    maxHeight: getOptionalInt("max-height"),
  };

  core.info(
    `Checking ${filePaths.length} file(s) with constraints: ${JSON.stringify(constraints)}`,
  );

  // --- Validate constraint logic ---
  if (constraints.minSize !== null && constraints.maxSize !== null) {
    if (constraints.minSize > constraints.maxSize) {
      core.setFailed("min-size cannot be greater than max-size");
      return;
    }
  }
  if (constraints.minWidth !== null && constraints.maxWidth !== null) {
    if (constraints.minWidth > constraints.maxWidth) {
      core.setFailed("min-width cannot be greater than max-width");
      return;
    }
  }
  if (constraints.minHeight !== null && constraints.maxHeight !== null) {
    if (constraints.minHeight > constraints.maxHeight) {
      core.setFailed("min-height cannot be greater than max-height");
      return;
    }
  }

  // --- Run checks ---
  const failedFiles = [];
  const allViolations = [];
  const infoMsgs = [];
  const errorMsgs = [];
  const errorReport = failOnError
    ? core.error.bind(core)
    : core.warning.bind(core);

  for (const filePath of filePaths) {
    infoMsgs.push(`\nChecking: ${filePath}`);
    const result = await checkFile(filePath, constraints);

    if (result.violations.length > 0) {
      const fileViolations = { filePath, violations: [] };
      failedFiles.push(filePath);
      errorMsgs.push(`${filePath} failed ${result.violations.length} check(s):`);
      for (const violation of result.violations) {
        errorMsgs.push(`   - ${violation}`);
        fileViolations.violations.push(violation);
      }
      infoMsgs.push(`❗ ${filePath} did not pass the check`);
      allViolations.push(fileViolations);
    } else {
      infoMsgs.push(`✅ ${filePath} passed all checks`);
    }
  }

  // --- Set outputs ---
  core.setOutput("failed-files", failedFiles.join(","));
  core.setOutput("failed-count", String(failedFiles.length));

  // --- Write summary ---
  await writeSummary({ filePaths, failedFiles, allViolations });

  // --- Report issues ---
  core.info(infoMsgs.join("\n"));
  if (errorMsgs.length > 0) {
    errorReport(errorMsgs.join("\n"));
  }

  if (failedFiles.length > 0) {
    const message = `${failedFiles.length} file(s) failed image checks: ${failedFiles.join(", ")}`;
    if (failOnError) {
      core.setFailed(message);
    } else {
      core.warning(message);
    }
  }
}

module.exports = {
  run,
  writeSummary,
  checkFile,
  parsePaths,
  parseExtensions,
  findFiles,
  getOptionalInt,
};
