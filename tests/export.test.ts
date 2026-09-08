import { expect, test } from 'vitest'
import { escapeSpreadsheetCell } from '../shared/exportSafety'
import * as XLSX from 'xlsx'
test('export escapes HTML and spreadsheet formula prefixes',()=>{
  expect(escapeSpreadsheetCell('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
  expect(escapeSpreadsheetCell('=1+1')).toBe('&#39;=1+1')
  expect(escapeSpreadsheetCell('Nome do paciente')).toBe('Nome do paciente')
})
test('updated XLSX keeps export with two sheets and accented text',()=>{
  const book=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{Paciente:'João',Sessões:2}]),'Histórico Detalhado')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{Total:2}]),'Consolidado por Aluno')
  const roundTrip=XLSX.read(XLSX.write(book,{bookType:'xlsx',type:'buffer'}),{type:'buffer'})
  expect(roundTrip.SheetNames).toEqual(book.SheetNames)
  expect(XLSX.utils.sheet_to_json(roundTrip.Sheets['Histórico Detalhado'])).toEqual([{Paciente:'João',Sessões:2}])
})
