/* Quilt — Upload + Confirm screens */

function UploadScreen({ onParsed, onLoadSample }) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files) {
    if (!files || !files[0]) return;
    setBusy(true); setErr(null);
    try {
      const wb = await MondayParser.readWorkbook(files[0]);
      onParsed(wb);
    } catch (e) {
      console.error(e);
      setErr('Could not read that file. Make sure it is an .xlsx, .xls, or .csv.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-screen">
      <div className="upload-card">
        <h1>Start with a monday.com export</h1>
        <p className="subtitle">Drop in the Excel file you exported from your monday board. We'll detect the column headers, groups, and totals — you confirm what's what.</p>
        <div
          className={"dropzone" + (drag ? " drag" : "")}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        >
          <div className="file-icon">
            <svg viewBox="0 0 48 56" width="48" height="56" aria-hidden>
              <path d="M4 2 H30 L44 16 V52 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 Z" fill="white" stroke="currentColor" strokeWidth="1.4" />
              <path d="M30 2 V16 H44" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <rect x="10" y="26" width="28" height="4" rx="1" fill="oklch(0.55 0.13 255)" opacity="0.25" />
              <rect x="10" y="34" width="22" height="4" rx="1" fill="oklch(0.55 0.13 255)" opacity="0.18" />
              <rect x="10" y="42" width="18" height="4" rx="1" fill="oklch(0.55 0.13 255)" opacity="0.12" />
            </svg>
          </div>
          <p style={{fontWeight: 500}}>{busy ? 'Reading…' : 'Drop your .xlsx here'}</p>
          <p className="hint">or click to browse · .xlsx, .xls, .csv</p>
          {!busy && <input type="file" accept=".xlsx,.xls,.csv" onChange={e => handleFiles(e.target.files)} />}
        </div>
        {err && <div style={{color: 'var(--danger)', fontSize: 12, marginTop: 12}}>{err}</div>}
        <div className="or">or</div>
        <button className="btn sample" onClick={onLoadSample}>
          <Icon name="sparkle" />
          Try with the sample timesheet
        </button>
        <div style={{marginTop: 24, fontSize: 11, color: 'var(--text-faint)', textAlign: 'center'}}>
          Files are parsed in your browser — nothing is uploaded.
        </div>
      </div>
    </div>
  );
}

function ConfirmScreen({ workbook, onBack, onConfirm }) {
  const [sheetIdx, setSheetIdx] = useState(0);
  const sheet = workbook.sheets[sheetIdx];
  const detected = useMemo(() => MondayParser.detect(sheet.rows), [sheet]);

  // Local editable state — initialize from detection
  const [title, setTitle] = useState(detected.title);
  const [columns, setColumns] = useState(detected.columns);
  const [includeGroupCol, setIncludeGroupCol] = useState(detected.groups.length > 0);
  const [skipSummaryRows, setSkipSummaryRows] = useState(true);

  useEffect(() => {
    setTitle(detected.title);
    setColumns(detected.columns);
    setIncludeGroupCol(detected.groups.length > 0);
  }, [sheetIdx]);

  if (detected.error) {
    return (
      <div className="confirm-screen">
        <div className="confirm-inner">
          <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> Back</button>
          <h1 style={{marginTop: 16}}>We couldn't find a column header</h1>
          <p className="sub">{detected.error}</p>
        </div>
      </div>
    );
  }

  function updateCol(id, patch) {
    setColumns(cols => cols.map(c => c.id === id ? { ...c, ...patch } : c));
  }
  function resetCol(id) {
    setColumns(cols => cols.map(c => c.id === id ? { ...c, name: c.cleaned, visible: true } : c));
  }

  function handleConfirm() {
    let finalCols = columns.slice();
    if (includeGroupCol && detected.groups.length > 0) {
      finalCols.unshift({
        id: 'col_group',
        raw: '__group__',
        cleaned: 'Group',
        name: 'Group',
        type: 'text',
        visible: true,
      });
    }
    // attach group as a value
    const dataRows = detected.dataRows.map(dr => ({
      ...dr,
      values: { ...dr.values, __group__: dr.group },
    }));
    onConfirm({
      sourceName: workbook.fileName,
      title,
      columns: finalCols,
      groups: detected.groups.map(g => g.name),
      dataRows,
      summaryRows: skipSummaryRows ? [] : detected.summaryRows,
    });
  }

  return (
    <div className="confirm-screen">
      <div className="confirm-inner">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" size={12} /> Pick a different file</button>
        <h1 style={{marginTop: 14}}>Confirm what we found</h1>
        <p className="sub">Monday exports have group rows, repeated headers, and totals tucked in. Here's what Quilt picked out of <span className="mono">{workbook.fileName}</span>.</p>

        {workbook.sheets.length > 1 && (
          <div style={{display: 'flex', gap: 6, marginBottom: 16}}>
            {workbook.sheets.map((s, i) => (
              <button key={s.name}
                className={"btn btn-sm" + (i === sheetIdx ? " btn-primary" : "")}
                onClick={() => setSheetIdx(i)}>{s.name}</button>
            ))}
          </div>
        )}

        <div className="detect-summary">
          <div className="detect-stat"><div className="v">{detected.dataRows.length}</div><div className="k">Data rows</div></div>
          <div className="detect-stat"><div className="v">{columns.length}</div><div className="k">Columns</div></div>
          <div className="detect-stat"><div className="v">{detected.groups.length}</div><div className="k">Groups</div></div>
          <div className="detect-stat"><div className="v">{detected.summaryRows.length}</div><div className="k">Totals rows</div></div>
        </div>

        <div className="confirm-card">
          <div className="confirm-card-head">
            <span className="label">Board title</span>
            <span className="title">Found on row 1</span>
          </div>
          <div className="confirm-card-body">
            <label>Used as the default document title</label>
            <input className="text-input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        </div>

        <div className="confirm-card">
          <div className="confirm-card-head">
            <span className="label">Columns</span>
            <span className="title">Rename, toggle, or change type</span>
            <span className="text-faint" style={{marginLeft: 'auto', fontSize: 12}}>{columns.filter(c => c.visible).length} of {columns.length} visible</span>
          </div>
          <table className="col-table">
            <thead>
              <tr>
                <th style={{width: 32}}></th>
                <th>Raw header</th>
                <th>Use as</th>
                <th>Type</th>
                <th style={{width: 60}}></th>
              </tr>
            </thead>
            <tbody>
              {columns.map(c => (
                <tr key={c.id} style={{opacity: c.visible ? 1 : 0.55}}>
                  <td>
                    <button className="btn-ghost" title={c.visible ? 'Hide' : 'Show'}
                      onClick={() => updateCol(c.id, { visible: !c.visible })}
                      style={{padding: '4px', borderRadius: 4, color: 'var(--text-muted)'}}>
                      <Icon name={c.visible ? 'eye' : 'eyeOff'} size={14} />
                    </button>
                  </td>
                  <td><span className="raw">{c.raw || '—'}</span></td>
                  <td>
                    <input className="text-input" style={{height: 28}}
                      value={c.name} onChange={e => updateCol(c.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <TypeMenu type={c.type} onChange={t => updateCol(c.id, { type: t })} />
                  </td>
                  <td style={{textAlign: 'right'}}>
                    {c.name !== c.cleaned && (
                      <button className="btn btn-ghost btn-xs" onClick={() => resetCol(c.id)} title="Reset to detected name">
                        <Icon name="refresh" size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="confirm-card">
          <div className="confirm-card-head">
            <span className="label">Cleanup options</span>
          </div>
          <div className="confirm-card-body" style={{display: 'grid', gap: 12}}>
            <label className="toggle">
              <input type="checkbox" checked={includeGroupCol} onChange={e => setIncludeGroupCol(e.target.checked)} />
              <span className="track"></span>
              <span>
                <strong>Add a <span className="mono">Group</span> column</strong>
                <span className="text-muted" style={{display: 'block', fontSize: 12}}>
                  Captures the section each row came from: {detected.groups.slice(0, 4).map(g => g.name).join(', ')}{detected.groups.length > 4 ? `, +${detected.groups.length - 4} more` : ''}
                </span>
              </span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={skipSummaryRows} onChange={e => setSkipSummaryRows(e.target.checked)} />
              <span className="track"></span>
              <span>
                <strong>Skip totals rows</strong>
                <span className="text-muted" style={{display: 'block', fontSize: 12}}>
                  We found {detected.summaryRows.length} summary row{detected.summaryRows.length === 1 ? '' : 's'} (date range + totals). They'll be left out of the data set.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="confirm-footer">
          <button className="btn" onClick={onBack}>Back</button>
          <div className="grow"></div>
          <span className="text-muted" style={{fontSize: 12}}>
            {detected.dataRows.length} rows · {columns.filter(c => c.visible).length + (includeGroupCol ? 1 : 0)} columns
          </span>
          <button className="btn btn-primary" onClick={handleConfirm}>
            Open in editor <Icon name="chevR" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeMenu({ type, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const opts = [
    { id: 'text', label: 'Text' },
    { id: 'number', label: 'Number' },
    { id: 'currency', label: 'Currency' },
    { id: 'date', label: 'Date' },
  ];
  return (
    <div style={{position: 'relative'}} ref={ref}>
      <button className={"type-pill type-" + type} onClick={() => setOpen(o => !o)}>
        <span className="swatch"></span>
        {opts.find(o => o.id === type)?.label || type}
        <Icon name="chevD" size={10} />
      </button>
      {open && (
        <div className="popover" style={{top: 24, left: 0, minWidth: 140}}>
          {opts.map(o => (
            <button key={o.id} className="opt" onClick={() => { onChange(o.id); setOpen(false); }}>
              <span className={"type-pill type-" + o.id}><span className="swatch"></span>{o.label}</span>
              {type === o.id && <Icon name="check" size={12} style={{marginLeft: 'auto', color: 'var(--accent)'}} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { UploadScreen, ConfirmScreen });
