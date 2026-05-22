/* Quilt — left pane: Data / Columns / Filters tabs */

function LeftPane({ dataset, setDataset, filteredRows, selection, setSelection }) {
  const [tab, setTab] = useState('data');
  return (
    <div className="pane pane-left">
      <div className="pane-tabs">
        <button className={"tab" + (tab === 'data' ? ' active' : '')} onClick={() => setTab('data')}>
          Rows <span className="count">{filteredRows.length}</span>
        </button>
        <button className={"tab" + (tab === 'cols' ? ' active' : '')} onClick={() => setTab('cols')}>
          Columns <span className="count">{dataset.columns.filter(c => c.visible).length}</span>
        </button>
        <button className={"tab" + (tab === 'filters' ? ' active' : '')} onClick={() => setTab('filters')}>
          Filters <span className="count">{dataset.filters.length}</span>
        </button>
      </div>
      <div className="pane-body">
        {tab === 'data' && (
          <DataTab dataset={dataset} setDataset={setDataset} filteredRows={filteredRows} />
        )}
        {tab === 'cols' && (
          <ColumnsTab dataset={dataset} setDataset={setDataset} />
        )}
        {tab === 'filters' && (
          <FiltersTab dataset={dataset} setDataset={setDataset} />
        )}
      </div>
    </div>
  );
}

function DataTab({ dataset, setDataset, filteredRows }) {
  const visibleCols = dataset.columns.filter(c => c.visible);
  return (
    <>
      <div className="dat-toolbar">
        <div className="search-input">
          <Icon name="search" className="icon" />
          <input
            placeholder="Search rows…"
            value={dataset.search}
            onChange={e => setDataset(d => ({ ...d, search: e.target.value }))}
          />
        </div>
      </div>
      <div className="data-rows">
        {filteredRows.length === 0 && (
          <div className="empty-state">
            <div>No rows match.</div>
            <button className="btn btn-ghost btn-sm" style={{marginTop: 8}}
              onClick={() => setDataset(d => ({ ...d, search: '', filters: [] }))}>
              Clear filters
            </button>
          </div>
        )}
        {filteredRows.slice(0, 500).map((dr, i) => (
          <div className="data-row" key={dr.rowIndex}>
            <span className="idx">{i + 1}</span>
            <span className="cells">
              {dr.group && <span className="grouptag">{dr.group}</span>}
              {visibleCols.filter(c => c.id !== 'col_group').slice(0, 3).map(c => {
                const v = dr.values[c.raw];
                const text = MondayParser.formatForColumn(v, c);
                return <span key={c.id} className={"cell" + (text ? '' : ' dim')}>{text || '—'}</span>;
              })}
            </span>
          </div>
        ))}
        {filteredRows.length > 500 && (
          <div className="empty-state" style={{padding: 20}}>+ {filteredRows.length - 500} more rows…</div>
        )}
      </div>
    </>
  );
}

