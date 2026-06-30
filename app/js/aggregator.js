import { getTasksByProject } from './store.js';

export function aggregateProject(project) {
  const tasks = getTasksByProject(project.id);

  const taskBudgetSum = tasks.reduce((sum, t) => sum + (Number(t.budget) || 0), 0);
  const taskCount = tasks.length;
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const tasksBlocked = tasks.filter(t => t.status === 'blocked').length;
  const tasksInProgress = tasks.filter(t => t.status === 'in-progress').length;
  const tasksTodo = tasks.filter(t => t.status === 'todo').length;

  const taskDates = tasks.flatMap(t => [t.startDate, t.endDate].filter(Boolean));
  const earliestTaskStart = taskDates.length ? taskDates.reduce((a, b) => (a < b ? a : b)) : null;
  const latestTaskEnd = taskDates.length ? taskDates.reduce((a, b) => (a > b ? a : b)) : null;

  const budget = Number(project.budget) || 0;
  const budgetRemaining = budget - taskBudgetSum;
  const budgetUsedPercent = budget > 0 ? (taskBudgetSum / budget) * 100 : 0;

  return {
    taskBudgetSum,
    taskCount,
    tasksDone,
    tasksBlocked,
    tasksInProgress,
    tasksTodo,
    earliestTaskStart,
    latestTaskEnd,
    budgetRemaining,
    budgetUsedPercent,
    tasks
  };
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0
  }).format(num);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateRange(start, end) {
  if (!start && !end) return '—';
  return `${formatDate(start)} → ${formatDate(end)}`;
}
