const STORAGE_KEY = 'mbz-dashboard';

function generateId() {
  return crypto.randomUUID();
}

const SEED_DATA = {
  projects: [
    {
      id: 'p1',
      name: 'Sheba Medical Center HVAC',
      status: 'active',
      budget: 500000,
      startDate: '2025-01-15',
      endDate: '2026-06-30',
      client: 'Sheba Hospital',
      notes: 'Full HVAC retrofit for east wing'
    },
    {
      id: 'p2',
      name: 'Tel Aviv University Lab',
      status: 'planning',
      budget: 120000,
      startDate: '2025-09-01',
      endDate: '2026-03-31',
      client: 'TAU',
      notes: 'Laboratory ventilation and fire protection'
    }
  ],
  tasks: [
    {
      id: 't1',
      projectId: 'p1',
      name: 'Site survey & assessment',
      status: 'done',
      budget: 45000,
      startDate: '2025-01-15',
      endDate: '2025-03-01',
      assignee: 'D. Cohen',
      priority: 'high'
    },
    {
      id: 't2',
      projectId: 'p1',
      name: 'Ductwork design',
      status: 'in-progress',
      budget: 180000,
      startDate: '2025-03-01',
      endDate: '2025-08-15',
      assignee: 'M. Levi',
      priority: 'high'
    },
    {
      id: 't3',
      projectId: 'p1',
      name: 'Equipment procurement',
      status: 'todo',
      budget: 220000,
      startDate: '2025-06-01',
      endDate: '2025-12-01',
      assignee: 'R. Azulay',
      priority: 'medium'
    },
    {
      id: 't4',
      projectId: 'p2',
      name: 'Requirements gathering',
      status: 'in-progress',
      budget: 15000,
      startDate: '2025-09-01',
      endDate: '2025-10-15',
      assignee: 'S. Barak',
      priority: 'medium'
    },
    {
      id: 't5',
      projectId: 'p2',
      name: 'Ventilation calculations',
      status: 'todo',
      budget: 35000,
      startDate: '2025-10-15',
      endDate: '2025-12-31',
      assignee: 'M. Levi',
      priority: 'low'
    }
  ]
};

let data = { projects: [], tasks: [] };
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  save();
  listeners.forEach(fn => fn(data));
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function load() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      data = JSON.parse(stored);
    } catch {
      data = structuredClone(SEED_DATA);
      save();
    }
  } else {
    data = structuredClone(SEED_DATA);
    save();
  }
  return data;
}

export function getData() {
  return data;
}

export function getProjects() {
  return data.projects;
}

export function getTasks() {
  return data.tasks;
}

export function getTasksByProject(projectId) {
  return data.tasks.filter(t => t.projectId === projectId);
}

export function getProject(id) {
  return data.projects.find(p => p.id === id);
}

export function getTask(id) {
  return data.tasks.find(t => t.id === id);
}

export function addProject(project) {
  const entry = { id: generateId(), ...project };
  data.projects.push(entry);
  notify();
  return entry;
}

export function updateProject(id, updates) {
  const idx = data.projects.findIndex(p => p.id === id);
  if (idx === -1) return null;
  data.projects[idx] = { ...data.projects[idx], ...updates };
  notify();
  return data.projects[idx];
}

export function deleteProject(id, deleteTasks = true) {
  data.projects = data.projects.filter(p => p.id !== id);
  if (deleteTasks) {
    data.tasks = data.tasks.filter(t => t.projectId !== id);
  }
  notify();
}

export function addTask(task) {
  const entry = { id: generateId(), ...task };
  data.tasks.push(entry);
  notify();
  return entry;
}

export function updateTask(id, updates) {
  const idx = data.tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  data.tasks[idx] = { ...data.tasks[idx], ...updates };
  notify();
  return data.tasks[idx];
}

export function deleteTask(id) {
  data.tasks = data.tasks.filter(t => t.id !== id);
  notify();
}

export function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mbz-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(json, mode = 'replace') {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed.projects || !parsed.tasks) {
    throw new Error('Invalid backup file: missing projects or tasks');
  }

  if (mode === 'replace') {
    data = { projects: parsed.projects, tasks: parsed.tasks };
  } else {
    const existingProjectIds = new Set(data.projects.map(p => p.id));
    const existingTaskIds = new Set(data.tasks.map(t => t.id));
    parsed.projects.forEach(p => {
      if (!existingProjectIds.has(p.id)) data.projects.push(p);
    });
    parsed.tasks.forEach(t => {
      if (!existingTaskIds.has(t.id)) data.tasks.push(t);
    });
  }
  notify();
}

export const PROJECT_STATUSES = ['planning', 'active', 'on-hold', 'completed'];
export const TASK_STATUSES = ['todo', 'in-progress', 'blocked', 'done'];
export const PRIORITIES = ['low', 'medium', 'high'];
