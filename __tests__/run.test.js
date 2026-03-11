jest.mock("@actions/core");

const core = require("@actions/core");
const { run } = require("../src/checker");
const path = require("path");
const fs = require("fs");

const TMP_DIR = path.join(__dirname, "__tmp__", "run");

/** Creates a tiny valid PNG buffer (1×1 red pixel). */
function makePngBuffer() {
  return Buffer.from(
    "89504e470d0a1a0a" +
      "0000000d49484452" +
      "00000001" +
      "00000001" +
      "08020000" +
      "007bc3ca" +
      "0000000c49444154" +
      "08d76360f8cf0000" +
      "00020001e221bc33" +
      "0000000049454e44" +
      "ae426082",
    "hex",
  );
}

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  jest.resetAllMocks();
  core.getInput.mockImplementation((name) => {
    const defaults = {
      paths: TMP_DIR,
      "file-extensions": "png",
      "fail-on-error": "true",
      "min-size": "",
      "max-size": "",
      "min-width": "",
      "max-width": "",
      "min-height": "",
      "max-height": "",
    };
    return defaults[name] ?? "";
  });
  core.setOutput.mockImplementation(() => {});
  core.setFailed.mockImplementation(() => {});
  core.warning.mockImplementation(() => {});
  core.error.mockImplementation(() => {});
  core.info.mockImplementation(() => {});
  const summaryChain = { addHeading: jest.fn(), addTable: jest.fn(), write: jest.fn().mockResolvedValue(undefined) };
  summaryChain.addHeading.mockReturnValue(summaryChain);
  summaryChain.addTable.mockReturnValue(summaryChain);
  core.summary = summaryChain;
});

// ---------------------------------------------------------------------------
// run() – fail-on-error: true (default)
// ---------------------------------------------------------------------------

describe("run() – fail-on-error: true", () => {
  test("calls setFailed when a file violates a constraint", async () => {
    const img = path.join(TMP_DIR, "big.png");
    fs.writeFileSync(img, makePngBuffer());

    core.getInput.mockImplementation((name) => {
      const inputs = {
        paths: TMP_DIR,
        "file-extensions": "png",
        "fail-on-error": "true",
        "min-size": "999999",
        "max-size": "",
        "min-width": "",
        "max-width": "",
        "min-height": "",
        "max-height": "",
      };
      return inputs[name] ?? "";
    });

    await run();

    expect(core.setFailed).toHaveBeenCalled();
    expect(core.warning).not.toHaveBeenCalledWith(
      expect.stringMatching(/failed/i),
    );
  });

  test("does not call setFailed when all files pass", async () => {
    const img = path.join(TMP_DIR, "ok.png");
    fs.writeFileSync(img, makePngBuffer());

    core.getInput.mockImplementation((name) => {
      const inputs = {
        paths: TMP_DIR,
        "file-extensions": "png",
        "fail-on-error": "true",
        "min-size": "",
        "max-size": "",
        "min-width": "",
        "max-width": "",
        "min-height": "",
        "max-height": "",
      };
      return inputs[name] ?? "";
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// run() – fail-on-error: false (warn-only mode)
// ---------------------------------------------------------------------------

describe("run() – fail-on-error: false", () => {
  test("calls warning (not setFailed) when a file violates a constraint", async () => {
    const img = path.join(TMP_DIR, "warn.png");
    fs.writeFileSync(img, makePngBuffer());

    core.getInput.mockImplementation((name) => {
      const inputs = {
        paths: TMP_DIR,
        "file-extensions": "png",
        "fail-on-error": "false",
        "min-size": "999999",
        "max-size": "",
        "min-width": "",
        "max-width": "",
        "min-height": "",
        "max-height": "",
      };
      return inputs[name] ?? "";
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.warning).toHaveBeenCalled();
  });
});
