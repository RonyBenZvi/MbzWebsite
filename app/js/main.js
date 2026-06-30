import {
  load, subscribe, getProjects, getTasks, getProject,
  addProject, updateProject, deleteProject,
  addTask, updateTask, deleteTask,
  exportData, importData,
  PROJECT_STATUSES, TASK_STATUSES, PRIORITIES
} from './store.js';
import { aggregateProject, formatCurrency, formatDateRange } from './aggregator.js';
import { validateAll, getProjectValidation } from './validator.js';
import { DataTable, renderChip } from './components/data-table.js';
import { renderAlertBar, setProjectNames } from './components/alert-bar.js';
import { renderSummaryPanel } from './components/summary-panel.js';

const state = {
  selectedProjectId: null,
  showAllTasks: false,
  searchQuery: '',
  editingEntity: null,
  editingType: null
};

let projectsTable;
let tasksTable;

const els = {
  searchInput: document.getElementById('search-input'),
  alertBar: document.getElementById('alert-bar'),
  projectsTable: document.getElementById('projects-table'),
  tasksTable: document.getElementById('tasks-table'),
  projectsCount: document.getElementById('projects-count'),
  tasksCount: document.getElementById('tasks-count'),
  taskFilterBadge: document.getElementById('task-filter-badge'),
  showAllTasks: document.getElementById('show-all-tasks'),
  summaryEmpty: document.getElementById('summary-empty'),
  summaryContent: document.getElementById('summary-content'),
  formModal: document.getElementById('form-modal'),
  entityForm: document.getElementById('entity-form'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalClose: document.getElementById('modal-close'),
  modalCancel: document.getElementById('modal-cancel'),
  btnAddProject: document.getElementById('btn-add-project'),
  btnAddTask: document.getElementById('btn-add-task'),
  btnExport: document.getElementById('btn-export'),
  btnImport: document.getElementById('btn-import'),
  importFile: document.getElementById('import-file')
};

function init() {
  load();
  initTables();
  bindEvents();
  subscribe(refresh);
  refresh();
}

function initTables() {
  projectsTable = new DataTable(els.projectsTable, {
    columns: [
      {
        key: 'name',
        label: 'Name',
        sticky: true,
        truncate: true,
        cellClass: () => 'cell-name',
        render: (row) => {
          const icon = row._hasViolation
            ? `<span class="violation-icon" data-tooltip="${escapeAttr(row._violationTooltip)}">⚠</span>`
            : row._hasWarning
              ? `<span class="warning-icon" data-tooltip="${escapeAttr(row._violationTooltip)}">⚠</span>`
              : '';
          return `<div class="name-cell-wrap">${icon}<span>${escapeHtml(row.name)}</span></div>`;
        }
      },
      {
        key: 'status',
        label: 'Status',
        type: 'chip',
        editable: true,
        options: PROJECT_STATUSES
      },
      {
        key: 'client',
        label: 'Client',
        truncate: true
      },
      {
        key: 'budgetDisplay',
        label: 'Budget',
        align: 'right',
        sortValue: (row) => row._taskBudgetSum,
        cellClass: (row) => {
          if (row._taskBudgetSum > row.budget) return 'cell-overbudget cell-mono';
          if (row.budget > 0 && row._taskBudgetSum > row.budget * 0.9) return 'cell-warning-budget cell-mono';
          return 'cell-mono';
        },
        render: (row) => `${formatCurrency(row._taskBudgetSum)} / ${formatCurrency(row.budget)}`
      },
      {
        key: 'timeline',
        label: 'Timeline',
        sortValue: (row) => row.startDate || '',
        render: (row) => {
          const fence = formatDateRange(row.startDate, row.endDate);
          const outOfRange = row._timelineOutOfRange;
          return outOfRange
            ? `<span style="color:var(--error)" title="Tasks extend beyond project dates">${fence} ⚠</span>`
            : fence;
        }
      },
      {
        key: 'taskCount',
        label: 'Tasks',
        align: 'right',
        type: 'number',
        sortValue: (row) => row._taskCount
      }
    ],
    getRowClass: (row) => {
      if (row.status === 'completed' || row.status === 'on-hold') return 'inactive';
      return '';
    },
    onRowClick: (id) => {
      state.selectedProjectId = id;
      state.showAllTasks = false;
      els.showAllTasks.checked = false;
      refresh();
    },
    onCellEdit: (id, key, value) => {
      if (key === 'status') updateProject(id, { status: value });
    },
    onEdit: (id) => openModal('project', id),
    onDelete: (id) => confirmDeleteProject(id)
  });

  tasksTable = new DataTable(els.tasksTable, {
    columns: initTaskColumns(),
    getRowClass: (row) => {
      if (row.status === 'done') return 'inactive';
      return '';
    },
    onCellEdit: (id, key, value) => {
      updateTask(id, { [key]: value });
    },
    onEdit: (id) => openModal('task', id),
    onDelete: (id) => {
      if (confirm('Delete this task?')) deleteTask(id);
    }
  });
}

function bindEvents() {
  els.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    refresh();
  });

  els.showAllTasks.addEventListener('change', (e) => {
    state.showAllTasks = e.target.checked;
    if (state.showAllTasks) state.selectedProjectId = null;
    refresh();
  });

  els.btnAddProject.addEventListener('click', () => openModal('project'));
  els.btnAddTask.addEventListener('click', () => openModal('task'));
  els.btnExport.addEventListener('click', () => exportData());
  els.btnImport.addEventListener('click', () => els.importFile.click());

  els.importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const mode = confirm('Click OK to replace all data, or Cancel to merge with existing data.') ? 'replace' : 'merge';
      importData(text, mode);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  });

  els.modalClose.addEventListener('click', closeModal);
  els.modalCancel.addEventListener('click', closeModal);
  els.entityForm.addEventListener('submit', handleFormSubmit);
  els.formModal.addEventListener('click', (e) => {
    if (e.target === els.formModal) closeModal();
  });
}

