const { getImageDimensions } = require('../src/imageUtils');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TMP_DIR = path.join(__dirname, '__tmp__', 'imageUtils');

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// getImageDimensions
// ---------------------------------------------------------------------------

describe('getImageDimensions', () => {
  test('returns correct width and height for a JPEG fixture', async () => {
    const file = path.join(FIXTURES_DIR, 'black-starry-night.jpg');
    const { width, height } = await getImageDimensions(file);
    expect(typeof width).toBe('number');
    expect(typeof height).toBe('number');
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  test('throws for a non-image file', async () => {
    const badFile = path.join(TMP_DIR, 'not-an-image.bin');
    fs.writeFileSync(badFile, Buffer.alloc(32, 0xff));
    await expect(getImageDimensions(badFile)).rejects.toThrow();
  });
});
