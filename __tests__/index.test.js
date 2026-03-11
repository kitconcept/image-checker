// ---------------------------------------------------------------------------
// index.js – entry point
//
// index.js is side-effectful: it calls run() immediately when loaded.
// Each test uses jest.resetModules() + jest.mock() so the module is re-executed
// fresh, with its dependencies replaced by fresh mocks.
// ---------------------------------------------------------------------------

describe('index', () => {
  let core;
  let checker;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@actions/core');
    jest.mock('../src/checker');
    core    = require('@actions/core');
    checker = require('../src/checker');
  });

  test('calls run() when the module is loaded', async () => {
    checker.run.mockResolvedValue(undefined);
    require('../src/index');
    await new Promise((resolve) => setImmediate(resolve));
    expect(checker.run).toHaveBeenCalledTimes(1);
  });

  test('passes errors thrown by run() to core.setFailed', async () => {
    checker.run.mockRejectedValue(new Error('something went wrong'));
    require('../src/index');
    await new Promise((resolve) => setImmediate(resolve));
    expect(core.setFailed).toHaveBeenCalledWith('something went wrong');
  });
});
