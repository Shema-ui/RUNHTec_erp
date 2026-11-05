// Small, sharp PDFs for invoices and quotations.
//
// 1. Preferred: the page is drawn into the PDF as real text and lines
//    (jsPDF's html renderer). Text stays sharp, can be searched and copied,
//    and a one-page invoice is typically a few hundred KB.
// 2. Fallback (if that fails on a device): a compressed JPEG picture,
//    cut into one slice per A4 page, so each page carries only its own part.
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

// Real-text PDF. Throws if the browser can't do it.
async function textPdf(el, jsPDF) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const widthPx = el.scrollWidth || el.offsetWidth || 794;
  await pdf.html(el, {
    x: 0,
    y: 0,
    width: pageW,
    windowWidth: widthPx,
    margin: [0, 0, 0, 0],
    autoPaging: 'text', // never cut a line of text in half at a page break
    html2canvas: { useCORS: true, allowTaint: false, backgroundColor: '#ffffff', imageTimeout: 15000, logging: false },
  });
  if (!pdf.getNumberOfPages()) throw new Error('empty PDF');
  return pdf;
}

// Compressed picture PDF: JPEG, one slice per page.
async function picturePdf(el, jsPDF) {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', imageTimeout: 15000, logging: false });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const pxPerMm = canvas.width / pageW;
  const slicePx = Math.floor(pageH * pxPerMm);
  for (let top = 0, page = 0; top < canvas.height; top += slicePx, page += 1) {
    const h = Math.min(slicePx, canvas.height - top);
    const slice = document.createElement('canvas');
    slice.width = canvas.width; slice.height = h;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, h);
    ctx.drawImage(canvas, 0, top, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, pageW, h / pxPerMm, undefined, 'FAST');
  }
  return pdf;
}

/** Save the element as a small A4 PDF. Returns 'text' or 'picture' (the method used). */
export async function savePdf(el, filename) {
  const { default: jsPDF } = await import('jspdf');
  await waitForImages(el);
  let pdf; let method = 'text';
  try {
    pdf = await textPdf(el, jsPDF);
  } catch (err) {
    console.warn('[PDF] text PDF failed, using a compressed picture instead:', err?.message || err);
    pdf = await picturePdf(el, jsPDF);
    method = 'picture';
  }
  pdf.save(filename);
  return method;
}
