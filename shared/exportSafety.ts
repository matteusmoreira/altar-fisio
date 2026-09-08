export function escapeSpreadsheetCell(value: string): string {
  const text = /^[\s]*[=+@-]/.test(value) ? "'" + value : value
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
