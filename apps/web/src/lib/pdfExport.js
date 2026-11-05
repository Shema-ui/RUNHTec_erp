// Small PDFs for invoices and quotations that look exactly like the screen.
//
// The page is captured as a compressed JPEG picture (not a huge PNG), cut into
// one slice per A4 page at a row boundary, so each page only carries its own
// part. A one-page invoice is typically a few hundred KB instead of tens of MB.
// (jsPDF's "real text" mode was tried: it breaks the layout — odd gaps, missing
// white text on coloured boxes — so it isn't used. Print → "Save as PDF" in the
// browser gives a real-text PDF when one is needed.)
//
// Logos, signatures and stamps are shrunk to print size first (see
// toBase64Image), since a phone photo of a stamp alone can be several MB.

const MAX_IMG_PX = 700; // plenty for a logo or stamp printed a few cm wide

// Load an image (same-origin file or external URL) as a data URL, shrunk to
// at most MAX_IMG_PX on its longest side. PNG keeps transparent backgrounds.
export async function toBase64Image(url, maxPx = MAX_IMG_PX) {
  if (!url) return null;
  let src = url;
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
    if (res.ok) {
      const blob = await res.blob();
      src = URL.createObjectURL(blob);
    }
  } catch (_) { /* try loading it directly below */ }
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
    const w = img.naturalWidth || 240; const h = img.naturalHeight || 240;
    const k = Math.min(1, maxPx / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * k));
    canvas.height = Math.max(1, Math.round(h * k));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);
    if (dataUrl && dataUrl.length > 100) return dataUrl;
  } catch (err) {
    console.error('[PDF] could not load image:', url, err?.message || err);
  }
  return null;
}

async function waitForImages(el) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth > 0
    ? Promise.resolve()
    : new Promise((resolve) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); }))));
}

// Where a page may break without cutting through text: the bottom of each
// table row and of each block, in CSS pixels from the top of the document.
function breakPoints(el) {
  const top = el.getBoundingClientRect().top;
  const ys = new Set();
  el.querySelectorAll('tr, p, h1, h2, h3, h4, li, img, div').forEach((n) => {
    const r = n.getBoundingClientRect();
    if (r.height > 0 && r.height < 400) ys.add(Math.round(r.bottom - top));
  });
  return [...ys].sort((a, b) => a - b);
}

// The document as a compressed picture (JPEG), one A4 slice per page, with
// page breaks placed between rows so no line of text is cut in half.
async function picturePdf(el, jsPDF) {
  const { default: html2canvas } = await import('html2canvas');
  const scale = 2; // sharp when printed, still small
  const canvas = await html2canvas(el, { scale, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', imageTimeout: 15000, logging: false });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const cssW = canvas.width / scale;
  const gapMm = 10; // white space at the top of page 2, 3…
  const pageCssFor = (pg) => Math.floor(cssW * ((pageH - (pg > 0 ? gapMm : 0)) / pageW)); // usable page height in CSS px
  const totalCss = canvas.height / scale;
  const points = breakPoints(el);
  let top = 0; let page = 0;
  while (top < totalCss - 1) {
    const pageCss = pageCssFor(page);
    let bottom = Math.min(top + pageCss, totalCss);
    if (bottom < totalCss) {
      // last safe break on this page, but don't leave a page mostly empty
      const safe = points.filter((y) => y > top + pageCss * 0.6 && y <= top + pageCss).pop();
      if (safe) bottom = safe;
    }
    const sy = Math.round(top * scale); const sh = Math.round((bottom - top) * scale);
    const slice = document.createElement('canvas');
    slice.width = canvas.width; slice.height = sh;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, sh);
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.82), 'JPEG', 0, page > 0 ? gapMm : 0, pageW, (sh / canvas.width) * pageW, undefined, 'FAST');
    top = bottom; page += 1;
  }
  return pdf;
}

/** Save the element as a small A4 PDF that looks exactly like the screen. */
export async function savePdf(el, filename) {
  const { default: jsPDF } = await import('jspdf');
  await waitForImages(el);
  const pdf = await picturePdf(el, jsPDF);
  pdf.save(filename);
}
