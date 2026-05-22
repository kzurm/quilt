/* Quilt — right pane: block-based document editor */

const BLOCK_TYPES = [
  { id: 'h1', name: 'Heading', desc: 'Large section heading', icon: 'heading' },
  { id: 'h2', name: 'Subheading', desc: 'Smaller heading', icon: 'heading' },
  { id: 'p', name: 'Text', desc: 'Plain paragraph', icon: 'text' },
  { id: 'table', name: 'Table from data', desc: 'Embed selected rows + columns', icon: 'table' },
  { id: 'divider', name: 'Divider', desc: 'Horizontal rule', icon: 'divider' },
];

function makeBlock(type, dataset) {
  const id = uid('blk');
  if (type === 'h1') return { id, type, html: '' };
  if (type === 'h2') return { id, type, html: '' };
  if (type === 'p')  return { id, type, html: '' };
  if (type === 'divider') return { id, type, style: 'thin' };
  if (type === 'table') {
    return {
      id,
      type: 'table',
      label: '',
      // 'inherit' = use the dataset's global filter; null = no extra filter
      filterMode: 'inherit',
      filters: [],
      groupFilter: [],
      rowLimit: 25,
    };
  }
  return { id, type };
}

function RightPane({ doc, setDoc, dataset, filteredRows, density }) {
  const [selectedId, setSelectedId] = useState(null);
  const [slashAt, setSlashAt] = useState(null); // { afterId | 'start', x, y }

  function insertAfter(afterId, type) {
    const block = makeBlock(type, dataset);
    setDoc(d => {
      const blocks = d.blocks.slice();
      const idx = afterId === 'start' ? 0 : blocks.findIndex(b => b.id === afterId) + 1;
      blocks.splice(idx, 0, block);
      return { ...d, blocks };
    });
    setSelectedId(block.id);
    setSlashAt(null);
  }
  function updateBlock(id, patch) {
    setDoc(d => ({ ...d, blocks: d.blocks.map(b => b.id === id ? { ...b, ...patch } : b) }));
  }
  function removeBlock(id) {
    setDoc(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== id) }));
  }
  function duplicateBlock(id) {
    setDoc(d => {
      const blocks = d.blocks.slice();
      const idx = blocks.findIndex(b => b.id === id);
      if (idx < 0) return d;
      const copy = JSON.parse(JSON.stringify(blocks[idx]));
      copy.id = uid('blk');
      blocks.splice(idx + 1, 0, copy);
      return { ...d, blocks };
    });
  }
  function moveBlock(id, dir) {
    setDoc(d => {
      const blocks = d.blocks.slice();
      const i = blocks.findIndex(b => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= blocks.length) return d;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });
  }

  // Evaluator passed to TableBlock so it can show filtered preview
  const evalBlock = useCallback((block) => {
    const baseRows = block.filterMode === 'inherit' ? filteredRows : dataset.dataRows;
    return MondayParser.applyFilters(baseRows, block.filters || [], '', dataset.columns)
      .filter(r => {
        if (!block.groupFilter || block.groupFilter.length === 0) return true;
        return block.groupFilter.includes(r.group);
      })
      .slice(0, block.rowLimit || 1000);
  }, [filteredRows, dataset]);

  return (
    <div className={"pane pane-right " + (density === 'compact' ? 'density-compact' : '')}>
      <div className="doc-canvas">
        <input className="doc-title" value={doc.title} placeholder="Untitled document"
          onChange={e => setDoc(d => ({ ...d, title: e.target.value }))} />
        <input className="doc-subtitle" value={doc.subtitle} placeholder="Subtitle (optional)"
          onChange={e => setDoc(d => ({ ...d, subtitle: e.target.value }))} />

        {doc.blocks.length === 0 && (
          <div style={{padding: '32px 0', textAlign: 'center', color: 'var(--text-faint)'}}>
            <div style={{display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8}}>
              <Icon name="plus" size={14} />
              Click "Add block" or press <span className="kbd">/</span> to start
            </div>
          </div>
        )}

        <BlockAdder onAdd={(t) => insertAfter('start', t)} first />

        {doc.blocks.map((b, i) => (
          <Fragment key={b.id}>
            <BlockWrap
              block={b}
              selected={selectedId === b.id}
              onSelect={() => setSelectedId(b.id)}
              onUpdate={(patch) => updateBlock(b.id, patch)}
              onRemove={() => removeBlock(b.id)}
              onDuplicate={() => duplicateBlock(b.id)}
              onMove={(dir) => moveBlock(b.id, dir)}
              dataset={dataset}
              evalBlock={evalBlock}
              canUp={i > 0}
              canDown={i < doc.blocks.length - 1}
            />
            <BlockAdder onAdd={(t) => insertAfter(b.id, t)} />
          </Fragment>
        ))}

        {doc.blocks.length > 0 && (
          <BlockAdder
            onAdd={(t) => insertAfter(doc.blocks[doc.blocks.length - 1].id, t)}
            always
          />
        )}
      </div>
    </div>
  );
}

