/* Quilt — monday.com export parser
 *
 * Monday exports tend to include:
 *  - A title row (single cell, first row)
 *  - One or more "group" sections, each:
 *      - Group name row (single cell)
 *      - Header row (repeated each group)
 *      - Data rows
 *      - A summary/totals row (date range + numbers)
 *  - Blank separator rows
 *
 * We detect:
 *  - The board title
 *  - The header row (most common 'shape' of non-empty leading cells)
 *  - Group rows (single-cell rows that aren't the title or a header)
 *  - Data rows (rows that match header shape, attached to a group)
 *  - Summary rows (rows where most leading cells are empty but tail has numbers)
 */

(function () {
  const MondayParser = {};

  // ---------- Utilities ----------
  function isBlank(v) {
    return v === null || v === undefined || v === '' || (typeof v === 'string' && v.trim() === '');
  }
  function nonEmptyCount(row) {
    return row.filter(c => !isBlank(c)).length;
  }
  function isExcelSerialDate(v) {
    // Monday often exports dates as serial numbers (~ 45000+ for ~2023+)
    return typeof v === 'number' && v > 25000 && v < 60000 && Number.isFinite(v);
  }
  function excelSerialToDate(serial) {
    // Excel epoch: 1899-12-30 (account for 1900 leap bug)
    const ms = (serial - 25569) * 86400 * 1000;
    return new Date(ms);
  }
  function fmtDate(d) {
    if (!(d instanceof Date) || isNaN(d)) return '';
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // ---------- File reading ----------
  MondayParser.readWorkbook = async function (file) {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array', cellDates: false });
    const sheets = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // Trim trailing empties on each row
      return { name, rows };
    });
    return { sheets, fileName: file.name };
  };

  // ---------- Detection ----------
  MondayParser.detect = function (rows) {
    // 1) Find most common "header shape" - i.e. row signature
    //    by finding the longest run of leading non-empty cells that repeats.
    const signatures = {};
    rows.forEach((r, i) => {
      const cells = r.map(c => isBlank(c) ? '' : String(c).trim());
      // first stretch of non-empty before any empty
      let stretch = 0;
      for (let j = 0; j < cells.length; j++) {
        if (cells[j] !== '') stretch++;
        else if (stretch > 0) break;
      }
      if (stretch >= 3) {
        const sig = cells.slice(0, stretch).join('|');
        if (!signatures[sig]) signatures[sig] = { count: 0, indices: [], cells: cells.slice(0, stretch) };
        signatures[sig].count++;
        signatures[sig].indices.push(i);
      }
    });
    // pick signature with highest count and shortest "first index" (likely the header)
    const best = Object.values(signatures).sort((a, b) => b.count - a.count || a.indices[0] - b.indices[0])[0];
    if (!best) return { error: 'Could not detect a column header in this sheet.' };

    const headerRowIndices = new Set(best.indices);
    const headerCells = best.cells;
    const headerWidth = headerCells.length;

    // 2) Title is typically the first row IF it's a single non-empty cell and
    //    comes before any header
    let title = null;
    for (let i = 0; i < best.indices[0]; i++) {
      const r = rows[i];
      if (nonEmptyCount(r) === 1 && !isBlank(r[0])) {
        title = String(r[0]).trim();
        break;
      }
    }

    // 3) Detect groups. A group row is:
    //    - between header instances
    //    - single non-empty cell (or just first cell), text not numeric, not a header
    const groups = [];
    const groupRowIndices = new Set();
    rows.forEach((r, i) => {
      if (headerRowIndices.has(i)) return;
      if (nonEmptyCount(r) === 1 && !isBlank(r[0]) && typeof r[0] !== 'number') {
        // not the title (already extracted)
        if (i > 0 || !title) groupRowIndices.add(i);
      }
    });
    // For each group row, the group "owns" data rows until next group/header or end
    const groupAt = (idx) => {
      // find nearest groupRowIndex <= idx
      let g = null;
      for (const gi of groupRowIndices) {
        if (gi <= idx && (g === null || gi > g)) g = gi;
      }
      return g;
    };

    // 4) Walk all rows after first header. Classify each.
    const firstHeaderIdx = best.indices[0];
    const dataRows = [];
    const summaryRows = [];
    let currentGroup = null;
    for (let i = firstHeaderIdx; i < rows.length; i++) {
      const r = rows[i];
      if (headerRowIndices.has(i)) continue;
      if (groupRowIndices.has(i)) {
        currentGroup = String(r[0]).trim();
        groups.push({ name: currentGroup, rowIndex: i });
        continue;
      }
      const neCount = nonEmptyCount(r);
      if (neCount === 0) continue;

      // Summary heuristic: leading first cell empty + at least one numeric cell + has a "range" string
      const looksSummary = (
        (isBlank(r[0]) || isBlank(r[1])) &&
        r.some(c => typeof c === 'string' && /\d{4}-\d{2}-\d{2}\s*to\s*\d{4}-\d{2}-\d{2}/.test(c))
      ) || (
        // or: first 2 cells empty, has numbers in tail
        isBlank(r[0]) && isBlank(r[1]) && r.slice(2).some(c => typeof c === 'number' || (typeof c === 'string' && /^\$?[\d,.]+$/.test(c)))
      );
      if (looksSummary) {
        summaryRows.push({ rowIndex: i, group: currentGroup, values: r });
        continue;
      }

      // Data row: convert values appropriately
      const obj = {};
      for (let c = 0; c < headerWidth; c++) {
        const key = headerCells[c] || `col_${c}`;
        let v = r[c];
        if (isBlank(v)) v = null;
        else if (isExcelSerialDate(v)) v = excelSerialToDate(v);
        obj[key] = v;
      }
      dataRows.push({ rowIndex: i, group: currentGroup, values: obj });
    }

    // 5) Build column descriptors with type inference
    const columns = headerCells.map((raw, idx) => {
      const cleaned = cleanHeading(raw);
      // infer type from data
      let typeCounts = { number: 0, date: 0, text: 0, currency: 0 };
      for (const dr of dataRows) {
        const v = dr.values[raw];
        if (v === null || v === undefined) continue;
        if (v instanceof Date) typeCounts.date++;
        else if (typeof v === 'number') {
          // currency hints in column name, but only if it doesn't look like a unit column
          const looksUnit = /(hour|day|week|month|min|sec|qty|count|#|num\b)/i.test(raw);
          if (!looksUnit && /(\$|cost|price|rate|amount|total|revenue|budget|fee|salary)/i.test(raw)) typeCounts.currency++;
          else typeCounts.number++;
        }
        else typeCounts.text++;
      }
      const type = Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0][0] || 'text';
      return {
        id: `col_${idx}`,
        raw,
        cleaned,
        name: cleaned,
        type,
        visible: true,
      };
    });

    return {
      title: title || 'Untitled board',
      columns,
      groups,
      dataRows,
      summaryRows,
      headerRowIndices: [...headerRowIndices],
      totalRows: rows.length,
    };
  };

  // ---------- Heading cleanup ----------
  function cleanHeading(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    // Strip leading emoji + symbol clusters that monday users add (🟢, 🔥, etc.)
    s = s.replace(/^[\p{Extended_Pictographic}\p{Emoji_Component}\u2600-\u27BF\u{1F300}-\u{1FAFF}\s\-_:]+/u, '');
    // collapse whitespace
    s = s.replace(/\s+/g, ' ').trim();
    // Title-case if all caps
    if (s === s.toUpperCase() && s.length > 2 && /[A-Z]/.test(s)) {
      s = s.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase());
    }
    return s || raw;
  }
  MondayParser.cleanHeading = cleanHeading;

  // ---------- Filter evaluation ----------
  MondayParser.applyFilters = function (dataRows, filters, search, columns) {
    const visibleCols = columns.filter(c => c.visible).map(c => c.raw);
    return dataRows.filter(dr => {
      // search
      if (search && search.trim()) {
        const needle = search.toLowerCase();
        const hay = visibleCols.map(c => formatValue(dr.values[c])).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      // filters
      for (const f of filters) {
        if (!f || !f.col || !f.op) continue;
        const v = dr.values[f.col];
        if (!evalFilter(v, f)) return false;
      }
      return true;
    });
  };

  function evalFilter(v, f) {
    const op = f.op;
    if (op === 'not_empty') return v !== null && v !== undefined && v !== '';
    if (op === 'empty') return v === null || v === undefined || v === '';
    const target = f.value;
    if (op === 'eq') return String(v ?? '') === String(target ?? '');
    if (op === 'neq') return String(v ?? '') !== String(target ?? '');
    if (op === 'contains') return String(v ?? '').toLowerCase().includes(String(target ?? '').toLowerCase());
    if (op === 'not_contains') return !String(v ?? '').toLowerCase().includes(String(target ?? '').toLowerCase());
    if (op === 'gt' || op === 'lt' || op === 'gte' || op === 'lte') {
      const a = typeof v === 'number' ? v : parseFloat(v);
      const b = parseFloat(target);
      if (isNaN(a) || isNaN(b)) return false;
      if (op === 'gt') return a > b;
      if (op === 'lt') return a < b;
      if (op === 'gte') return a >= b;
      if (op === 'lte') return a <= b;
    }
    if (op === 'in_group') {
      // f.value is array of group names
      return Array.isArray(target) && target.includes(f._rowGroup);
    }
    return true;
  }

  function formatValue(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return fmtDate(v);
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return v.toString();
      return (Math.round(v * 100) / 100).toString();
    }
    return String(v);
  }
  MondayParser.formatValue = formatValue;
  MondayParser.fmtDate = fmtDate;

  function formatForColumn(v, col) {
    if (v === null || v === undefined || v === '') return '';
    if (col.type === 'currency' && typeof v === 'number') {
      return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    if (col.type === 'date') {
      if (v instanceof Date) return fmtDate(v);
      if (typeof v === 'string') return v;
    }
    if (col.type === 'number' && typeof v === 'number') {
      return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return formatValue(v);
  }
  MondayParser.formatForColumn = formatForColumn;

  window.MondayParser = MondayParser;
})();
