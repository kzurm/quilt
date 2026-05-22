/* Quilt — exporters: DOCX (via docx lib) and PDF (via window.print).
 *
 * Builds a docx.Document from the doc-block tree.
 */
(function () {
  const Exporter = {};

  function makeRun(text, opts) {
    opts = opts || {};
    return new docx.TextRun({
      text: text || '',
      bold: opts.bold,
      italics: opts.italic,
      color: opts.color,
      size: opts.size, // half-points
      font: opts.font,
    });
  }

  function paragraph(text, opts) {
    opts = opts || {};
    return new docx.Paragraph({
      heading: opts.heading,
      spacing: { before: opts.before || 0, after: opts.after || 120 },
      children: [makeRun(text, opts)],
    });
  }

  function richParagraph(html, opts) {
    // Minimal: parse text content, support ref-chip spans
    opts = opts || {};
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    const children = [];
    tmp.childNodes.forEach(node => {
      if (node.nodeType === 3) {
        children.push(makeRun(node.textContent));
      } else if (node.nodeType === 1) {
        const t = node.textContent;
        const isBold = node.tagName === 'B' || node.tagName === 'STRONG' || (node.style && node.style.fontWeight && parseInt(node.style.fontWeight) >= 600);
        const isItalic = node.tagName === 'I' || node.tagName === 'EM';
        const isRef = node.classList && node.classList.contains('ref-chip');
        children.push(makeRun(t, {
          bold: isBold, italic: isItalic,
          color: isRef ? '3B5BDB' : undefined,
        }));
      }
    });
    if (!children.length) children.push(makeRun(''));
    return new docx.Paragraph({
      heading: opts.heading,
      spacing: { before: opts.before || 0, after: opts.after || 120 },
      children,
    });
  }

  function tableCell(text, opts) {
    opts = opts || {};
    return new docx.TableCell({
      children: [new docx.Paragraph({
        alignment: opts.right ? docx.AlignmentType.RIGHT : docx.AlignmentType.LEFT,
        children: [makeRun(text || '', { bold: opts.bold, size: opts.size || 20 })],
      })],
      shading: opts.shading ? { type: docx.ShadingType.CLEAR, color: 'auto', fill: opts.shading } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });
  }

  function tableBlock(block, ctx) {
    const cols = ctx.columns.filter(c => c.visible && c.id !== 'col_group');
    if (!cols.length) return paragraph('(empty table)', { italic: true, color: '999999' });
    const filtered = ctx.evaluateBlock(block);

    const headerCells = cols.map(c => tableCell(c.name, { bold: true, shading: 'F2F4F7' }));
    const headerRow = new docx.TableRow({ children: headerCells, tableHeader: true });

    const bodyRows = filtered.map(dr => new docx.TableRow({
      children: cols.map(c => {
        const v = dr.values[c.raw];
        const isNum = c.type === 'number' || c.type === 'currency';
        return tableCell(window.MondayParser.formatForColumn(v, c), { right: isNum });
      }),
    }));

    return new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: {
        top:    { style: 'single', size: 4, color: 'D0D5DD' },
        bottom: { style: 'single', size: 4, color: 'D0D5DD' },
        left:   { style: 'single', size: 4, color: 'D0D5DD' },
        right:  { style: 'single', size: 4, color: 'D0D5DD' },
        insideHorizontal: { style: 'single', size: 4, color: 'E4E7EC' },
        insideVertical:   { style: 'single', size: 4, color: 'E4E7EC' },
      },
      rows: [headerRow, ...bodyRows],
    });
  }

  Exporter.toDocx = async function (doc, ctx) {
    const children = [];
    if (doc.title) {
      children.push(paragraph(doc.title, { heading: docx.HeadingLevel.TITLE, after: 60 }));
    }
    if (doc.subtitle) {
      children.push(paragraph(doc.subtitle, { color: '6B7280', after: 240, size: 22 }));
    }
    for (const b of doc.blocks) {
      if (b.type === 'h1') children.push(richParagraph(b.html, { heading: docx.HeadingLevel.HEADING_1, before: 200, after: 100 }));
      else if (b.type === 'h2') children.push(richParagraph(b.html, { heading: docx.HeadingLevel.HEADING_2, before: 180, after: 80 }));
      else if (b.type === 'p') children.push(richParagraph(b.html));
      else if (b.type === 'divider') children.push(new docx.Paragraph({
        border: { bottom: { color: 'D0D5DD', space: 1, style: 'single', size: 6 } },
        spacing: { before: 80, after: 80 },
      }));
      else if (b.type === 'table') children.push(tableBlock(b, ctx));
    }
    const docFile = new docx.Document({
      creator: 'Quilt',
      title: doc.title || 'Document',
      styles: {
        default: {
          document: { run: { font: 'Calibri', size: 22 } },
          heading1: { run: { font: 'Calibri', size: 32, bold: true, color: '111827' }, paragraph: { spacing: { before: 240, after: 120 } } },
          heading2: { run: { font: 'Calibri', size: 26, bold: true, color: '111827' }, paragraph: { spacing: { before: 200, after: 100 } } },
          title: { run: { font: 'Calibri', size: 44, bold: true, color: '111827' }, paragraph: { spacing: { after: 80 } } },
        },
      },
      sections: [{ children }],
    });
    const blob = await docx.Packer.toBlob(docFile);
    triggerDownload(blob, (doc.title || 'document').replace(/[^a-z0-9_\- ]/gi, '_') + '.docx');
  };

  Exporter.toPdf = function () {
    // Just leverage browser print to PDF — our print stylesheet does the work.
    window.print();
  };

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 200);
  }

  window.QuiltExporter = Exporter;
})();
