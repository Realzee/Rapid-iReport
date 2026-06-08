import fs from 'fs';

const files = [
  'components/LookoutScanner.tsx',
  'components/CirculationListManager.tsx',
  'pages/ResponderPage.tsx',
  'pages/GateAccessPage.tsx',
  'components/Dashboard.tsx',
  'pages/ControllerPage.tsx',
  'pages/ReportsPage.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Fix imports
  if (content.includes('ReportStatus') && !content.includes('ACTIVE_REPORT_STATUSES')) {
    content = content.replace(/ReportStatus(?!,)/, 'ReportStatus, ACTIVE_REPORT_STATUSES, TERMINAL_REPORT_STATUSES');
  }

  // Common replacements
  content = content.replace(/const activeStatuses = \[.*?\];/s, 'const activeStatuses = ACTIVE_REPORT_STATUSES;');
  content = content.replace(/const activeStatuses = \[\n([ \t]*ReportStatus\.[A-Z_]+,*[ \t]*\n)+[ \t]*\];/g, 'const activeStatuses = ACTIVE_REPORT_STATUSES;');
  content = content.replace(/\[ReportStatus\.PENDING, ReportStatus\.ACTIVE, ReportStatus\.ASSIGNED, ReportStatus\.IN_PROGRESS, ReportStatus\.ON_SCENE\]/g, 'ACTIVE_REPORT_STATUSES');
  content = content.replace(/\[ReportStatus\.ASSIGNED, ReportStatus\.IN_PROGRESS, ReportStatus\.ON_SCENE\]/g, 'ACTIVE_REPORT_STATUSES');
  content = content.replace(/\[ReportStatus\.PENDING, ReportStatus\.ACTIVE, ReportStatus\.IN_PROGRESS\]/g, 'ACTIVE_REPORT_STATUSES');

  fs.writeFileSync(file, content);
  console.log('Fixed', file);
}
