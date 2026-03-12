jest.mock("@actions/core");

const core = require("@actions/core");
const { writeSummary } = require("../src/checker");

function makeSummaryChain() {
  const chain = {
    addHeading: jest.fn(),
    addTable: jest.fn(),
    write: jest.fn().mockResolvedValue(undefined),
  };
  chain.addHeading.mockReturnValue(chain);
  chain.addTable.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.resetAllMocks();
  core.debug.mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// writeSummary – no violations
// ---------------------------------------------------------------------------

describe("writeSummary – no violations", () => {
  test("writes top-level and summary headings", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths: ["a.png", "b.png"], failedFiles: [], allViolations: [] });

    expect(sum.addHeading).toHaveBeenCalledWith("Image Checker", 2);
    expect(sum.addHeading).toHaveBeenCalledWith("Summary", 3);
  });

  test("uses custom title when provided", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths: [], failedFiles: [], allViolations: [], title: "My custom check" });

    expect(sum.addHeading).toHaveBeenCalledWith("My custom check", 2);
  });

  test("does not write a Violations heading when all files pass", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths: ["a.png"], failedFiles: [], allViolations: [] });

    const headingCalls = sum.addHeading.mock.calls.map(([text]) => text);
    expect(headingCalls).not.toContain("Violations");
  });

  test("summary table reflects correct counts", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths: ["a.png", "b.png", "c.png"], failedFiles: [], allViolations: [] });

    const table = sum.addTable.mock.calls[0][0];
    const checkedRow = table.find((row) => row.some((cell) => cell.data === "Files checked"));
    const passedRow  = table.find((row) => row.some((cell) => cell.data === "Files passed"));
    const failedRow  = table.find((row) => row.some((cell) => cell.data === "Files failed"));

    expect(checkedRow.at(-1).data).toBe("3");
    expect(passedRow.at(-1).data).toBe("3");
    expect(failedRow.at(-1).data).toBe("0");
  });

  test("calls write()", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths: [], failedFiles: [], allViolations: [] });

    expect(sum.write).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// writeSummary – with violations
// ---------------------------------------------------------------------------

describe("writeSummary – with violations", () => {
  const filePaths = ["img/a.png", "img/b.png"];
  const failedFiles = ["img/a.png"];
  const allViolations = [
    {
      filePath: "img/a.png",
      violations: [{ check: "File size", value: "5000 bytes", rule: "max 1000 bytes" }],
    },
  ];

  test("writes Violations heading", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths, failedFiles, allViolations });

    expect(sum.addHeading).toHaveBeenCalledWith("Violations", 3);
  });

  test("writes a per-file heading for each violation entry", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths, failedFiles, allViolations });

    expect(sum.addHeading).toHaveBeenCalledWith("img/a.png", 4);
  });

  test("writes a per-file table with all violation rows", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths, failedFiles, allViolations });

    // Second addTable call is the violations table (first is the summary table)
    const violationTable = sum.addTable.mock.calls[1][0];
    const dataRows = violationTable.slice(1); // skip header row
    expect(dataRows).toHaveLength(1);
    expect(dataRows[0][0].data).toBe("File size");
    expect(dataRows[0][1].data).toBe("5000 bytes");
    expect(dataRows[0][2].data).toBe("max 1000 bytes");
  });

  test("summary table reflects correct failed count", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    await writeSummary({ filePaths, failedFiles, allViolations });

    const table = sum.addTable.mock.calls[0][0];
    const failedRow = table.find((row) => row.some((cell) => cell.data === "Files failed"));
    expect(failedRow.at(-1).data).toBe("1");
  });

  test("multiple violation entries each get their own heading and table", async () => {
    const sum = makeSummaryChain();
    core.summary = sum;

    const multiViolations = [
      { filePath: "x.png", violations: [{ check: "File size", value: "5000 bytes", rule: "max 1000 bytes" }] },
      { filePath: "y.png", violations: [{ check: "Width", value: "1000px", rule: "max 640px" }, { check: "Height", value: "500px", rule: "max 480px" }] },
    ];

    await writeSummary({ filePaths: ["x.png", "y.png"], failedFiles: ["x.png", "y.png"], allViolations: multiViolations });

    expect(sum.addHeading).toHaveBeenCalledWith("x.png", 4);
    expect(sum.addHeading).toHaveBeenCalledWith("y.png", 4);

    // Two violation tables (indices 1 and 2; index 0 is the summary table)
    const tableY = sum.addTable.mock.calls[2][0];
    const dataRowsY = tableY.slice(1);
    expect(dataRowsY).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// writeSummary – write() failure
// ---------------------------------------------------------------------------

describe("writeSummary – write() failure", () => {
  test("swallows the error and calls core.debug when write() rejects", async () => {
    const sum = makeSummaryChain();
    sum.write.mockRejectedValue(new Error("GITHUB_STEP_SUMMARY not set"));
    core.summary = sum;

    await expect(
      writeSummary({ filePaths: [], failedFiles: [], allViolations: [] })
    ).resolves.not.toThrow();

    expect(core.debug).toHaveBeenCalledWith(
      expect.stringContaining("GITHUB_STEP_SUMMARY not set"),
    );
  });
});
