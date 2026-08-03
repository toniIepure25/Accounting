/** Descarca un continut text ca fisier (XML, CSV etc.). */
export function downloadText(filename: string, text: string, mime = 'application/xml'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deschide o fereastra noua cu HTML si lanseaza dialogul de printare (print-to-PDF). */
export function printHtml(html: string): void {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
