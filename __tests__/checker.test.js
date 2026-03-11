const { parsePaths, parseExtensions, findFiles, checkFile } = require('../src/checker');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a tiny valid PNG buffer (1×1 red pixel). */
function makePngBuffer() {
  // Minimal 1×1 red PNG (67 bytes, no external deps needed)
  return Buffer.from(
    '89504e470d0a1a0a' + // PNG signature
    '0000000d49484452' + // IHDR chunk length + type
    '00000001' +         // width = 1
    '00000001' +         // height = 1
    '08020000' +         // bit depth=8, color type=2 (RGB), ...
    '007bc3ca' +         // CRC for IHDR
    '0000000c49444154' + // IDAT chunk
    '08d76360f8cf0000' +
    '00020001e221bc33' + // IDAT data + CRC
    '0000000049454e44' + // IEND
    'ae426082',          // CRC for IEND
    'hex'
  );
}

const TMP_DIR = path.join(__dirname, '__tmp__', 'checker');

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// parsePaths
// ---------------------------------------------------------------------------

describe('parsePaths', () => {
  test('splits a comma-separated list', () => {
    expect(parsePaths('a.png, b.png, c.png')).toEqual(['a.png', 'b.png', 'c.png']);
  });

  test('strips leading/trailing whitespace from each path', () => {
    expect(parsePaths('  img/foo.jpg  ,  img/bar.jpg  ')).toEqual([
      'img/foo.jpg',
      'img/bar.jpg',
    ]);
  });

  test('filters out empty entries', () => {
    expect(parsePaths('a.png,,b.png,')).toEqual(['a.png', 'b.png']);
  });

  test('returns a single entry with no commas', () => {
    expect(parsePaths('only.png')).toEqual(['only.png']);
  });
});

// ---------------------------------------------------------------------------
// parseExtensions
// ---------------------------------------------------------------------------

describe('parseExtensions', () => {
  test('normalises extensions to lowercase with a leading dot', () => {
    expect(parseExtensions('PNG,JPG')).toEqual(['.png', '.jpg']);
  });

  test('keeps existing leading dots', () => {
    expect(parseExtensions('.png,.jpg')).toEqual(['.png', '.jpg']);
  });

  test('handles mixed dot/no-dot and whitespace', () => {
    expect(parseExtensions(' png , .JPG , webp ')).toEqual(['.png', '.jpg', '.webp']);
  });

  test('filters out empty entries', () => {
    expect(parseExtensions('png,,jpg,')).toEqual(['.png', '.jpg']);
  });
});

// ---------------------------------------------------------------------------
// findFiles
// ---------------------------------------------------------------------------

describe('findFiles', () => {
  let subDir;

  beforeAll(() => {
    subDir = path.join(TMP_DIR, 'findFiles');
    fs.mkdirSync(path.join(subDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(subDir, 'a.png'), makePngBuffer());
    fs.writeFileSync(path.join(subDir, 'b.jpg'), Buffer.alloc(10));
    fs.writeFileSync(path.join(subDir, 'c.txt'), Buffer.alloc(10));
    fs.writeFileSync(path.join(subDir, 'nested', 'd.png'), makePngBuffer());
  });

  test('finds files matching the given extensions recursively', () => {
    const found = findFiles([subDir], ['.png']);
    const names = found.map((f) => path.basename(f)).sort();
    expect(names).toEqual(['a.png', 'd.png']);
  });

  test('finds files for multiple extensions', () => {
    const found = findFiles([subDir], ['.png', '.jpg']);
    const names = found.map((f) => path.basename(f)).sort();
    expect(names).toEqual(['a.png', 'b.jpg', 'd.png']);
  });

  test('excludes files with non-matching extensions', () => {
    const found = findFiles([subDir], ['.png']);
    expect(found.every((f) => f.endsWith('.png'))).toBe(true);
  });

  test('returns empty array for a non-existent path', () => {
    expect(findFiles(['/nonexistent/path'], ['.png'])).toEqual([]);
  });

  test('returns empty array when no files match the extensions', () => {
    expect(findFiles([subDir], ['.svg'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// checkFile – file-not-found
// ---------------------------------------------------------------------------

describe('checkFile – missing file', () => {
  test('reports a violation when the file does not exist', async () => {
    const result = await checkFile('/nonexistent/image.png', {
      minSize: null,
      maxSize: null,
      minWidth: null,
      maxWidth: null,
      minHeight: null,
      maxHeight: null,
    });

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatch(/file not found/i);
  });
});

// ---------------------------------------------------------------------------
// checkFile – file-size constraints
// ---------------------------------------------------------------------------

describe('checkFile – file size', () => {
  let smallFile;

  beforeAll(() => {
    smallFile = path.join(TMP_DIR, 'small.bin');
    // Write exactly 100 bytes
    fs.writeFileSync(smallFile, Buffer.alloc(100, 0));
  });

  test('passes when size is within [min, max]', async () => {
    const result = await checkFile(smallFile, {
      minSize: 50,
      maxSize: 200,
      minWidth: null,
      maxWidth: null,
      minHeight: null,
      maxHeight: null,
    });
    expect(result.violations).toHaveLength(0);
  });

  test('flags file below minSize', async () => {
    const result = await checkFile(smallFile, {
      minSize: 500,
      maxSize: null,
      minWidth: null,
      maxWidth: null,
      minHeight: null,
      maxHeight: null,
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatch(/below minimum/i);
  });

  test('flags file above maxSize', async () => {
    const result = await checkFile(smallFile, {
      minSize: null,
      maxSize: 10,
      minWidth: null,
      maxWidth: null,
      minHeight: null,
      maxHeight: null,
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatch(/exceeds maximum/i);
  });
});

// ---------------------------------------------------------------------------
// checkFile – no constraints
// ---------------------------------------------------------------------------

describe('checkFile – no constraints', () => {
  test('passes for an existing file with no constraints', async () => {
    const filePath = path.join(TMP_DIR, 'no-constraints.bin');
    fs.writeFileSync(filePath, Buffer.alloc(256, 0));

    const result = await checkFile(filePath, {
      minSize: null,
      maxSize: null,
      minWidth: null,
      maxWidth: null,
      minHeight: null,
      maxHeight: null,
    });

    expect(result.violations).toHaveLength(0);
  });
});
