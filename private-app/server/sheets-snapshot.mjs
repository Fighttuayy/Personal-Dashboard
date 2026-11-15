const STATUS_LABELS = {
 'ยังไม่เริ่ม': 'Not started',
 'กำลังทำ': 'In progress',
 'รอตรวจ': 'In review',
 'เสร็จแล้ว': 'Done'
};

const HEADERS = [
 'Task', 'Client / Course', 'Work type', 'Due date', 'Status',
 'Project value (THB)', 'Received (THB)', 'Outstanding (THB)', 'Payment date'
];

export function buildSheetsSnapshot(workspace) {
 const usedTitles = new Set(['all']);
 const tabs = workspace.categories.map(category => {
  const base = category.name.replace(/[\[\]:*?/\\]/g, ' ').trim() || 'Work type';
  let title = base;
  let suffix = 2;
  while (usedTitles.has(title.toLowerCase())) title = base + ' (' + suffix++ + ')';
  usedTitles.add(title.toLowerCase());
  return {key:category.id, title, rows:[[...HEADERS]]};
 });
 const byCategory = new Map(tabs.map(tab => [tab.key, tab]));
 const categoryNames = new Map(workspace.categories.map(category => [category.id, category.name]));
 const all = {key:null, title:'All', rows:[[...HEADERS]]};
 const tasks = [...workspace.tasks].sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
 for (const task of tasks) {
  const row = [
   task.name, task.client, categoryNames.get(task.category) || '', task.due,
   STATUS_LABELS[task.status] || task.status, task.amount, task.paid,
   Math.round((task.amount - task.paid) * 100) / 100, task.paidDate || ''
  ];
  all.rows.push(row);
  byCategory.get(task.category)?.rows.push(row);
 }
 return [all, ...tabs];
}
