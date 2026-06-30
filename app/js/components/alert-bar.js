export function renderAlertBar(container, validation, onProjectClick) {
  if (!validation.hasAnyErrors && !validation.hasAnyWarnings) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  container.classList.toggle('warning-only', !validation.hasAnyErrors && validation.hasAnyWarnings);

  const icon = validation.hasAnyErrors
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

  const issueCount = validation.allIssues.length;
  const label = validation.hasAnyErrors
    ? `${issueCount} constraint violation${issueCount !== 1 ? 's' : ''}`
    : `${issueCount} warning${issueCount !== 1 ? 's' : ''}`;

  const items = validation.results
    .filter(r => r.hasErrors || r.hasWarnings)
    .map(r => {
      const project = r.all[0]?.message ? r : r;
      const firstIssue = r.all[0];
      const projectName = getProjectName(r.projectId);
      const severity = r.hasErrors ? 'error' : 'warning';
      return `<button type="button" class="alert-bar-item" data-project-id="${r.projectId}" title="${r.all.map(i => i.message).join('\n')}">
        ${projectName}: ${r.all.length} issue${r.all.length !== 1 ? 's' : ''}
      </button>`;
    })
    .join('');

  container.innerHTML = `
    ${icon}
    <strong>${label}</strong>
    ${items}
  `;

  container.querySelectorAll('.alert-bar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onProjectClick) onProjectClick(btn.dataset.projectId);
    });
  });
}

let projectNameLookup = {};

export function setProjectNames(projects) {
  projectNameLookup = Object.fromEntries(projects.map(p => [p.id, p.name]));
}

function getProjectName(id) {
  return projectNameLookup[id] || 'Unknown project';
}