function BlockAdder({ onAdd, first, always }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const menu = open && (
    <div className="slash-menu" style={{top: always ? 36 : 24, left: '50%', transform: 'translateX(-50%)'}}>
      <div className="group-label">Blocks</div>
      {BLOCK_TYPES.map(bt => (
        <button key={bt.id} className="item" onClick={() => { onAdd(bt.id); setOpen(false); }}>
          <span className="ic"><Icon name={bt.icon} size={14} /></span>
          <span>
            <div className="name">{bt.name}</div>
            <div className="desc">{bt.desc}</div>
          </span>
        </button>
      ))}
    </div>
  );
  if (always) {
    return (
      <div ref={ref} style={{position: 'relative', display: 'flex', justifyContent: 'center', padding: '24px 0 8px'}}>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}
          style={{color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius)', padding: '0 12px'}}>
          <Icon name="plus" size={12} /> Add block
        </button>
        {menu}
      </div>
    );
  }
  return (
    <div className={"block-add"} style={{opacity: open ? 1 : undefined, height: first ? 24 : 14}} ref={ref}>
      <span className="line" style={{display: open ? 'block' : undefined}}></span>
      <button className="plus" onClick={() => setOpen(o => !o)} aria-label="Add block">
        <Icon name="plus" size={12} />
      </button>
      {menu}
    </div>
  );
}

function BlockWrap({ block, selected, onSelect, onUpdate, onRemove, onDuplicate, onMove, dataset, evalBlock, canUp, canDown }) {
  return (
    <div className={"block-wrap" + (selected ? " selected" : "")} onMouseDown={onSelect}>
      <div className="block-handle">
        <button title="Move up" disabled={!canUp} onClick={() => onMove(-1)}><Icon name="chevD" size={12} style={{transform: 'rotate(180deg)'}} /></button>
        <button title="Move down" disabled={!canDown} onClick={() => onMove(1)}><Icon name="chevD" size={12} /></button>
        <button title="Duplicate" onClick={onDuplicate}><Icon name="copy" size={12} /></button>
        <button title="Delete" onClick={onRemove}><Icon name="trash" size={12} /></button>
      </div>
      <div className="block-frame">
        {(block.type === 'h1' || block.type === 'h2' || block.type === 'p') &&
          <RichTextBlock block={block} onUpdate={onUpdate} />}
        {block.type === 'divider' && <DividerBlock block={block} onUpdate={onUpdate} />}
        {block.type === 'table' && <TableBlock block={block} onUpdate={onUpdate} dataset={dataset} evalBlock={evalBlock} />}
      </div>
    </div>
  );
}

function RichTextBlock({ block, onUpdate }) {
  const ref = useRef(null);
  const className = block.type === 'h1' ? 'b-h1' : block.type === 'h2' ? 'b-h2' : 'b-p';
  const placeholder = block.type === 'h1' ? 'Heading' : block.type === 'h2' ? 'Subheading' : 'Type some text…';
  // Use uncontrolled contenteditable to avoid caret-jump on every keystroke
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (block.html || '')) {
      ref.current.innerHTML = block.html || '';
    }
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={() => onUpdate({ html: ref.current.innerHTML })}
      onInput={() => onUpdate({ html: ref.current.innerHTML })}
    />
  );
}

