const CHIP_LABELS = {
  planning: 'Planning',
  active: 'Active',
  'on-hold': 'On Hold',
  completed: 'Completed',
  todo: 'To Do',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

export function renderChip(value) {
  const label = CHIP_LABELS[value] || value;
  const cls = value.replace(/\s/g, '-');
  return `<span class="chip chip-${cls}">${label}</span>`;
}

export class DataTable {
  constructor(container, options = {}) {
    this.container = container;
    this.columns = options.columns || [];
    this.getRowClass = options.getRowClass || (() => '');
    this.onRowClick = options.onRowClick || null;
    this.onCellEdit = options.onCellEdit || null;
    this.onEdit = options.onEdit || null;
    this.onDelete = options.onDelete || null;
    this.selectedId = options.selectedId || null;
    this.sortKey = options.sortKey || null;
    this.sortDir = options.sortDir || 'asc';
    this.rows = [];
  }

  setData(rows) {
    this.rows = rows;
    this.render();
  }

  setSelectedId(id) {
    this.selectedId = id;
    this.container.querySelectorAll('tbody tr').forEach(tr => {
      tr.classList.toggle('selected', tr.dataset.id === id);
    });
  }

  getVisibleColumns() {
    return this.columns.filter(col => !col.hidden);
  }

  render() {
    const cols = this.getVisibleColumns();
    const sorted = this.sortRows([...this.rows]);
    const html = `
      <table class="data-table" role="grid">
        <thead>
          <tr>
            ${cols.map(col => this.renderHeader(col)).join('')}
            ${this.onEdit || this.onDelete ? '<th class="col-actions"></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${sorted.length ? sorted.map(row => this.renderRow(row, cols)).join('') : '<tr><td colspan="99" class="empty-table">No records found</td></tr>'}
        </tbody>
      </table>
    `;
    this.container.innerHTML = html;
    this.bindEvents();
  }

  renderHeader(col) {
    const align = col.align === 'right' ? 'align-right' : '';
    const sticky = col.sticky ? 'col-sticky' : '';
    const sortable = col.sortable !== false ? 'sortable' : '';
    const sorted = this.sortKey === col.key ? 'sorted' : '';
    const indicator = this.sortKey === col.key
      ? (this.sortDir === 'asc' ? '▲' : '▼')
      : '⇅';
    return `<th class="${align} ${sticky} ${sortable} ${sorted}" data-key="${col.key}">${col.label}${sortable ? `<span class="sort-indicator">${indicator}</span>` : ''}</th>`;
  }

  renderRow(row, cols = this.getVisibleColumns()) {
    const rowClass = [
      this.selectedId === row.id ? 'selected' : '',
      this.getRowClass(row),
      row._inactive ? 'inactive' : '',
      row._hasViolation ? 'has-violation' : '',
      row._hasWarning && !row._hasViolation ? 'has-warning' : ''
    ].filter(Boolean).join(' ');

    const cells = cols.map(col => {
      const value = col.render ? col.render(row, row[col.key]) : this.formatCell(row, col);
      const align = col.align === 'right' ? 'align-right' : '';
      const sticky = col.sticky ? 'col-sticky' : '';
      const extraClass = col.cellClass ? col.cellClass(row) : '';
      const editable = col.editable ? 'cell-editable' : '';
      return `<td class="${align} ${sticky} ${extraClass} ${editable}" data-key="${col.key}" data-id="${row.id}" title="${col.truncate ? this.escape(row[col.key]) : ''}">${value}</td>`;
    }).join('');

    const actions = (this.onEdit || this.onDelete) ? `
      <td class="col-actions">
        <div class="row-actions">
          ${this.onEdit ? `<button type="button" class="btn-icon edit-btn" data-id="${row.id}" data-tooltip="Edit">✎</button>` : ''}
          ${this.onDelete ? `<button type="button" class="btn-icon danger delete-btn" data-id="${row.id}" data-tooltip="Delete">🗑</button>` : ''}
        </div>
      </td>
    ` : '';

    return `<tr class="${rowClass}" data-id="${row.id}">${cells}${actions}</tr>`;
  }

  formatCell(row, col) {
    const val = row[col.key];
    if (val === null || val === undefined || val === '') return '—';

    switch (col.type) {
      case 'chip':
        return renderChip(val);
      case 'currency':
        return `<span class="cell-mono">${this.formatCurrency(val)}</span>`;
      case 'date':
        return this.formatDate(val);
      case 'number':
        return `<span class="cell-mono">${Number(val).toLocaleString()}</span>`;
      default:
        if (col.truncate) {
          return `<span class="cell-truncate">${this.escape(String(val))}</span>`;
        }
        return this.escape(String(val));
    }
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Number(amount) || 0);
  }

  formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  sortRows(rows) {
    if (!this.sortKey) return rows;
    const col = this.columns.find(c => c.key === this.sortKey);
    return rows.sort((a, b) => {
      let av = a[this.sortKey];
      let bv = b[this.sortKey];
      if (col?.sortValue) {
        av = col.sortValue(a);
        bv = col.sortValue(b);
      }
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return this.sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  bindEvents() {
    this.container.querySelectorAll('thead th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (this.sortKey === key) {
          this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortKey = key;
          this.sortDir = 'asc';
        }
        this.render();
      });
    });

    this.container.querySelectorAll('tbody tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-icon') || e.target.closest('.cell-editing')) return;
        if (this.onRowClick) this.onRowClick(tr.dataset.id);
      });
    });

    this.container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onEdit) this.onEdit(btn.dataset.id);
      });
    });

    this.container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onDelete) this.onDelete(btn.dataset.id);
      });
    });

    if (this.onCellEdit) {
      this.container.querySelectorAll('td.cell-editable').forEach(td => {
        td.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.startInlineEdit(td);
        });
      });
    }
  }

  startInlineEdit(td) {
    const key = td.dataset.key;
    const id = td.dataset.id;
    const col = this.columns.find(c => c.key === key);
    if (!col?.editable) return;

    const row = this.rows.find(r => r.id === id);
    if (!row) return;

    const current = row[key] ?? '';
    td.classList.add('cell-editing');
    let input;

    if (col.type === 'chip' && col.options) {
      input = document.createElement('select');
      col.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = CHIP_LABELS[opt] || opt;
        o.selected = opt === current;
        input.appendChild(o);
      });
    } else if (col.type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
      input.value = current;
    } else if (col.type === 'currency' || col.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.value = current;
      input.min = '0';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = current;
    }

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    input.select?.();

    const commit = () => {
      let value = input.value;
      if (col.type === 'currency' || col.type === 'number') {
        value = Number(value) || 0;
      }
      td.classList.remove('cell-editing');
      if (this.onCellEdit) this.onCellEdit(id, key, value);
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { td.classList.remove('cell-editing'); this.render(); }
    });
  }
}
