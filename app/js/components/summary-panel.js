import { aggregateProject, formatCurrency, formatDate, formatDateRange } from '../aggregator.js';
import { renderChip } from './data-table.js';

export function renderSummaryPanel(container, emptyEl, contentEl, project, validation) {
  if (!project) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    contentEl.innerHTML = '';
    return;
  }

  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const agg = aggregateProject(project);
  const budget = Number(project.budget) || 0;
  const usedPercent = budget > 0 ? Math.min((agg.taskBudgetSum / budget) * 100, 100) : 0;
  const displayPercent = budget > 0 ? (agg.taskBudgetSum / budget) * 100 : 0;

  const budgetClass = agg.taskBudgetSum > budget ? 'over' : displayPercent > 90 ? 'warn' : '';
  const progressClass = budgetClass;

  const startOutOfRange = agg.earliestTaskStart && project.startDate && agg.earliestTaskStart < project.startDate;
  const endOutOfRange = agg.latestTaskEnd && project.endDate && agg.latestTaskEnd > project.endDate;

  const totalTasks = agg.taskCount || 1;
  const donePct = (agg.tasksDone / totalTasks) * 100;
  const inProgressPct = (agg.tasksInProgress / totalTasks) * 100;
  const todoPct = (agg.tasksTodo / totalTasks) * 100;
  const blockedPct = (agg.tasksBlocked / totalTasks) * 100;

  const violationsHtml = validation && validation.all.length
    ? `<div class="summary-card">
        <h4>Constraint Issues</h4>
        <ul class="violation-list">
          ${validation.all.map(v => `<li class="${v.severity}">${escapeHtml(v.message)}</li>`).join('')}
        </ul>
      </div>`
    : '';

  contentEl.innerHTML = `
    <div>
      <div class="summary-title">${escapeHtml(project.name)}</div>
      <div class="summary-meta">${escapeHtml(project.client || 'No client')} · ${renderChip(project.status)}</div>
    </div>

    <div class="summary-card">
      <h4>Budget</h4>
      <div class="summary-budget-row">
        <span class="summary-budget-amount ${budgetClass}">${formatCurrency(agg.taskBudgetSum)}</span>
        <span class="summary-detail">of ${formatCurrency(budget)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill ${progressClass}" style="width: ${Math.min(displayPercent, 100)}%"></div>
      </div>
      <div class="summary-detail">
        ${agg.budgetRemaining >= 0
          ? `${formatCurrency(agg.budgetRemaining)} remaining (${Math.round(displayPercent)}% used)`
          : `<span style="color: var(--error)">${formatCurrency(Math.abs(agg.budgetRemaining))} over budget</span>`}
      </div>
    </div>

    <div class="summary-card">
      <h4>Timeline</h4>
      <div class="timeline-compare">
        <div class="timeline-row">
          <span class="label">Project fence</span>
          <span>${formatDateRange(project.startDate, project.endDate)}</span>
        </div>
        <div class="timeline-row ${startOutOfRange || endOutOfRange ? 'out-of-range' : ''}">
          <span class="label">Tasks span</span>
          <span>${formatDateRange(agg.earliestTaskStart, agg.latestTaskEnd)}</span>
        </div>
      </div>
    </div>

    <div class="summary-card">
      <h4>Tasks (${agg.taskCount})</h4>
      ${agg.taskCount > 0 ? `
        <div class="status-breakdown">
          ${agg.tasksDone ? `<div class="status-segment done" style="width:${donePct}%" title="Done: ${agg.tasksDone}"></div>` : ''}
          ${agg.tasksInProgress ? `<div class="status-segment in-progress" style="width:${inProgressPct}%" title="In Progress: ${agg.tasksInProgress}"></div>` : ''}
          ${agg.tasksTodo ? `<div class="status-segment todo" style="width:${todoPct}%" title="To Do: ${agg.tasksTodo}"></div>` : ''}
          ${agg.tasksBlocked ? `<div class="status-segment blocked" style="width:${blockedPct}%" title="Blocked: ${agg.tasksBlocked}"></div>` : ''}
        </div>
        <div class="status-legend">
          ${agg.tasksDone ? `<span class="legend-done">${agg.tasksDone} done</span>` : ''}
          ${agg.tasksInProgress ? `<span class="legend-in-progress">${agg.tasksInProgress} in progress</span>` : ''}
          ${agg.tasksTodo ? `<span class="legend-todo">${agg.tasksTodo} to do</span>` : ''}
          ${agg.tasksBlocked ? `<span class="legend-blocked">${agg.tasksBlocked} blocked</span>` : ''}
        </div>
      ` : '<div class="summary-detail">No tasks yet</div>'}
    </div>

    ${violationsHtml}
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