function ColumnsTab({ dataset, setDataset }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);

  function move(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setDataset(d => {
      const cols = d.columns.slice();
      const from = cols.findIndex(c => c.id === fromId);
      const to = cols.findIndex(c => c.id === toId);
      if (from < 0 || to < 0) return d;
      const [item] = cols.splice(from, 1);
      cols.splice(to, 0, item);
      return { ...d, columns: cols };
    });
  }
  function updateCol(id, patch) {
    setDataset(d => ({ ...d, columns: d.columns.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }

  return (
    <>
      <div className="dat-toolbar">
        <span className="text-muted" style={{fontSize: 12}}>Drag to reorder · click to toggle</span>
        <div className="grow"></div>
        <button className="btn btn-ghost btn-xs"
          onClick={() => setDataset(d => ({ ...d, columns: d.columns.map(c => ({...c, visible: true})) }))}>
          Show all
        </button>
      </div>
      <div className="col-list">
        {dataset.columns.map(c => (
          <div key={c.id}
            draggable
            onDragStart={() => setDraggingId(c.id)}
            onDragEnd={() => { setDraggingId(null); setOverId(null); }}
            onDragOver={e => { e.preventDefault(); setOverId(c.id); }}
            onDrop={() => { move(draggingId, c.id); setDraggingId(null); setOverId(null); }}
            className={"col-item" + (!c.visible ? ' hidden' : '') + (draggingId === c.id ? ' dragging' : '') + (overId === c.id && draggingId && draggingId !== c.id ? ' over' : '')}>
            <span className="grip"><Icon name="grip" size={12} /></span>
            <span className="name">
              <span className={"type-pill type-" + c.type} title={c.type}>
                <span className="swatch"></span>
              </span>
              <input className="name-edit"
                value={c.name}
                onChange={e => updateCol(c.id, { name: e.target.value })}
              />
            </span>
            <button className="vis-btn" title={c.visible ? 'Hide column' : 'Show column'}
              onClick={() => updateCol(c.id, { visible: !c.visible })}>
              <Icon name={c.visible ? 'eye' : 'eyeOff'} size={13} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function FiltersTab({ dataset, setDataset }) {
  function add() {
    setDataset(d => ({
      ...d,
      filters: [...d.filters, { id: uid('f'), col: d.columns[0]?.raw || '', op: 'contains', value: '' }],
    }));
  }
  function update(id, patch) {
    setDataset(d => ({
      ...d,
      filters: d.filters.map(f => f.id === id ? { ...f, ...patch } : f),
    }));
  }
  function remove(id) {
    setDataset(d => ({ ...d, filters: d.filters.filter(f => f.id !== id) }));
  }

  const ops = [
    { id: 'contains', label: 'contains' },
    { id: 'not_contains', label: 'does not contain' },
    { id: 'eq', label: 'is' },
    { id: 'neq', label: 'is not' },
    { id: 'gt', label: '>' },
    { id: 'lt', label: '<' },
    { id: 'gte', label: '≥' },
    { id: 'lte', label: '≤' },
    { id: 'not_empty', label: 'is not empty' },
    { id: 'empty', label: 'is empty' },
  ];

  return (
    <>
      <div className="dat-toolbar">
        <span className="text-muted" style={{fontSize: 12}}>Filters apply to the data set and to new table blocks.</span>
        <div className="grow"></div>
        <button className="btn btn-xs" onClick={add}><Icon name="plus" size={11} /> Add filter</button>
      </div>
      <div className="filter-list">
        {dataset.filters.length === 0 && (
          <div className="empty-state" style={{padding: '32px 12px'}}>
            <div className="big"><Icon name="filter" size={20} /></div>
            <div>No filters yet</div>
            <div className="text-faint" style={{fontSize: 11, marginTop: 4}}>Add one to narrow rows by status, date, value…</div>
          </div>
        )}
        {dataset.filters.map(f => (
          <div className="filter-row" key={f.id}>
            <select value={f.col} onChange={e => update(f.id, { col: e.target.value })}>
              {dataset.columns.map(c => <option key={c.id} value={c.raw}>{c.name}</option>)}
            </select>
            <select value={f.op} onChange={e => update(f.id, { op: e.target.value })}>
              {ops.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {(f.op === 'empty' || f.op === 'not_empty') ? <span></span> : (
              <input value={f.value || ''} onChange={e => update(f.id, { value: e.target.value })} placeholder="value" />
            )}
            <button className="x" onClick={() => remove(f.id)}><Icon name="x" size={12} /></button>
          </div>
        ))}
      </div>
      {dataset.groups && dataset.groups.length > 0 && (
        <div className="section">
          <div className="section-title"><span className="dot"></span> Groups</div>
          <div className="pill-row">
            {dataset.groups.map(g => {
              const active = dataset.groupFilter && dataset.groupFilter.includes(g);
              const hasFilter = dataset.groupFilter && dataset.groupFilter.length > 0;
              return (
                <button
                  key={g}
                  className="pill"
                  style={{
                    background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: active ? 'var(--accent-strong)' : 'inherit',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    opacity: hasFilter && !active ? 0.5 : 1,
                  }}
                  onClick={() => {
                    setDataset(d => {
                      const gf = d.groupFilter || [];
                      const next = active ? gf.filter(x => x !== g) : [...gf, g];
                      return { ...d, groupFilter: next };
                    });
                  }}>
                  {g}
                </button>
              );
            })}
            {dataset.groupFilter && dataset.groupFilter.length > 0 && (
              <button className="btn btn-ghost btn-xs"
                onClick={() => setDataset(d => ({ ...d, groupFilter: [] }))}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { LeftPane });