function DividerBlock({ block, onUpdate }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{position: 'relative'}}>
      <div className={"b-divider " + (block.style || 'thin')}></div>
      {hover && (
        <div style={{position: 'absolute', right: 0, top: -10, display: 'flex', gap: 4}}>
          {['thin','thick','dotted'].map(s => (
            <button key={s} className="btn btn-ghost btn-xs"
              style={{textTransform: 'capitalize', color: block.style === s ? 'var(--accent)' : undefined}}
              onClick={() => onUpdate({ style: s })}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function TableBlock({ block, onUpdate, dataset, evalBlock }) {
  const cols = dataset.columns.filter(c => c.visible && c.id !== 'col_group');
  const rows = evalBlock(block);

  return (
    <div className="b-table">
      <div className="b-table-head">
        <span className="label">
          <Icon name="table" size={12} />
          <input
            value={block.label}
            placeholder="Table label (optional)"
            onChange={e => onUpdate({ label: e.target.value })}
          />
        </span>
        <span className="meta mono">{rows.length} row{rows.length === 1 ? '' : 's'} · {cols.length} col{cols.length === 1 ? '' : 's'}</span>
      </div>

      {cols.length === 0 && <div className="b-table-empty">Enable a column in the left panel to see data here.</div>}
      {cols.length > 0 && (
        <div style={{overflow: 'auto', maxHeight: 480}}>
          <table>
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c.id} className={c.type === 'number' || c.type === 'currency' ? 'num' : ''}>{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={cols.length} className="b-table-empty">No rows match this table's filters.</td></tr>
              )}
              {rows.map(dr => (
                <tr key={dr.rowIndex}>
                  {cols.map(c => {
                    const v = dr.values[c.raw];
                    const isNum = c.type === 'number' || c.type === 'currency';
                    const t = MondayParser.formatForColumn(v, c);
                    return <td key={c.id} className={(isNum ? 'num ' : '') + (c.raw === 'Activities' || (typeof v === 'string' && v.length > 40) ? 'long' : '')}>{t}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="b-table-config">
        <div className="row" style={{color: 'var(--text-faint)', fontSize: 11}}>
          Columns follow the left panel — toggle and reorder there.
        </div>
        <div className="row">
          <span className="label">Filter from</span>
          <select className="text-input" style={{width: 'auto', height: 24, padding: '0 8px'}}
            value={block.filterMode}
            onChange={e => onUpdate({ filterMode: e.target.value })}>
            <option value="inherit">Inherit page filters</option>
            <option value="all">All rows in source</option>
          </select>
          {dataset.groups && dataset.groups.length > 0 && (
            <>
              <span className="label" style={{marginLeft: 8}}>Groups</span>
              {dataset.groups.slice(0, 6).map(g => {
                const active = block.groupFilter && block.groupFilter.includes(g);
                return (
                  <button key={g}
                    className="colchip"
                    style={{
                      background: active ? 'var(--accent-soft)' : undefined,
                      borderColor: active ? 'var(--accent)' : undefined,
                      color: active ? 'var(--accent-strong)' : undefined,
                    }}
                    onClick={() => {
                      const gf = block.groupFilter || [];
                      const next = active ? gf.filter(x => x !== g) : [...gf, g];
                      onUpdate({ groupFilter: next });
                    }}>{g}</button>
                );
              })}
              {dataset.groups.length > 6 && (
                <GroupMore groups={dataset.groups.slice(6)} value={block.groupFilter || []} onChange={(gf) => onUpdate({ groupFilter: gf })} />
              )}
            </>
          )}
          <span className="grow"></span>
          <span className="label">Limit</span>
          <input type="number" min={1} max={9999}
            className="text-input" style={{width: 70, height: 24, padding: '0 6px'}}
            value={block.rowLimit || 25}
            onChange={e => onUpdate({ rowLimit: parseInt(e.target.value) || 25 })} />
        </div>
      </div>
    </div>
  );
}

function GroupMore({ groups, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <span style={{position: 'relative'}} ref={ref}>
      <button className="colchip" onClick={() => setOpen(o => !o)}>+{groups.length}</button>
      {open && (
        <div className="popover" style={{top: 26, left: 0, maxHeight: 280, overflow: 'auto'}}>
          {groups.map(g => {
            const active = value.includes(g);
            return (
              <button key={g} className="opt" onClick={() => onChange(active ? value.filter(x => x !== g) : [...value, g])}>
                <span style={{width: 14, color: 'var(--accent)'}}>{active ? <Icon name="check" size={12} /> : null}</span>
                {g}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

Object.assign(window, { RightPane });
