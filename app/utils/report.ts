// Expense report generation utility

export interface Expense {
  id: string;
  amount: string;
  category: string | null;
  note: string | null;
  date: string;
  created_at: string;
  account_id?: string | null;
  account?: {
    name: string;
    type: string;
  } | null;
}

export interface ReportData {
  expenses: Expense[];
  username: string;
  generatedBy?: string;
  generatedOn?: string;
}

// Format number with commas (Indian style)
function formatNumber(num: number | string): string {
  const numAmount = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(numAmount)) return '0';
  return Math.abs(numAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// Format date as "DD MMM YY"
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);
  return `${day} ${month} ${year}`;
}

// Calculate summary statistics
function calculateSummary(expenses: Expense[]) {
  let totalCashOut = 0;
  let runningBalance = 0;
  const balanceMap = new Map<string, number>();

  // Sort expenses by date (ascending) for balance calculation
  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateA = new Date(a.date || a.created_at).getTime();
    const dateB = new Date(b.date || b.created_at).getTime();
    return dateA - dateB;
  });

  sortedExpenses.forEach((expense) => {
    const amount = parseFloat(expense.amount);
    // All amounts are expenses (cash out) - they're always positive in the DB
    totalCashOut += amount;
    runningBalance -= amount; // Balance decreases with each expense
    // Store balance by expense ID for lookup
    balanceMap.set(expense.id, runningBalance);
  });

  const finalBalance = runningBalance;
  const totalEntries = expenses.length;

  // Get date range
  const dates = sortedExpenses.map((e) => new Date(e.date || e.created_at));
  const startDate = dates.length > 0 ? dates[0] : new Date();
  const endDate = dates.length > 0 ? dates[dates.length - 1] : new Date();

  const formatDateRange = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const duration = `${formatDateRange(startDate)} - ${formatDateRange(endDate)}`;

  return {
    totalCashIn: 0, // No cash in in current data model
    totalCashOut,
    finalBalance,
    totalEntries,
    duration,
    balanceMap,
  };
}

// Generate HTML report
export function generateReportHTML(data: ReportData): string {
  const { expenses, username, generatedBy, generatedOn } = data;
  const summary = calculateSummary(expenses);

  // Sort expenses by date (descending) for display
  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateA = new Date(a.date || a.created_at).getTime();
    const dateB = new Date(b.date || b.created_at).getTime();
    return dateB - dateA;
  });

  // Generate table rows
  const tableRows = sortedExpenses.map((expense) => {
    const amount = parseFloat(expense.amount);
    const balance = summary.balanceMap.get(expense.id) || 0;
    const balanceClass = balance < 0 ? 'neg' : '';
    
    // Get mode (account name if available, otherwise "Cash")
    const mode = expense.account?.name || 'Cash';

    return `
      <tr>
        <td>${formatDate(expense.date || expense.created_at)}</td>
        <td>${(expense.note || '').trim()}</td>
        <td>${(expense.category || '').trim()}</td>
        <td>${mode}</td>
        <td class="num"></td>
        <td class="num out">${formatNumber(amount)}</td>
        <td class="num ${balanceClass}">${balance < 0 ? '-' : ''}${formatNumber(Math.abs(balance))}</td>
      </tr>
    `;
  }).join('');

  const now = generatedOn || new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const by = generatedBy || username || 'User';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Expense Report</title>

<style>
@page {
  size: A4;
  margin: 18mm;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  color-adjust: exact;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  color: #000;
  margin: 0;
  background: #fff;
}

/* HEADER */
.header-container {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.logo-container {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
}

.logo-image {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  object-fit: cover;
  display: block;
}

.header-content {
  flex: 1;
}

.title {
  font-size: 16px;
  font-weight: bold;
}

.meta {
  font-size: 11px;
  margin-bottom: 8px;
  color: #333;
}

hr {
  border: none;
  border-top: 1px solid #000;
  margin: 6px 0 10px;
}

/* SECTION */
.section {
  font-weight: bold;
  margin-bottom: 6px;
  font-size: 16px;
}

/* SUMMARY BLOCK */
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.box {
  border: 1px solid #ccc;
  padding: 6px;
}

.box-label {
  font-size: 11px;
}

.box-value {
  font-size: 14px;
  font-weight: bold;
  margin-top: 2px;
}

.in { color: #2e7d32; }     /* green */
.out { color: #c62828; }    /* red */
.neg { color: #c62828; }

/* TABLE */
table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #000;
}

thead {
  background-color: #f5f5f5;
}

th, td {
  border: 1px solid #000;
  padding: 4px;
  font-size: 11px;
}

th {
  text-align: left;
  font-weight: bold;
  background-color: #f5f5f5;
  border-bottom: 2px solid #000;
}

td {
  background-color: #fff;
}

.num {
  text-align: right;
  white-space: nowrap;
}

.num.in {
  color: #2e7d32;
  font-weight: bold;
}

.num.out {
  color: #c62828;
  font-weight: bold;
}

.num.neg {
  color: #c62828;
  font-weight: bold;
}

tr { 
  page-break-inside: avoid; 
}

/* FOOTER */
.footer {
  text-align: center;
  font-size: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
  color: #666;
}

@media print {
  body {
    background: #fff;
  }

  thead {
    display: table-header-group;
    background-color: #f5f5f5;
  }

  tbody {
    display: table-row-group;
  }

  tr {
    page-break-inside: avoid;
  }
}
</style>
</head>

<body>

<div class="header-container">
  <div class="logo-container">
    <img src="/ironman-logo.png" alt="Iron Man" class="logo-image" onerror="this.style.display='none'; this.parentElement.style.display='none';">
  </div>
  <div class="header-content">
    <div class="title">Stark Industries Report</div>
    <div class="meta">
      Generated On - ${now}.<br>
      Generated by - ${by}
    </div>
  </div>
</div>

<hr>

<div class="section"># Expenses</div>
<div class="meta">Duration: ${summary.duration}</div>

<div class="summary">
  <div class="box">
    <div class="box-label">Total Cash in</div>
    <div class="box-value">0</div>
  </div>

  <div class="box">
    <div class="box-label">Total Cash out</div>
    <div class="box-value out">${formatNumber(summary.totalCashOut)}</div>
  </div>

  <div class="box">
    <div class="box-label">Final Balance</div>
    <div class="box-value ${summary.finalBalance < 0 ? 'neg' : ''}">${summary.finalBalance < 0 ? '-' : ''}${formatNumber(Math.abs(summary.finalBalance))}</div>
  </div>

  <div class="box">
    <div class="box-label">Total No. of entries</div>
    <div class="box-value">${summary.totalEntries}</div>
  </div>
</div>

<table>
<thead>
<tr>
  <th>Date</th>
  <th>Remark</th>
  <th>Category</th>
  <th>Mode</th>
  <th>Cash in</th>
  <th>Cash out</th>
  <th>Balance</th>
</tr>
</thead>

<tbody>
${tableRows}
</tbody>
</table>

<div class="footer">
  Generated by CashBook App. Install Now
</div>

</body>
</html>`;
}

