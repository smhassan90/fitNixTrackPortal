/**
 * Render print-format receipt HTML to a PDF File for WhatsApp attachment.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        })
    )
  ).then(() => undefined);
}

/** Prepare HTML for canvas capture: force anonymous CORS on logos. */
function prepareCaptureHtml(html: string): string {
  return html.replace(/<img\b([^>]*?)>/gi, (_full, attrs: string) => {
    let next = attrs;
    if (!/\bcrossorigin\b/i.test(next)) {
      next += ' crossorigin="anonymous"';
    }
    if (!/\breferrerpolicy\b/i.test(next)) {
      next += ' referrerpolicy="no-referrer"';
    }
    return `<img${next}>`;
  });
}

export async function htmlReceiptToPdfFile(
  html: string,
  fileName: string
): Promise<File> {
  const prepared = prepareCaptureHtml(html);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;opacity:0;pointer-events:none;';
  document.body.appendChild(host);

  try {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'border:0;width:794px;height:1123px;background:#fff;';
    host.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      throw new Error('Could not prepare receipt for PDF.');
    }

    doc.open();
    doc.write(prepared);
    doc.close();

    await new Promise<void>((resolve) => {
      if (iframe.contentWindow?.document.readyState === 'complete') {
        resolve();
        return;
      }
      iframe.onload = () => resolve();
      window.setTimeout(() => resolve(), 400);
    });

    await waitForImages(doc);
    // Allow layout/fonts to settle.
    await new Promise((r) => window.setTimeout(r, 120));

    const body = doc.body;
    const target =
      (doc.querySelector('.rcpt') as HTMLElement | null) ||
      (doc.querySelector('.ticket') as HTMLElement | null) ||
      body;

    // Expand iframe to full content height so nothing is clipped.
    const contentHeight = Math.max(
      target.scrollHeight,
      body.scrollHeight,
      doc.documentElement.scrollHeight,
      400
    );
    iframe.style.height = `${contentHeight + 40}px`;

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 18;
    const usableWidth = pageWidth - margin * 2;
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 12) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight - margin * 2;
    }

    const blob = pdf.output('blob');
    const safeName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    return new File([blob], safeName, { type: 'application/pdf' });
  } finally {
    host.remove();
  }
}

export function downloadBlobFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareOrDownloadReceiptPdf(params: {
  file: File;
  title: string;
  text: string;
  openChat: (message: string) => void;
}): Promise<{ sharedWithFile: boolean; downloadedFile: boolean; openedChat: boolean }> {
  const { file, title, text, openChat } = params;
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const canShareFiles =
    !!nav &&
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    nav.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await nav!.share({
        files: [file],
        title,
        text,
      });
      return { sharedWithFile: true, downloadedFile: false, openedChat: false };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { sharedWithFile: false, downloadedFile: false, openedChat: false };
      }
    }
  }

  downloadBlobFile(file);
  openChat(
    [
      text,
      '',
      '📎 Your printable receipt PDF was downloaded.',
      'Please attach that PDF in this WhatsApp chat (paperclip → Document).',
    ].join('\n')
  );
  return { sharedWithFile: false, downloadedFile: true, openedChat: true };
}
