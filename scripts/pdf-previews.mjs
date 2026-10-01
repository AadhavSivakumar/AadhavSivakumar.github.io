// Page images of the resume and CV for the Resume page's viewer:
//   node scripts/pdf-previews.mjs      (needs poppler's pdftoppm, and cwebp or Pillow)
// A PDF inside an <iframe> is not shown by every browser — Android Chrome
// shows nothing, iOS only the first page, some headless ones download it —
// so the viewer shows these images and links to the PDF itself. Run this
// after replacing a PDF in Resume/; the build fails if an image is missing.
import { execSync } from 'node:child_process';
import { readdirSync, rmSync, mkdirSync } from 'node:fs';
const DOCS = {
  'Aadhav_Sivakumar_Resume.pdf': 'resume', 'Aadhav_Sivakumar_Extended_CV.pdf': 'cv',
  // the transcripts, REDACTED before they were committed (student IDs, birth
  // date): replace them only with redacted copies
  'Aadhav_Sivakumar_Transcript_UCSC.pdf': 'ucsc', 'Aadhav_Sivakumar_Transcript_NYU.pdf': 'nyu',
};
mkdirSync('Resume/preview', { recursive: true });
for (const [pdf, name] of Object.entries(DOCS)) {
  for (const f of readdirSync('Resume/preview')) if (f.startsWith(name + '-')) rmSync(`Resume/preview/${f}`);
  execSync(`pdftoppm -r 150 -png Resume/${pdf} Resume/preview/${name}`);
  for (const f of readdirSync('Resume/preview').filter(f => f.startsWith(name + '-') && f.endsWith('.png'))) {
    const n = +f.match(/-(\d+)\.png$/)[1];
    execSync(`python3 -c "from PIL import Image; Image.open('Resume/preview/${f}').convert('RGB').save('Resume/preview/${name}-${n}.webp', quality=82)"`);
    rmSync(`Resume/preview/${f}`);
  }
  console.log(name, readdirSync('Resume/preview').filter(f => f.startsWith(name + '-')).length, 'pages');
}
