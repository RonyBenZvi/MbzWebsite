import { aggregateProject } from './aggregator.js';
import { getProjects, getTasks } from './store.js';

export function validateProject(project) {
  const agg = aggregateProject(project);
  const violations = [];
  const warnings = [];

  const budget = Number(project.budget) || 0;
  const { taskBudgetSum, tasks, earliestTaskStart, latestTaskEnd } = agg;

  if (budget > 0 && taskBudgetSum > budget) {
    violations.push({
      rule: 'budget-overrun',
      message: `Task budgets total ${formatNum(taskBudgetSum)} but project budget is ${formatNum(budget)} (over by ${formatNum(taskBudgetSum - budget)})`,
      severity: 'error'
    });
  } else if (budget > 0 && taskBudgetSum > budget * 0.9) {
    warnings.push({
      rule: 'budget-warning',
      message: `Task budgets are at ${Math.round((taskBudgetSum / budget) * 100)}% of project budget`,
      severity: 'warning'
    });
  }

  if (budget === 0 && taskBudgetSum > 0) {
    warnings.push({
      rule: 'empty-fence',
      message: 'Project has no budget set but tasks have allocated budgets',
      severity: 'warning'
    });
  }

  if (project.startDate) {
    const earlyTasks = tasks.filter(t => t.startDate && t.startDate < project.startDate);
    earlyTasks.forEach(t => {
      violations.push({
        rule: 'start-before-project',
        message: `Task "${t.name}" starts before project (${formatDate(t.startDate)} < ${formatDate(project.startDate)})`,
        severity: 'error',
        taskId: t.id
      });
    });
  }

  if (project.endDate) {
    const lateTasks = tasks.filter(t => t.endDate && t.endDate > project.endDate);
    lateTasks.forEach(t => {
      violations.push({
        rule: 'end-after-project',
        message: `Task "${t.name}" ends after project (${formatDate(t.endDate)} > ${formatDate(project.endDate)})`,
        severity: 'error',
        taskId: t.id
      });
    });
  }

  return {
    projectId: project.id,
    violations,
    warnings,
    hasErrors: violations.length > 0,
    hasWarnings: warnings.length > 0,
    all: [...violations, ...warnings]
  };
}

export function validateAll() {
  const projects = getProjects();
  const results = projects.map(validateProject);
  const violatingProjectIds = new Set(
    results.filter(r => r.hasErrors || r.hasWarnings).map(r => r.projectId)
  );
  const violatingTaskIds = new Set();
  results.forEach(r => {
    r.violations.forEach(v => {
      if (v.taskId) violatingTaskIds.add(v.taskId);
    });
  });

  return {
    results,
    violatingProjectIds,
    violatingTaskIds,
    hasAnyErrors: results.some(r => r.hasErrors),
    hasAnyWarnings: results.some(r => r.hasWarnings),
    allIssues: results.flatMap(r =>
      r.all.map(issue => ({ ...issue, projectId: r.projectId }))
    )
  };
}

export function getProjectValidation(projectId) {
  const project = getProjects().find(p => p.id === projectId);
  if (!project) return null;
  return validateProject(project);
}

function formatNum(n) {
  return new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