function refresh() {
  const validation = validateAll();
  const projects = getProjects();
  const tasks = getTasks();
  setProjectNames(projects);

  renderAlertBar(els.alertBar, validation, (projectId) => {
    state.selectedProjectId = projectId;
    state.showAllTasks = false;
    els.showAllTasks.checked = false;
    refresh();
  });

  const projectRows = buildProjectRows(projects, validation);
  const filteredProjects = filterBySearch(projectRows, state.searchQuery);
  projectsTable.selectedId = state.selectedProjectId;
  projectsTable.setData(filteredProjects);
  els.projectsCount.textContent = filteredProjects.length;

  const taskRows = buildTaskRows(tasks, projects, validation);
  const filteredTasks = filterTasks(taskRows);
  updateTaskColumns();
  tasksTable.setData(filteredTasks);
  els.tasksCount.textContent = filteredTasks.length;

  const selectedProject = state.selectedProjectId ? getProject(state.selectedProjectId) : null;
  const projectValidation = state.selectedProjectId ? getProjectValidation(state.selectedProjectId) : null;
  renderSummaryPanel(null, els.summaryEmpty, els.summaryContent, selectedProject, projectValidation);

  updateTaskFilterBadge(selectedProject);
}

function buildProjectRows(projects, validation) {
  return projects.map(p => {
    const agg = aggregateProject(p);
    const v = validation.results.find(r => r.projectId === p.id);
    const timelineOutOfRange =
      (agg.earliestTaskStart && p.startDate && agg.earliestTaskStart < p.startDate) ||
      (agg.latestTaskEnd && p.endDate && agg.latestTaskEnd > p.endDate);

    return {
      ...p,
      _taskBudgetSum: agg.taskBudgetSum,
      _taskCount: agg.taskCount,
      _hasViolation: v?.hasErrors,
      _hasWarning: v?.hasWarnings,
      _violationTooltip: v?.all.map(i => i.message).join(' · ') || '',
      _timelineOutOfRange: timelineOutOfRange,
      taskCount: agg.taskCount
    };
  });
}

function buildTaskRows(tasks, projects, validation) {
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
  return tasks.map(t => ({
    ...t,
    projectName: projectMap[t.projectId] || 'Unknown',
    _hasViolation: validation.violatingTaskIds.has(t.id) ||
      Boolean(validation.results.find(r => r.projectId === t.projectId)?.hasErrors),
    _hasWarning: !validation.violatingTaskIds.has(t.id) &&
      Boolean(validation.results.find(r => r.projectId === t.projectId)?.hasWarnings) &&
      !validation.results.find(r => r.projectId === t.projectId)?.hasErrors
  }));
}

function filterTasks(taskRows) {
  let rows = taskRows;

  if (!state.showAllTasks && state.selectedProjectId) {
    rows = rows.filter(t => t.projectId === state.selectedProjectId);
  }

  if (state.searchQuery) {
    rows = filterBySearch(rows, state.searchQuery);
  }

  return rows;
}

function filterBySearch(rows, query) {
  if (!query) return rows;
  return rows.filter(row =>
    Object.values(row).some(v =>
      v != null && String(v).toLowerCase().includes(query)
    )
  );
}

function updateTaskFilterBadge(project) {
  if (project && !state.showAllTasks) {
    els.taskFilterBadge.textContent = project.name;
    els.taskFilterBadge.classList.remove('hidden');
  } else {
    els.taskFilterBadge.classList.add('hidden');
  }
}

function updateTaskColumns() {
  const hideProject = !state.showAllTasks && !!state.selectedProjectId;
  const baseColumns = initTaskColumns();
  tasksTable.columns = baseColumns.map(col =>
    col.key === 'projectName' ? { ...col, hidden: hideProject } : col
  );
}

function initTaskColumns() {
  return [
    { key: 'name', label: 'Name', sticky: true, truncate: true, editable: true, cellClass: () => 'cell-name' },
    { key: 'projectName', label: 'Project', truncate: true, sortValue: (row) => row.projectName },
    { key: 'status', label: 'Status', type: 'chip', editable: true, options: TASK_STATUSES },
    { key: 'priority', label: 'Priority', type: 'chip', editable: true, options: PRIORITIES },
    { key: 'budget', label: 'Budget', type: 'currency', align: 'right', editable: true },
    { key: 'startDate', label: 'Start', type: 'date', editable: true },
    { key: 'endDate', label: 'End', type: 'date', editable: true },
    { key: 'assignee', label: 'Assignee', truncate: true, editable: true }
  ];
}

