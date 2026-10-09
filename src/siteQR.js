// aadhav.dev as a QR code, printed on the back of the lanyard badges (the
// owner, Oct 9: "the other side has more specific dates, and my role there,
// and a qr code to the website"). The text never changes, so it is encoded
// once here rather than shipping an encoder: segno 1.6.6,
// segno.make('https://aadhav.dev', error='q', boost_error=False) — version
// 2 (25 x 25 modules), error correction Q (a quarter of the
// code can be lost and it still reads), mask 3. Decoded back to the URL
// (zxing-cpp) from the matrix AND from screenshots of both badges. Rows top to
// bottom, '1' = a dark module; it needs a light margin round it to scan.
export const SITE_URL = 'https://aadhav.dev';

export const SITE_QR = [
  '1111111001111010101111111',
  '1000001011001100101000001',
  '1011101011000100001011101',
  '1011101001101001001011101',
  '1011101000010011101011101',
  '1000001000111100101000001',
  '1111111010101010101111111',
  '0000000000001010100000000',
  '0111011000101100100000110',
  '1001000100000100100100010',
  '1010001111011100010110000',
  '1010000110111001010101100',
  '0000101010001010011010111',
  '0100010101101111011110001',
  '0100011000010110110010110',
  '1000010111011010101110001',
  '0010111110111010111111111',
  '0000000011001101100010101',
  '1111111001110000101010111',
  '1000001010011011100010011',
  '1011101001010100111111000',
  '1011101010111000011011111',
  '1011101010101010011010110',
  '1000001010000010001010100',
  '1111111001000100001111111',
];

// the dark modules as horizontal runs [x, y, length]: one rect per run, so a
// row of dark modules is one shape with no seams inside it
export const QR_RUNS = SITE_QR.flatMap((row, y) => {
  const out = [];
  for (let x = 0; x < row.length; x++) {
    if (row[x] !== '1') continue;
    let n = 1;
    while (row[x + n] === '1') n++;
    out.push([x, y, n]);
    x += n - 1;
  }
  return out;
});

// the same as an SVG path in module units (the motion badges' <svg>)
export const QR_PATH = QR_RUNS.map(([x, y, n]) => `M${x} ${y}h${n}v1h-${n}z`).join('');
