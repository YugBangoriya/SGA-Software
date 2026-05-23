/**
 * csvExport.js
 * Utility to export an array of objects as a UTF-8 CSV file download.
 *
 * @param {Array}  data     - Array of plain objects to export
 * @param {string} filename - File name WITHOUT extension (date is appended automatically)
 * @param {Array}  columns  - Optional [{ key, label }] array to control column order and headers.
 *                            If omitted, all keys from the first object are used.
 */
export function exportToCSV(data, filename, columns = null) {
  if (!data || data.length === 0) {
    console.warn('csvExport: no data to export');
    return;
  }

  const cols =
    columns ||
    Object.keys(data[0]).map((k) => ({ key: k, label: k }));

  const escape = (val) => {
    const str = val === null || val === undefined ? '' : String(val);
    // Wrap in quotes; double any internal quotes
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headerRow = cols.map((c) => escape(c.label)).join(',');

  const dataRows = data.map((row) =>
    cols.map((c) => escape(row[c.key])).join(',')
  );

  // BOM (\ufeff) ensures Excel opens UTF-8 correctly
  const csvContent = '\ufeff' + [headerRow, ...dataRows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateSuffix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${dateSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * formatForCSV — formats a Firestore Timestamp or JS Date into a readable string
 */
export function formatTimestampForCSV(ts) {
  if (!ts) return '';
  // Firestore Timestamp has .toDate()
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
