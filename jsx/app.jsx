/* Quilt — main app */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "accent": "oklch(0.55 0.13 255)",
  "leftPaneWidth": 380
}/*EDITMODE-END*/;

// Given a hero oklch color, derive 'strong' (darker) and 'soft' (very light) versions
function derivePalette(hero) {
  // Parse oklch(L C H) — fall back to fixed if not parseable
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(hero || '');
  if (!m) return { accent: hero, strong: hero, soft: 'oklch(0.95 0.03 250)' };
  const [, L, C, H] = m.map(Number);
  const strongL = Math.max(0.15, L - 0.08);
  const strong = `oklch(${strongL.toFixed(2)} ${(C * 1.05).toFixed(3)} ${H})`;
  const soft = `oklch(0.95 ${Math.min(0.05, C * 0.3).toFixed(3)} ${H})`;
  return { accent: hero, strong, soft };
}

function App() {
  // Persisted state in sessionStorage so reloads don't wipe progress
  const [stage, setStage] = useState('upload'); // upload | confirm | editor
  const [workbook, setWorkbook] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [doc, setDoc] = useState({ title: '', subtitle: '', blocks: [] });
  const [toast, setToast] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  useClickOutside(exportRef, () => setExportOpen(false), exportOpen);

  // Tweaks state
  const [tweaks, setTweaks] = useTweaks(TWEAK_DEFAULTS);

  // Apply accent via CSS vars
  useEffect(() => {
    const pal = derivePalette(tweaks.accent);
    document.documentElement.style.setProperty('--accent', pal.accent);
    document.documentElement.style.setProperty('--accent-strong', pal.strong);
    document.documentElement.style.setProperty('--accent-soft', pal.soft);
    document.documentElement.style.setProperty('--left-w', (tweaks.leftPaneWidth || 380) + 'px');
  }, [tweaks.accent, tweaks.leftPaneWidth]);

  // Filtered rows (memoized)
  const filteredRows = useMemo(() => {
    if (!dataset) return [];
    let rows = MondayParser.applyFilters(dataset.dataRows, dataset.filters, dataset.search, dataset.columns);
    if (dataset.groupFilter && dataset.groupFilter.length > 0) {
      rows = rows.filter(r => dataset.groupFilter.includes(r.group));
    }
    return rows;
  }, [dataset]);

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function handleParsed(wb) {
    setWorkbook(wb);
    setStage('confirm');
  }
  function handleConfirm(ds) {
    setDataset({
      ...ds,
      search: '',
      filters: [],
      groupFilter: [],
    });
    // Seed document with a smart starter outline
    const starter = buildStarterDoc(ds);
    setDoc(starter);
    setStage('editor');
  }
  function handleReset() {
    if (!confirm('Start over with a new file? Your document will be cleared.')) return;
    setWorkbook(null);
    setDataset(null);
    setDoc({ title: '', subtitle: '', blocks: [] });
    setStage('upload');
  }

  async function loadSample() {
    try {
      const res = await fetch('uploads/sample_data-1779454956509.xlsx');
      const blob = await res.blob();
      const file = new File([blob], 'sample_timesheet.xlsx', { type: blob.type });
      const wb = await MondayParser.readWorkbook(file);
      handleParsed(wb);
    } catch (e) {
      console.error(e);
      flash('Could not load sample');
    }
  }

  async function handleExport(kind) {
    setExportOpen(false);
    try {
      if (kind === 'docx') {
        await QuiltExporter.toDocx(doc, {
          columns: dataset.columns,
          evaluateBlock: (b) => {
            const baseRows = b.filterMode === 'inherit' ? filteredRows : dataset.dataRows;
            return MondayParser.applyFilters(baseRows, b.filters || [], '', dataset.columns)
              .filter(r => !b.groupFilter || b.groupFilter.length === 0 || b.groupFilter.includes(r.group))
              .slice(0, b.rowLimit || 1000);
          },
        });
        flash('Downloaded ' + (doc.title || 'document') + '.docx');
      } else if (kind === 'pdf') {
        flash('Opening print dialog — choose "Save as PDF"');
        setTimeout(() => QuiltExporter.toPdf(), 200);
      }
    } catch (e) {
      console.error(e);
      flash('Export failed: ' + e.message);
    }
  }

  return (
    <div className="app">
      <TopBar
        doc={doc} setDoc={setDoc}
        stage={stage} onReset={handleReset}
        sourceName={dataset?.sourceName || workbook?.fileName}
        onExport={() => setExportOpen(o => !o)}
        exportOpen={exportOpen}
        exportRef={exportRef}
        onExportPick={handleExport}
      />
      {stage === 'upload' && <UploadScreen onParsed={handleParsed} onLoadSample={loadSample} />}
      {stage === 'confirm' && workbook && (
        <ConfirmScreen workbook={workbook} onBack={() => { setWorkbook(null); setStage('upload'); }} onConfirm={handleConfirm} />
      )}
      {stage === 'editor' && dataset && (
        <div className="workspace">
          <LeftPane
            dataset={dataset} setDataset={setDataset}
            filteredRows={filteredRows}
          />
          <RightPane
            doc={doc} setDoc={setDoc}
            dataset={dataset} filteredRows={filteredRows}
            density={tweaks.density}
          />
        </div>
      )}
      <TweaksPanelWrap tweaks={tweaks} setTweaks={setTweaks} />
      <Toast msg={toast} />
    </div>
  );
}

function TopBar({ doc, setDoc, stage, onReset, sourceName, onExport, exportOpen, exportRef, onExportPick }) {
  return (
    <div className="topbar">
      <div className="logo">
        <span className="logo-mark"></span>
        Quilt
      </div>
      {stage === 'editor' && (
        <>
          <span className="crumb">
            <span className="sep">·</span>
            <span className="mono text-faint" style={{fontSize: 11}}>{sourceName}</span>
          </span>
          <span className="spacer"></span>
          <button className="btn btn-ghost btn-sm" onClick={onReset} title="Start over with a new file">
            <Icon name="refresh" size={12} /> New
          </button>
          <div style={{position: 'relative'}} ref={exportRef}>
            <button className="btn btn-primary btn-sm" onClick={onExport}>
              <Icon name="download" size={12} /> Export
              <Icon name="chevD" size={10} />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button className="opt" onClick={() => onExportPick('docx')}>
                  <span className="ic"><Icon name="word" size={14} /></span>
                  <span>
                    <div className="name">Word document</div>
                    <div className="desc">.docx · editable in Word, Google Docs, Pages</div>
                  </span>
                </button>
                <button className="opt" onClick={() => onExportPick('pdf')}>
                  <span className="ic"><Icon name="pdf" size={14} /></span>
                  <span>
                    <div className="name">PDF</div>
                    <div className="desc">Save via your browser's print dialog</div>
                  </span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {stage !== 'editor' && <span className="spacer"></span>}
    </div>
  );
}

function buildStarterDoc(ds) {
  // Project updates use case — start with a sensible outline
  const today = new Date();
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const date = `${m[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const blocks = [];
  blocks.push({ id: uid('blk'), type: 'h1', html: 'Summary' });
  blocks.push({ id: uid('blk'), type: 'p', html: `As of ${date}.` });
  const visibleCols = ds.columns.filter(c => c.visible && c.id !== 'col_group').slice(0, 5).map(c => c.id);
  blocks.push({
    id: uid('blk'), type: 'table',
    label: 'All rows',
    columns: visibleCols,
    filterMode: 'inherit',
    filters: [], groupFilter: [], rowLimit: 25,
  });
  return { title: ds.title || 'Project update', subtitle: '', blocks };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