function openModal(type, id = null) {
  state.editingType = type;
  state.editingEntity = id;

  if (type === 'project') {
    const project = id ? getProject(id) : null;
    els.modalTitle.textContent = project ? 'Edit Project' : 'Add Project';
    els.modalBody.innerHTML = buildProjectForm(project);
  } else {
    const task = id ? getTasks().find(t => t.id === id) : null;
    els.modalTitle.textContent = task ? 'Edit Task' : 'Add Task';
    els.modalBody.innerHTML = buildTaskForm(task);
  }

  els.formModal.showModal();
}

function buildProjectForm(project) {
  const p = project || {
    name: '', status: 'planning', budget: 0,
    startDate: '', endDate: '', client: '', notes: ''
  };
  return `
    <div class="form-group">
      <label for="f-name">Name *</label>
      <input id="f-name" name="name" required value="${escapeAttr(p.name)}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="f-status">Status</label>
        <select id="f-status" name="status">
          ${PROJECT_STATUSES.map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="f-budget">Budget (fence)</label>
        <input id="f-budget" name="budget" type="number" min="0" value="${p.budget || 0}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="f-start">Start Date (fence)</label>
        <input id="f-start" name="startDate" type="date" value="${p.startDate || ''}">
      </div>
      <div class="form-group">
        <label for="f-end">End Date (fence)</label>
        <input id="f-end" name="endDate" type="date" value="${p.endDate || ''}">
      </div>
    </div>
    <div class="form-group">
      <label for="f-client">Client</label>
      <input id="f-client" name="client" value="${escapeAttr(p.client || '')}">
    </div>
    <div class="form-group">
      <label for="f-notes">Notes</label>
      <textarea id="f-notes" name="notes">${escapeHtml(p.notes || '')}</textarea>
    </div>
  `;
}

function buildTaskForm(task) {
  const projects = getProjects();
  const t = task || {
    name: '', projectId: state.selectedProjectId || (projects[0]?.id || ''),
    status: 'todo', budget: 0, startDate: '', endDate: '',
    assignee: '', priority: 'medium'
  };
  return `
    <div class="form-group">
      <label for="f-name">Name *</label>
      <input id="f-name" name="name" required value="${escapeAttr(t.name)}">
    </div>
    <div class="form-group">
      <label for="f-projectId">Project *</label>
      <select id="f-projectId" name="projectId" required>
        ${projects.map(p => `<option value="${p.id}" ${t.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="f-status">Status</label>
        <select id="f-status" name="status">
          ${TASK_STATUSES.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="f-priority">Priority</label>
        <select id="f-priority" name="priority">
          ${PRIORITIES.map(s => `<option value="${s}" ${t.priority === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label for="f-budget">Budget</label>
      <input id="f-budget" name="budget" type="number" min="0" value="${t.budget || 0}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="f-start">Start Date</label>
        <input id="f-start" name="startDate" type="date" value="${t.startDate || ''}">
      </div>
      <div class="form-group">
        <label for="f-end">End Date</label>
        <input id="f-end" name="endDate" type="date" value="${t.endDate || ''}">
      </div>
    </div>
    <div class="form-group">
      <label for="f-assignee">Assignee</label>
      <input id="f-assignee" name="assignee" value="${escapeAttr(t.assignee || '')}">
    </div>
  `;
}

function handleFormSubmit(e) {
  e.preventDefault();
  const formData = new FormData(els.entityForm);
  const data = Object.fromEntries(formData.entries());

  if (state.editingType === 'project') {
    const payload = {
      name: data.name,
      status: data.status,
      budget: Number(data.budget) || 0,
      startDate: data.startDate,
      endDate: data.endDate,
      client: data.client,
      notes: data.notes
    };
    if (state.editingEntity) {
      updateProject(state.editingEntity, payload);
    } else {
      const created = addProject(payload);
      state.selectedProjectId = created.id;
    }
  } else {
    const payload = {
      name: data.name,
      projectId: data.projectId,
      status: data.status,
      priority: data.priority,
      budget: Number(data.budget) || 0,
      startDate: data.startDate,
      endDate: data.endDate,
      assignee: data.assignee
    };
    if (!payload.projectId) {
      alert('Please select a project');
      return;
    }
    if (state.editingEntity) {
      updateTask(state.editingEntity, payload);
    } else {
      addTask(payload);
    }
  }

  closeModal();
}

function closeModal() {
  els.formModal.close();
  state.editingEntity = null;
  state.editingType = null;
}

function confirmDeleteProject(id) {
  const project = getProject(id);
  if (!project) return;
  const taskCount = getTasks().filter(t => t.projectId === id).length;
  const msg = taskCount
    ? `Delete "${project.name}" and its ${taskCount} task(s)?`
    : `Delete "${project.name}"?`;
  if (confirm(msg)) {
    deleteProject(id, true);
    if (state.selectedProjectId === id) state.selectedProjectId = null;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
