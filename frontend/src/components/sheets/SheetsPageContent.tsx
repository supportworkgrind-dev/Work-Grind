'use client';

import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Bar, BarChart, CartesianGrid, Cell as ChartCell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  AlignCenter,
  AlignLeft,
  AlignRight,
  BarChart3,
  Bold,
  CheckSquare,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  Italic,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Sheet,
  Strikethrough,
  Trash2,
  Underline,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { evaluateSheet, formulaFunctionNames, type FormulaValue } from '@/lib/sheetFormulas';
import { useAuthStore } from '@/store/useAuthStore';

type CellStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  horizontal?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  numberFormat?: 'general' | 'number' | 'currency' | 'percentage' | 'date';
  border?: 'none' | 'thin' | 'medium';
};
type SheetValidation = { range: string; type: 'list' | 'checkbox'; options: string[] };
type ConditionalFormat = { range: string; condition: 'greaterThan' | 'lessThan' | 'equalTo' | 'textContains'; value: string; color: string; backgroundColor: string };
type SheetChart = { title: string; type: 'bar' | 'line' | 'pie'; range: string };
type SpreadsheetSheet = {
  _id: string;
  title: string;
  rowCount: number;
  columnCount: number;
  data: string[][];
  hiddenRows?: number[];
  hiddenColumns?: number[];
  cellStyles?: Record<string, CellStyle>;
  frozenRows?: number;
  frozenColumns?: number;
  validations?: SheetValidation[];
  notes?: Record<string, string>;
  conditionalFormats?: ConditionalFormat[];
  charts?: SheetChart[];
};

type Workbook = {
  _id: string;
  title: string;
  sheets: SpreadsheetSheet[];
  updatedAt: string;
};

type CellUpdate = { row: number; column: number; value: string };
type GridClipboard = { text: string; values: string[][]; styles: Array<Array<CellStyle | undefined>>; sourceRow: number; sourceColumn: number };
type LocalDraft = { userId: string; workbookId: string; sheetId: string; savedAt: number; updates: CellUpdate[] };
type Selection = { startRow: number; startColumn: number; endRow: number; endColumn: number };
type CellHistory = { kind: 'cell'; sheetId: string; row: number; column: number; before: string; after: string };
type RangeHistory = { kind: 'range'; sheetId: string; changes: Array<{ row: number; column: number; before: string; after: string }> };
type GridHistory = {
  kind: 'grid';
  sheetId: string;
  before: { data: string[][]; rowCount: number; columnCount: number };
  after: { data: string[][]; rowCount: number; columnCount: number };
};
type HistoryEntry = CellHistory | RangeHistory | GridHistory;
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
type GridContext = { x: number; y: number; axis: 'cell' | 'row' | 'column'; row: number; column: number };

const MAX_ROWS = 500;
const MAX_COLUMNS = 100;
const MAX_UNDO = 50;

function localDraftKey(userId: string, workbookId: string, sheetId: string): string {
  return `workgrind:sheets:draft:${userId}:${workbookId}:${sheetId}`;
}

function parseLocalDraft(value: string | null): LocalDraft | null {
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as Partial<LocalDraft>;
    if (typeof draft.userId !== 'string' || typeof draft.workbookId !== 'string' ||
        typeof draft.sheetId !== 'string' || typeof draft.savedAt !== 'number' ||
        !Array.isArray(draft.updates) ||
        !draft.updates.every((item) => item && Number.isInteger(item.row) && item.row >= 0 &&
          Number.isInteger(item.column) && item.column >= 0 && typeof item.value === 'string')) return null;
    return draft as LocalDraft;
  } catch {
    return null;
  }
}

function findLatestLocalDraft(userId: string, workbooks: Workbook[]): { draft: LocalDraft | null; unavailable: boolean } {
  let latest: LocalDraft | null = null;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(`workgrind:sheets:draft:${userId}:`)) continue;
      const draft = parseLocalDraft(window.localStorage.getItem(key));
      if (!draft || !workbooks.some((workbook) =>
        workbook._id === draft.workbookId && workbook.sheets.some((sheet) => sheet._id === draft.sheetId))) continue;
      if (!latest || draft.savedAt > latest.savedAt) latest = draft;
    }
    return { draft: latest, unavailable: false };
  } catch {
    return { draft: latest, unavailable: true };
  }
}

function columnName(index: number): string {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function blankGrid(rows: number, columns: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));
}

function resizeGrid(data: string[][], rows: number, columns: number): string[][] {
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => data[rowIndex]?.[columnIndex] ?? ''),
  );
}

function toCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function excelCellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value && typeof value === 'object') {
    if ('formula' in value && typeof value.formula === 'string') return `=${value.formula}`;
    if ('text' in value && typeof value.text === 'string') return value.text;
  }
  return cell.text || toCellText(value);
}

function excelCellStyle(cell: ExcelJS.Cell): CellStyle | undefined {
  const style: CellStyle = {};
  if (cell.font?.bold) style.bold = true;
  if (cell.font?.italic) style.italic = true;
  if (cell.font?.underline) style.underline = true;
  if (cell.font?.size) style.fontSize = cell.font.size;
  if (cell.font?.color?.argb) style.color = `#${cell.font.color.argb.slice(-6)}`;
  if (cell.fill?.type === 'pattern' && cell.fill.fgColor?.argb) style.backgroundColor = `#${cell.fill.fgColor.argb.slice(-6)}`;
  if (cell.alignment?.horizontal === 'center' || cell.alignment?.horizontal === 'right') style.horizontal = cell.alignment.horizontal;
  if (cell.alignment?.vertical === 'top' || cell.alignment?.vertical === 'middle' || cell.alignment?.vertical === 'bottom') style.vertical = cell.alignment.vertical;
  if (cell.alignment?.wrapText) style.wrap = true;
  const numberFormat = cell.numFmt?.toLowerCase() ?? '';
  if (numberFormat.includes('%')) style.numberFormat = 'percentage';
  else if (numberFormat.includes('$') || numberFormat.includes('€') || numberFormat.includes('£')) style.numberFormat = 'currency';
  else if (/[dy]/i.test(numberFormat)) style.numberFormat = 'date';
  else if (numberFormat && numberFormat !== 'general') style.numberFormat = 'number';
  return Object.keys(style).length ? style : undefined;
}

function excelNumberFormat(format: CellStyle['numberFormat']): string {
  if (format === 'currency') return '$#,##0.00';
  if (format === 'percentage') return '0.00%';
  if (format === 'date') return 'yyyy-mm-dd';
  if (format === 'number') return '#,##0.00';
  return 'General';
}

function columnIndexFromName(label: string): number {
  let result = 0;
  for (const character of label.toUpperCase()) result = result * 26 + character.charCodeAt(0) - 64;
  return result - 1;
}

function parseRange(range: string): Selection | null {
  const match = /^\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/i.exec(range);
  if (!match) return null;
  const first = { column: columnIndexFromName(match[1]), row: Number(match[2]) - 1 };
  const last = {
    column: columnIndexFromName(match[3] ?? match[1]),
    row: Number(match[4] ?? match[2]) - 1,
  };
  return { startRow: Math.min(first.row, last.row), startColumn: Math.min(first.column, last.column), endRow: Math.max(first.row, last.row), endColumn: Math.max(first.column, last.column) };
}

function selectionRange(selection: Selection): string {
  const start = `${columnName(selection.startColumn)}${selection.startRow + 1}`;
  const end = `${columnName(selection.endColumn)}${selection.endRow + 1}`;
  return start === end ? start : `${start}:${end}`;
}

function formattedCell(value: FormulaValue, format?: CellStyle['numberFormat']): string {
  const scalarValue = firstValue(value);
  if (typeof scalarValue !== 'number' || format === 'general' || !format) return String(scalarValue ?? '');
  if (format === 'percentage') return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(scalarValue);
  if (format === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(scalarValue);
  if (format === 'date') return new Date(Date.UTC(1899, 11, 30) + scalarValue * 86_400_000).toLocaleDateString();
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(scalarValue);
}

function firstValue(value: FormulaValue): string | number | boolean | null {
  while (Array.isArray(value)) value = value[0] ?? '';
  return value;
}

function shiftFormula(formula: string, rowShift: number, columnShift: number): string {
  return formula.replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'|(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)/gi, (match, absoluteColumn: string, label: string, absoluteRow: string, rowValue: string) => {
    if (match.startsWith('"') || match.startsWith("'")) return match;
    const row = Number(rowValue) - 1 + (absoluteRow ? 0 : rowShift);
    const column = columnIndexFromName(label) + (absoluteColumn ? 0 : columnShift);
    if (row < 0 || column < 0) return '#REF!';
    return `${absoluteColumn}${columnName(column)}${absoluteRow}${row + 1}`;
  });
}

function chartRows(sheet: SpreadsheetSheet, chart: SheetChart, values: Map<string, FormulaValue>) {
  const range = parseRange(chart.range);
  if (!range || range.endRow - range.startRow > 499 || range.endColumn - range.startColumn > 20) return [];
  return Array.from({ length: range.endRow - range.startRow + 1 }, (_, offset) => {
    const row = range.startRow + offset;
    const labelValue = values.get(`${sheet.title.toLowerCase()}:${row}:${range.startColumn}`) ?? sheet.data[row]?.[range.startColumn] ?? '';
    const item: Record<string, string | number> = { name: String(firstValue(labelValue) ?? '') };
    for (let column = range.startColumn + 1; column <= range.endColumn; column += 1) {
      const value = values.get(`${sheet.title.toLowerCase()}:${row}:${column}`) ?? sheet.data[row]?.[column] ?? '';
      const numericValue = Number(firstValue(value) ?? '');
      item[columnName(column)] = Number.isFinite(numericValue) ? numericValue : 0;
    }
    return item;
  });
}

function excelSheetTitle(title: string, used: Set<string>): string {
  const base = (title.replace(/[\\/:?*]/g, ' ').replace(/[\[\]]/g, ' ').trim().slice(0, 31) || 'Sheet');
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const end = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - end.length)}${end}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function downloadBlob(content: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SheetsPage() {
  const user = useAuthStore((state) => state.user);
  const userId = user?._id;
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [activeWorkbook, setActiveWorkbook] = useState<Workbook | null>(null);
  const [activeSheetId, setActiveSheetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [recoveryDraft, setRecoveryDraft] = useState<LocalDraft | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [zoom, setZoom] = useState(100);
  const [selectedCell, setSelectedCell] = useState({ row: 0, column: 0 });
  const [selection, setSelection] = useState<Selection>({ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 });
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [showFormulaSuggestions, setShowFormulaSuggestions] = useState(false);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [chartType, setChartType] = useState<SheetChart['type']>('bar');
  const [showChart, setShowChart] = useState(false);
  const [virtualRows, setVirtualRows] = useState({ start: 0, end: 60 });
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [fillTarget, setFillTarget] = useState<{ row: number; column: number } | null>(null);
  const [gridContext, setGridContext] = useState<GridContext | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdates = useRef(new Map<string, Map<string, CellUpdate>>());
  const importInput = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const selectionAnchor = useRef({ row: 0, column: 0 });
  const editingCell = useRef(false);
  const formulaReferenceMode = useRef(false);
  const gridClipboard = useRef<GridClipboard | null>(null);
  const fillSource = useRef<Selection | null>(null);
  const fillPointerId = useRef<number | null>(null);
  const historyEditKey = useRef('');
  const formulaReferenceSpan = useRef<{ start: number; end: number; anchor: { row: number; column: number }; formulaRow: number; formulaColumn: number } | null>(null);

  const activeSheet = activeWorkbook?.sheets.find((sheet) => sheet._id === activeSheetId) ?? null;
  const formulaValues = useMemo(
    () => activeSheet ? evaluateSheet(activeSheet, activeWorkbook?.sheets ?? []) : new Map<string, FormulaValue>(),
    [activeSheet, activeWorkbook?.sheets],
  );
  const formulaCellValue = (row: number, column: number): FormulaValue => {
    const raw = activeSheet?.data[row]?.[column] ?? '';
    const calculated = formulaValues.get(`${activeSheet?.title.toLowerCase()}:${row}:${column}`);
    return calculated ?? raw;
  };

  useEffect(() => {
    setFormulaBarValue(activeSheet?.data[selectedCell.row]?.[selectedCell.column] ?? '');
  }, [activeSheet, selectedCell]);

  const applyWorkbook = useCallback((workbook: Workbook) => {
    setActiveWorkbook(workbook);
    setWorkbooks((current) => {
      const found = current.some((item) => item._id === workbook._id);
      return found
        ? current.map((item) => item._id === workbook._id ? workbook : item)
        : [workbook, ...current];
    });
  }, []);

  const loadWorkbooks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/sheets/workbooks');
      const items = response.data.workbooks as Workbook[];
      setLoadFailed(false);
      setWorkbooks(items);
      if (userId) {
        const result = findLatestLocalDraft(userId, items);
        setRecoveryDraft(result.draft);
        if (result.unavailable) setError('Local draft recovery is unavailable because browser storage could not be read.');
      }
      if (items.length) {
        setActiveWorkbook(items[0]);
        setActiveSheetId(items[0].sheets[0]?._id ?? '');
      }
    } catch {
      setLoadFailed(true);
      setError('Your spreadsheets could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadWorkbooks();
  }, [loadWorkbooks]);

  const persistDraft = useCallback((workbookId: string, sheetId: string, updates: CellUpdate[]) => {
    if (!userId) return;
    const key = localDraftKey(userId, workbookId, sheetId);
    try {
      if (!updates.length) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify({
        userId,
        workbookId,
        sheetId,
        savedAt: Date.now(),
        updates,
      } satisfies LocalDraft));
    } catch {
      setError('Local draft recovery is unavailable because browser storage could not be written.');
    }
  }, [userId]);

  const flushPending = useCallback(async (workbookId: string, sheetId: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const key = `${workbookId}:${sheetId}`;
    const changes = pendingUpdates.current.get(key);
    if (!changes?.size) return;
    const updates = [...changes.values()];
    pendingUpdates.current.delete(key);
    setSaveStatus('saving');
    try {
      for (let offset = 0; offset < updates.length; offset += 1_000) {
        await api.patch(`/sheets/workbooks/${workbookId}/sheets/${sheetId}/cells`, { updates: updates.slice(offset, offset + 1_000) });
      }
      persistDraft(workbookId, sheetId, [...(pendingUpdates.current.get(key)?.values() ?? [])]);
      setSaveStatus(pendingUpdates.current.size ? 'unsaved' : 'saved');
      setError('');
    } catch (saveError) {
      const latest = pendingUpdates.current.get(key) ?? new Map<string, CellUpdate>();
      for (const update of updates) {
        const updateKey = `${update.row}:${update.column}`;
        if (!latest.has(updateKey)) latest.set(updateKey, update);
      }
      pendingUpdates.current.set(key, latest);
      persistDraft(workbookId, sheetId, [...latest.values()]);
      setSaveStatus('error');
      setError('Some cell changes have not synced yet. They will retry when you edit again.');
      throw saveError;
    }
  }, [persistDraft]);

  const scheduleCellSave = useCallback((workbookId: string, sheetId: string, update: CellUpdate) => {
    const key = `${workbookId}:${sheetId}`;
    const changes = pendingUpdates.current.get(key) ?? new Map<string, CellUpdate>();
    changes.set(`${update.row}:${update.column}`, update);
    pendingUpdates.current.set(key, changes);
    persistDraft(workbookId, sheetId, [...changes.values()]);
    setSaveStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void flushPending(workbookId, sheetId).catch(() => undefined);
    }, 700);
  }, [flushPending, persistDraft]);

  const recoverLocalDraft = () => {
    if (!recoveryDraft) return;
    const workbook = workbooks.find((item) => item._id === recoveryDraft.workbookId);
    const sheet = workbook?.sheets.find((item) => item._id === recoveryDraft.sheetId);
    if (!workbook || !sheet) {
      setRecoveryDraft(null);
      return;
    }
    const updates = recoveryDraft.updates.filter((update) => update.row < sheet.rowCount && update.column < sheet.columnCount);
    if (!updates.length) {
      setError('The saved local draft no longer matches this sheet.');
      setRecoveryDraft(null);
      return;
    }
    const data = sheet.data.map((row) => [...row]);
    const changes = new Map<string, CellUpdate>();
    for (const update of updates) {
      data[update.row][update.column] = update.value;
      changes.set(`${update.row}:${update.column}`, update);
    }
    const restored = {
      ...workbook,
      sheets: workbook.sheets.map((item) => item._id === sheet._id ? { ...item, data } : item),
    };
    applyWorkbook(restored);
    setActiveSheetId(sheet._id);
    const key = `${workbook._id}:${sheet._id}`;
    pendingUpdates.current.set(key, changes);
    persistDraft(workbook._id, sheet._id, updates);
    setSaveStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void flushPending(workbook._id, sheet._id).catch(() => undefined);
    }, 700);
    setRecoveryDraft(null);
  };

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    for (const [key, changes] of pendingUpdates.current) {
      const separator = key.indexOf(':');
      const workbookId = key.slice(0, separator);
      const sheetId = key.slice(separator + 1);
      void api.patch(`/sheets/workbooks/${workbookId}/sheets/${sheetId}/cells`, {
        updates: [...changes.values()],
      }).catch((saveError: unknown) => {
        console.error('Unable to save pending spreadsheet edits during navigation.', saveError);
      });
    }
  }, []);

  useEffect(() => {
    if (saveStatus !== 'unsaved' && saveStatus !== 'saving' && saveStatus !== 'error') return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  const recordHistory = (entry: HistoryEntry) => {
    setPast((current) => [...current.slice(-(MAX_UNDO - 1)), entry]);
    setFuture([]);
  };

  const applyCellValue = (row: number, column: number, value: string) => {
    if (!activeWorkbook || !activeSheet) return;
    const before = activeSheet.data[row]?.[column] ?? '';
    if (before === value) return;
    setActiveWorkbook((current) => {
      if (!current) return current;
      return {
        ...current,
        sheets: current.sheets.map((sheet) => {
          if (sheet._id !== activeSheet._id) return sheet;
          const data = sheet.data.map((cells) => [...cells]);
          data[row][column] = value;
          return { ...sheet, data };
        }),
      };
    });
    scheduleCellSave(activeWorkbook._id, activeSheet._id, { row, column, value });
  };

  const updateCell = (row: number, column: number, value: string) => {
    if (!activeSheet) return;
    const before = activeSheet.data[row]?.[column] ?? '';
    if (before === value) return;
    const key = `${activeSheet._id}:${row}:${column}`;
    const previous = past.at(-1);
    if (editingCell.current && historyEditKey.current === key && previous?.kind === 'cell' &&
        previous.sheetId === activeSheet._id && previous.row === row && previous.column === column) {
      setPast((items) => items.map((item, index) => index === items.length - 1 && item.kind === 'cell'
        ? { ...item, after: value }
        : item));
    } else {
      recordHistory({ kind: 'cell', sheetId: activeSheet._id, row, column, before, after: value });
    }
    historyEditKey.current = editingCell.current ? key : '';
    applyCellValue(row, column, value);
  };

  const applyCellFormatting = async (patch: Partial<CellStyle>) => {
    if (!activeWorkbook || !activeSheet) return;
    const startRow = Math.min(selection.startRow, selection.endRow);
    const endRow = Math.max(selection.startRow, selection.endRow);
    const startColumn = Math.min(selection.startColumn, selection.endColumn);
    const endColumn = Math.max(selection.startColumn, selection.endColumn);
    const count = (endRow - startRow + 1) * (endColumn - startColumn + 1);
    if (count > 1000) {
      setError('Select no more than 1,000 cells to format at once.');
      return;
    }
    const styleUpdates = [];
    const cellStyles = { ...(activeSheet.cellStyles ?? {}) };
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        const key = `${row}:${column}`;
        const nextStyle = { ...(cellStyles[key] ?? {}), ...patch };
        cellStyles[key] = nextStyle;
        styleUpdates.push({ row, column, style: nextStyle });
      }
    }
    setActiveWorkbook((current) => current && ({
      ...current,
      sheets: current.sheets.map((sheet) => sheet._id === activeSheet._id ? { ...sheet, cellStyles } : sheet),
    }));
    try {
      await flushPending(activeWorkbook._id, activeSheet._id);
      await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}/styles`, { updates: styleUpdates });
      setSaveStatus('saved');
      setError('');
    } catch {
      setSaveStatus('error');
      setError('Cell formatting could not be saved.');
    }
  };

  const applyValidation = async (type: SheetValidation['type']) => {
    if (!activeWorkbook || !activeSheet) return;
    const range = selectionRange(selection);
    let options: string[] = [];
    if (type === 'list') {
      const input = window.prompt('Dropdown options, separated by commas', 'To do, In progress, Done');
      if (!input) return;
      options = input.split(',').map((value) => value.trim()).filter(Boolean).slice(0, 50);
      if (!options.length || options.some((value) => value.length > 80)) {
        setError('Use 1–50 dropdown options, each no longer than 80 characters.');
        return;
      }
    }
    const validations = [...(activeSheet.validations ?? []), { range, type, options }];
    try {
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, { validations });
      applyWorkbook(response.data.workbook as Workbook);
      setError('');
    } catch {
      setError('Cell validation could not be saved.');
    }
  };

  const addConditionalFormat = async () => {
    if (!activeWorkbook || !activeSheet) return;
    const condition = window.prompt('Condition: greaterThan, lessThan, equalTo, or textContains', 'greaterThan');
    if (!condition || !['greaterThan', 'lessThan', 'equalTo', 'textContains'].includes(condition)) return;
    const value = window.prompt('Value to compare against', '0');
    if (value === null) return;
    const rule: ConditionalFormat = {
      range: selectionRange(selection),
      condition: condition as ConditionalFormat['condition'],
      value,
      color: '#991b1b',
      backgroundColor: '#fee2e2',
    };
    const conditionalFormats = [...(activeSheet.conditionalFormats ?? []), rule];
    try {
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, { conditionalFormats });
      applyWorkbook(response.data.workbook as Workbook);
      setError('');
    } catch {
      setError('Conditional formatting could not be saved.');
    }
  };

  const setFreeze = async (dimension: 'frozenRows' | 'frozenColumns') => {
    if (!activeWorkbook || !activeSheet) return;
    const maximum = dimension === 'frozenRows' ? 25 : 10;
    const count = Number(window.prompt(`Freeze how many ${dimension === 'frozenRows' ? 'top rows' : 'left columns'}? Enter 0 to unfreeze.`, String(activeSheet[dimension] ?? 0)));
    if (!Number.isInteger(count) || count < 0 || count > maximum) return;
    try {
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, { [dimension]: count });
      applyWorkbook(response.data.workbook as Workbook);
    } catch {
      setError('Freeze settings could not be saved.');
    }
  };

  const setHiddenDimension = async (dimension: 'hiddenRows' | 'hiddenColumns', hidden: boolean) => {
    if (!activeWorkbook || !activeSheet) return;
    const isRows = dimension === 'hiddenRows';
    const start = isRows ? Math.min(selection.startRow, selection.endRow) : Math.min(selection.startColumn, selection.endColumn);
    const end = isRows ? Math.max(selection.startRow, selection.endRow) : Math.max(selection.startColumn, selection.endColumn);
    const current = activeSheet[dimension] ?? [];
    const indexes = isRows ? activeSheet.rowCount : activeSheet.columnCount;
    const next = hidden
      ? [...new Set([...current, ...Array.from({ length: end - start + 1 }, (_, index) => start + index)])]
      : [];
    if (next.length >= indexes) {
      setError(`At least one ${isRows ? 'row' : 'column'} must remain visible.`);
      return;
    }
    try {
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, { [dimension]: next });
      applyWorkbook(response.data.workbook as Workbook);
      if (hidden && isRows) moveSelection(Math.min(end + 1, activeSheet.rowCount - 1), selectedCell.column);
      else if (hidden) moveSelection(selectedCell.row, Math.min(end + 1, activeSheet.columnCount - 1));
      setError('');
    } catch {
      setError(`Selected ${isRows ? 'rows' : 'columns'} could not be ${hidden ? 'hidden' : 'shown'}.`);
    }
  };

  const saveNote = async () => {
    if (!activeWorkbook || !activeSheet) return;
    const key = `${selectedCell.row}:${selectedCell.column}`;
    const current = activeSheet.notes?.[key] ?? '';
    const note = window.prompt(`Note for ${columnName(selectedCell.column)}${selectedCell.row + 1}`, current);
    if (note === null) return;
    const notes = { ...(activeSheet.notes ?? {}) };
    if (note.trim()) notes[key] = note.trim();
    else delete notes[key];
    try {
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, { notes });
      applyWorkbook(response.data.workbook as Workbook);
    } catch {
      setError('Cell note could not be saved.');
    }
  };

  const createChart = async () => {
    if (!activeWorkbook || !activeSheet) return;
    const range = selectionRange(selection);
    const chartRange = parseRange(range);
    if (!chartRange || chartRange.endColumn === chartRange.startColumn || chartRange.endRow === chartRange.startRow) {
      setError('Select a range containing at least two rows and two columns before creating a chart.');
      return;
    }
    const charts = [...(activeSheet.charts ?? []), { title: `${activeSheet.title} chart`, type: chartType, range }];
    try {
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, { charts });
      applyWorkbook(response.data.workbook as Workbook);
      setShowChart(false);
    } catch {
      setError('Chart could not be saved.');
    }
  };

  const findAndReplace = () => {
    if (!activeSheet) return;
    const find = window.prompt('Find text in this sheet');
    if (find === null || !find) return;
    const replacement = window.prompt('Replace with', '');
    if (replacement === null) return;
    let replaced = 0;
    for (let row = 0; row < activeSheet.rowCount; row += 1) {
      for (let column = 0; column < activeSheet.columnCount; column += 1) {
        const value = activeSheet.data[row]?.[column] ?? '';
        if (!value.includes(find)) continue;
        updateCell(row, column, value.split(find).join(replacement));
        replaced += 1;
      }
    }
    setError('');
    if (!replaced) setError(`No cells contained “${find}”.`);
  };

  const transformGrid = async (axis: 'row' | 'column', operation: 'insert' | 'delete', at?: number) => {
    if (!activeWorkbook || !activeSheet) return;
    const index = at ?? (axis === 'row' ? selectedCell.row : selectedCell.column);
    const dimension = axis === 'row' ? activeSheet.rowCount : activeSheet.columnCount;
    if (operation === 'insert' && dimension >= (axis === 'row' ? MAX_ROWS : MAX_COLUMNS)) {
      setError(`This sheet has reached the maximum ${axis} count.`);
      return;
    }
    if (operation === 'delete' && dimension <= 1) {
      setError(`A sheet must retain at least one ${axis}.`);
      return;
    }
    const nextCount = dimension + (operation === 'insert' ? 1 : -1);
    const data = axis === 'row'
      ? operation === 'insert'
        ? [...activeSheet.data.slice(0, index), Array.from({ length: activeSheet.columnCount }, () => ''), ...activeSheet.data.slice(index)].slice(0, nextCount)
        : [...activeSheet.data.slice(0, index), ...activeSheet.data.slice(index + 1)]
      : activeSheet.data.map((row) => operation === 'insert'
        ? [...row.slice(0, index), '', ...row.slice(index)].slice(0, nextCount)
        : [...row.slice(0, index), ...row.slice(index + 1)]);
    const cellStyles: Record<string, CellStyle> = {};
    for (const [key, style] of Object.entries(activeSheet.cellStyles ?? {})) {
      const [row, column] = key.split(':').map(Number);
      const coordinate = axis === 'row' ? row : column;
      if (operation === 'delete' && coordinate === index) continue;
      const nextCoordinate = coordinate + (operation === 'insert' && coordinate >= index ? 1 : operation === 'delete' && coordinate > index ? -1 : 0);
      cellStyles[axis === 'row' ? `${nextCoordinate}:${column}` : `${row}:${nextCoordinate}`] = style;
    }
    const shiftHidden = (items: number[], affected: boolean) => items.flatMap((coordinate) => {
      if (!affected) return [coordinate];
      if (operation === 'delete' && coordinate === index) return [];
      return [coordinate + (operation === 'insert' && coordinate >= index ? 1 : operation === 'delete' && coordinate > index ? -1 : 0)];
    });
    const hiddenRows = shiftHidden(activeSheet.hiddenRows ?? [], axis === 'row');
    const hiddenColumns = shiftHidden(activeSheet.hiddenColumns ?? [], axis === 'column');
    try {
      await flushPending(activeWorkbook._id, activeSheet._id);
      const response = await api.put(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}/cells`, { data });
      let workbook = response.data.workbook as Workbook;
      const resized = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, {
        cellStyles,
        hiddenRows,
        hiddenColumns,
        ...(axis === 'row' ? { rowCount: nextCount } : { columnCount: nextCount }),
      });
      workbook = resized.data.workbook as Workbook;
      applyWorkbook(workbook);
      setSelectedCell((current) => ({
        row: axis === 'row' ? Math.min(index, nextCount - 1) : current.row,
        column: axis === 'column' ? Math.min(index, nextCount - 1) : current.column,
      }));
      setPast([]);
      setFuture([]);
    } catch {
      setError(`Could not ${operation} the selected ${axis}.`);
    }
  };

  const focusCell = (row: number, column: number) => {
    if (!activeSheet) return;
    const boundedRow = Math.max(0, Math.min(activeSheet.rowCount - 1, visibleRows.includes(row)
      ? row
      : visibleRows.find((candidate) => candidate >= row) ?? visibleRows.at(-1) ?? 0));
    const boundedColumn = Math.max(0, Math.min(activeSheet.columnCount - 1, visibleColumns.includes(column)
      ? column
      : visibleColumns.find((candidate) => candidate >= column) ?? visibleColumns.at(-1) ?? 0));
    const rowIndex = visibleRows.indexOf(boundedRow);
    if (rowIndex < virtualRows.start || rowIndex >= virtualRows.end) {
      const start = Math.max(0, rowIndex - 8);
      setVirtualRows({ start, end: Math.min(visibleRows.length, start + 60) });
      gridRef.current?.scrollTo({ top: Math.max(0, rowIndex * 36 * zoom / 100 - 120) });
    }
    window.requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLElement>(`[data-grid-cell="${boundedRow}:${boundedColumn}"]`)?.focus();
    });
  };

  const moveSelection = (row: number, column: number, extend = false) => {
    if (!activeSheet) return;
    const boundedRow = Math.max(0, Math.min(activeSheet.rowCount - 1, visibleRows.includes(row)
      ? row
      : visibleRows.find((candidate) => candidate >= row) ?? visibleRows.at(-1) ?? 0));
    const boundedColumn = Math.max(0, Math.min(activeSheet.columnCount - 1, visibleColumns.includes(column)
      ? column
      : visibleColumns.find((candidate) => candidate >= column) ?? visibleColumns.at(-1) ?? 0));
    const anchor = extend ? selectionAnchor.current : { row: boundedRow, column: boundedColumn };
    if (!extend) selectionAnchor.current = anchor;
    setSelectedCell({ row: boundedRow, column: boundedColumn });
    setSelection({
      startRow: anchor.row,
      startColumn: anchor.column,
      endRow: boundedRow,
      endColumn: boundedColumn,
    });
    editingCell.current = false;
    historyEditKey.current = '';
    focusCell(boundedRow, boundedColumn);
  };

  const clearSelectedCells = () => {
    if (!activeSheet) return;
    const changes: Array<{ row: number; column: number; before: string; after: string }> = [];
    for (let row = Math.min(selection.startRow, selection.endRow); row <= Math.max(selection.startRow, selection.endRow); row += 1) {
      for (let column = Math.min(selection.startColumn, selection.endColumn); column <= Math.max(selection.startColumn, selection.endColumn); column += 1) {
        const before = activeSheet.data[row]?.[column] ?? '';
        if (before) changes.push({ row, column, before, after: '' });
      }
    }
    if (changes.length) {
      recordHistory({ kind: 'range', sheetId: activeSheet._id, changes });
      changes.forEach(({ row, column, after }) => applyCellValue(row, column, after));
    }
    editingCell.current = false;
    historyEditKey.current = '';
  };

  const persistPastedStyles = async (updates: Array<{ row: number; column: number; style: CellStyle | null }>) => {
    if (!activeWorkbook || !activeSheet || !updates.length) return;
    const cellStyles = { ...(activeSheet.cellStyles ?? {}) };
    for (const update of updates) {
      const key = `${update.row}:${update.column}`;
      if (update.style) cellStyles[key] = update.style;
      else delete cellStyles[key];
    }
    setActiveWorkbook((current) => current && ({
      ...current,
      sheets: current.sheets.map((sheet) => sheet._id === activeSheet._id ? { ...sheet, cellStyles } : sheet),
    }));
    try {
      for (let offset = 0; offset < updates.length; offset += 1_000) {
        await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}/styles`, {
          updates: updates.slice(offset, offset + 1_000),
        });
      }
    } catch {
      setSaveStatus('error');
      setError('Pasted cell formatting could not be saved.');
    }
  };

  const applyPaste = (text: string) => {
    if (!activeSheet) return;
    const rows = text.replace(/\r/g, '').split('\n').filter((line, index, all) => line !== '' || index < all.length - 1);
    const values = rows.map((row) => row.split('\t'));
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const clipboard = gridClipboard.current?.text === normalizedText ? gridClipboard.current : null;
    const rowOffset = selection.startRow;
    const columnOffset = selection.startColumn;
    if (rowOffset + values.length > activeSheet.rowCount || columnOffset + Math.max(...values.map((row) => row.length)) > activeSheet.columnCount) {
      setError('Pasted cells exceed the current sheet. Add rows or columns first.');
      return;
    }
    const styleUpdates: Array<{ row: number; column: number; style: CellStyle | null }> = [];
    const changes: Array<{ row: number; column: number; before: string; after: string }> = [];
    values.forEach((row, rowIndex) => row.forEach((sourceValue, columnIndex) => {
      const destinationRow = rowOffset + rowIndex;
      const destinationColumn = columnOffset + columnIndex;
      const value = clipboard && sourceValue.startsWith('=')
        ? shiftFormula(sourceValue, destinationRow - (clipboard.sourceRow + rowIndex), destinationColumn - (clipboard.sourceColumn + columnIndex))
        : sourceValue;
      const before = activeSheet.data[destinationRow]?.[destinationColumn] ?? '';
      if (before !== value) changes.push({ row: destinationRow, column: destinationColumn, before, after: value });
      if (clipboard) {
        const style = clipboard.styles[rowIndex]?.[columnIndex];
        styleUpdates.push({ row: destinationRow, column: destinationColumn, style: style ? { ...style } : null });
      }
    }));
    if (changes.length) {
      recordHistory({ kind: 'range', sheetId: activeSheet._id, changes });
      changes.forEach(({ row, column, after }) => applyCellValue(row, column, after));
    }
    if (styleUpdates.length) void persistPastedStyles(styleUpdates);
    editingCell.current = false;
    historyEditKey.current = '';
  };

  const gridClipboardKeyDown = async (event: KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.ctrlKey || event.metaKey;
    const command = event.key.toLowerCase();
    if (modifier && command === 'a') {
      if (!activeSheet) return;
      event.preventDefault();
      selectionAnchor.current = { row: 0, column: 0 };
      setSelectedCell({ row: 0, column: 0 });
      setSelection({ startRow: 0, startColumn: 0, endRow: activeSheet.rowCount - 1, endColumn: activeSheet.columnCount - 1 });
      focusCell(0, 0);
      editingCell.current = false;
      return;
    }
    if (modifier && (command === 'c' || command === 'x')) {
      if (!activeSheet) return;
      event.preventDefault();
      const startRow = Math.min(selection.startRow, selection.endRow);
      const startColumn = Math.min(selection.startColumn, selection.endColumn);
      const endRow = Math.max(selection.startRow, selection.endRow);
      const endColumn = Math.max(selection.startColumn, selection.endColumn);
      const values: string[][] = [];
      const styles: Array<Array<CellStyle | undefined>> = [];
      const rows: string[] = [];
      for (let row = Math.min(selection.startRow, selection.endRow); row <= Math.max(selection.startRow, selection.endRow); row += 1) {
        const copiedRow: string[] = [];
        const copiedStyles: Array<CellStyle | undefined> = [];
        for (let column = Math.min(selection.startColumn, selection.endColumn); column <= Math.max(selection.startColumn, selection.endColumn); column += 1) {
          copiedRow.push(activeSheet.data[row]?.[column] ?? '');
          copiedStyles.push(activeSheet.cellStyles?.[`${row}:${column}`]);
        }
        values.push(copiedRow);
        styles.push(copiedStyles);
        rows.push(copiedRow.join('\t'));
      }
      const text = rows.join('\n');
      gridClipboard.current = { text, values, styles, sourceRow: startRow, sourceColumn: startColumn };
      let clipboardWritten = false;
      try {
        await navigator.clipboard.writeText(text);
        clipboardWritten = true;
      } catch {
        setError('Clipboard access was denied.');
      }
      if (command === 'x' && clipboardWritten) clearSelectedCells();
      return;
    }
    if (modifier && command === 'v') {
      if (event.target instanceof HTMLElement && event.target.closest('[data-grid-cell]')) return;
      event.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        applyPaste(text);
      } catch {
        setError('Clipboard access was denied. Use Ctrl+V in a selected cell instead.');
      }
      return;
    }
    if (!modifier && (event.key === 'Delete' || event.key === 'Backspace') &&
        !(event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) {
      clearSelectedCells();
      event.preventDefault();
      return;
    }
  };

  const conditionalStyle = (row: number, column: number): Partial<CSSStyleDeclaration> => {
    for (const rule of activeSheet?.conditionalFormats ?? []) {
      const range = parseRange(rule.range);
      if (!range || row < range.startRow || row > range.endRow || column < range.startColumn || column > range.endColumn) continue;
      const value = formulaCellValue(row, column);
      const actual = String(firstValue(value) ?? '');
      const numericActual = Number(actual);
      const numericTarget = Number(rule.value);
      const matches = rule.condition === 'greaterThan' ? Number.isFinite(numericActual) && numericActual > numericTarget
        : rule.condition === 'lessThan' ? Number.isFinite(numericActual) && numericActual < numericTarget
          : rule.condition === 'equalTo' ? actual.toLowerCase() === rule.value.toLowerCase()
            : actual.toLowerCase().includes(rule.value.toLowerCase());
      if (matches) return { color: rule.color, backgroundColor: rule.backgroundColor };
    }
    return {};
  };

  const updateWorkbookTitle = async (title: string) => {
    if (!activeWorkbook || !title.trim() || title.trim() === activeWorkbook.title) return;
    try {
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}`, { title: title.trim() });
      applyWorkbook(response.data.workbook as Workbook);
    } catch {
      setError('Workbook name could not be changed.');
    }
  };

  const createWorkbook = async () => {
    setCreating(true);
    setError('');
    try {
      const response = await api.post('/sheets/workbooks', { title: 'Untitled spreadsheet' });
      const workbook = response.data.workbook as Workbook;
      applyWorkbook(workbook);
      setActiveSheetId(workbook.sheets[0]?._id ?? '');
      setPast([]);
      setFuture([]);
    } catch {
      setError('A new spreadsheet could not be created.');
    } finally {
      setCreating(false);
    }
  };

  const addSheet = async (title?: string) => {
    if (!activeWorkbook) return;
    try {
      if (activeSheet) await flushPending(activeWorkbook._id, activeSheet._id);
      const response = await api.post(`/sheets/workbooks/${activeWorkbook._id}/sheets`, { title });
      const workbook = response.data.workbook as Workbook;
      applyWorkbook(workbook);
      setActiveSheetId(workbook.sheets.at(-1)?._id ?? '');
      setPast([]);
      setFuture([]);
    } catch {
      setError('A new sheet could not be added. Please try again.');
    }
  };

  const renameSheet = async () => {
    if (!activeWorkbook || !activeSheet) return;
    const title = window.prompt('Rename sheet', activeSheet.title)?.trim();
    if (!title || title === activeSheet.title) return;
    try {
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, { title });
      applyWorkbook(response.data.workbook as Workbook);
    } catch {
      setError('Sheet name could not be changed.');
    }
  };

  const duplicateSheet = async () => {
    if (!activeWorkbook || !activeSheet) return;
    try {
      await flushPending(activeWorkbook._id, activeSheet._id);
      const response = await api.post(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}/duplicate`);
      const workbook = response.data.workbook as Workbook;
      applyWorkbook(workbook);
      setActiveSheetId(workbook.sheets.at(-1)?._id ?? '');
      setPast([]);
      setFuture([]);
    } catch {
      setError('Sheet could not be duplicated.');
    }
  };

  const deleteSheet = async () => {
    if (!activeWorkbook || !activeSheet) return;
    if (activeWorkbook.sheets.length <= 1) {
      setError('A workbook must keep at least one sheet.');
      return;
    }
    if (!window.confirm(`Delete “${activeSheet.title}”? This cannot be undone.`)) return;
    try {
      await flushPending(activeWorkbook._id, activeSheet._id);
      const response = await api.delete(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`);
      const workbook = response.data.workbook as Workbook;
      applyWorkbook(workbook);
      setActiveSheetId(workbook.sheets[0]._id);
      setPast([]);
      setFuture([]);
    } catch {
      setError('Sheet could not be deleted.');
    }
  };

  const deleteWorkbook = async () => {
    if (!activeWorkbook || !window.confirm(`Delete “${activeWorkbook.title}” and all of its sheets?`)) return;
    try {
      if (activeSheet) await flushPending(activeWorkbook._id, activeSheet._id);
      await api.delete(`/sheets/workbooks/${activeWorkbook._id}`);
      const remaining = workbooks.filter((item) => item._id !== activeWorkbook._id);
      setWorkbooks(remaining);
      setActiveWorkbook(remaining[0] ?? null);
      setActiveSheetId(remaining[0]?.sheets[0]?._id ?? '');
      setPast([]);
      setFuture([]);
    } catch {
      setError('Workbook could not be deleted.');
    }
  };

  const resizeDimension = async (dimension: 'rowCount' | 'columnCount', amount: number) => {
    if (!activeWorkbook || !activeSheet) return;
    const limit = dimension === 'rowCount' ? MAX_ROWS : MAX_COLUMNS;
    const current = activeSheet[dimension];
    const next = Math.max(1, Math.min(limit, current + amount));
    if (next === current) return;
    const before = { data: activeSheet.data, rowCount: activeSheet.rowCount, columnCount: activeSheet.columnCount };
    const rowCount = dimension === 'rowCount' ? next : activeSheet.rowCount;
    const columnCount = dimension === 'columnCount' ? next : activeSheet.columnCount;
    const data = resizeGrid(activeSheet.data, rowCount, columnCount);
    const after = { data, rowCount, columnCount };
    try {
      await flushPending(activeWorkbook._id, activeSheet._id);
      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, {
        rowCount,
        columnCount,
      });
      const workbook = response.data.workbook as Workbook;
      applyWorkbook({
        ...workbook,
        sheets: workbook.sheets.map((sheet) => sheet._id === activeSheet._id ? { ...sheet, data } : sheet),
      });
      recordHistory({ kind: 'grid', sheetId: activeSheet._id, before, after });
    } catch {
      setError(`Could not ${amount > 0 ? 'add' : 'remove'} ${dimension === 'rowCount' ? 'row' : 'column'}.`);
    }
  };

  const restoreGrid = async (sheetId: string, grid: { data: string[][]; rowCount: number; columnCount: number }) => {
    if (!activeWorkbook) return;
    const response = await api.put(`/sheets/workbooks/${activeWorkbook._id}/sheets/${sheetId}/cells`, { data: grid.data });
    const workbook = response.data.workbook as Workbook;
    applyWorkbook({
      ...workbook,
      sheets: workbook.sheets.map((sheet) => sheet._id === sheetId ? { ...sheet, ...grid } : sheet),
    });
  };

  const undo = async () => {
    const entry = past.at(-1);
    if (!entry || !activeWorkbook || entry.sheetId !== activeSheetId) return;
    editingCell.current = false;
    historyEditKey.current = '';
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [...items, entry]);
    if (entry.kind === 'cell') {
      applyCellValue(entry.row, entry.column, entry.before);
    } else if (entry.kind === 'range') {
      entry.changes.forEach(({ row, column, before }) => applyCellValue(row, column, before));
    } else {
      try {
        await restoreGrid(entry.sheetId, entry.before);
      } catch {
        setError('Undo could not be saved.');
        setPast((items) => [...items, entry]);
        setFuture((items) => items.slice(0, -1));
      }
    }
  };

  const redo = async () => {
    const entry = future.at(-1);
    if (!entry || !activeWorkbook || entry.sheetId !== activeSheetId) return;
    editingCell.current = false;
    historyEditKey.current = '';
    setFuture((items) => items.slice(0, -1));
    setPast((items) => [...items, entry]);
    if (entry.kind === 'cell') {
      applyCellValue(entry.row, entry.column, entry.after);
    } else if (entry.kind === 'range') {
      entry.changes.forEach(({ row, column, after }) => applyCellValue(row, column, after));
    } else {
      try {
        await restoreGrid(entry.sheetId, entry.after);
      } catch {
        setError('Redo could not be saved.');
        setFuture((items) => [...items, entry]);
        setPast((items) => items.slice(0, -1));
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(event.key.toLowerCase())) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]') && !target.closest('[data-grid-cell]')) return;
      event.preventDefault();
      if (event.key.toLowerCase() === 'y' || event.shiftKey) void redo();
      else void undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeWorkbook || !activeSheet) return;
    try {
      await flushPending(activeWorkbook._id, activeSheet._id);
      const extension = file.name.split('.').at(-1)?.toLowerCase();
      if (!['xlsx', 'csv'].includes(extension ?? '')) throw new Error('Choose an .xlsx or .csv file.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Files must be 10 MB or smaller.');
      let importedGrids: Array<{ title: string; rowCount: number; columnCount: number; data: string[][]; cellStyles?: Record<string, CellStyle> }>;
      if (extension === 'csv') {
        const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: false });
        if (parsed.errors.length) throw new Error(parsed.errors[0].message);
        const rows = parsed.data;
        if (rows.length > MAX_ROWS || rows.some((row) => row.length > MAX_COLUMNS)) {
          throw new Error(`The file exceeds the ${MAX_ROWS}-row or ${MAX_COLUMNS}-column limit.`);
        }
        const normalized = rows.map((row) => row.map((value) => {
          if (value.length > 10_000) throw new Error('A cell exceeds the 10,000-character limit.');
          return value;
        }));
        const rowCount = Math.max(1, normalized.length);
        const columnCount = Math.max(1, normalized.reduce((max, row) => Math.max(max, row.length), 1));
        importedGrids = [{
          title: file.name.replace(/\.csv$/i, '').slice(0, 80),
          rowCount,
          columnCount,
          data: resizeGrid(normalized, rowCount, columnCount),
          cellStyles: {},
        }];
      } else {
        const imported = new ExcelJS.Workbook();
        await imported.xlsx.load(await file.arrayBuffer());
        if (imported.worksheets.length === 0) throw new Error('The selected file contains no sheets.');
        if (imported.worksheets.length > 100) throw new Error('A workbook can contain at most 100 sheets.');
        importedGrids = imported.worksheets.map((worksheet) => {
          const rowCount = Math.max(1, worksheet.rowCount);
          const columnCount = Math.max(1, worksheet.columnCount);
          if (rowCount > MAX_ROWS || columnCount > MAX_COLUMNS) {
            throw new Error(`“${worksheet.name}” exceeds the ${MAX_ROWS}-row or ${MAX_COLUMNS}-column limit.`);
          }
          const cellStyles: Record<string, CellStyle> = {};
          const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
            Array.from({ length: columnCount }, (_, columnIndex) => {
              const cell = worksheet.getCell(rowIndex + 1, columnIndex + 1);
              const style = excelCellStyle(cell);
              if (style) cellStyles[`${rowIndex}:${columnIndex}`] = style;
              return excelCellText(cell);
            }),
          );
          if (rows.some((row) => row.some((value) => value.length > 10_000))) {
            throw new Error(`A cell in “${worksheet.name}” exceeds the 10,000-character limit.`);
          }
          return { title: worksheet.name.slice(0, 80) || 'Imported sheet', rowCount, columnCount, data: rows, cellStyles };
        });
      }

      let workbook = activeWorkbook;
      for (let index = 0; index < importedGrids.length; index += 1) {
        let targetSheet = index === 0 ? activeSheet : null;
        if (!targetSheet) {
          const created = await api.post(`/sheets/workbooks/${workbook._id}/sheets`, { title: importedGrids[index].title });
          workbook = created.data.workbook as Workbook;
          targetSheet = workbook.sheets.at(-1) ?? null;
        }
        if (!targetSheet) continue;
        const grid = importedGrids[index];
        const replaced = await api.put(`/sheets/workbooks/${workbook._id}/sheets/${targetSheet._id}/cells`, { data: grid.data });
        workbook = replaced.data.workbook as Workbook;
        const resized = await api.patch(`/sheets/workbooks/${workbook._id}/sheets/${targetSheet._id}`, {
          title: grid.title,
          cellStyles: grid.cellStyles ?? {},
        });
        workbook = resized.data.workbook as Workbook;
        if (index === 0) setActiveSheetId(targetSheet._id);
      }
      applyWorkbook(workbook);
      setPast([]);
      setFuture([]);
      setSaveStatus('saved');
      setError('');
    } catch (importError) {
      setError(importError instanceof Error && importError.message
        ? `Import failed: ${importError.message}`
        : 'This file could not be imported. Use a valid .xlsx or .csv file.');
    }
  };

  const exportCsv = () => {
    if (!activeSheet) return;
    downloadBlob(Papa.unparse(activeSheet.data), `${activeSheet.title}.csv`, 'text/csv;charset=utf-8');
  };

  const exportExcel = async () => {
    if (!activeWorkbook) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const usedNames = new Set<string>();
      activeWorkbook.sheets.forEach((sheet) => {
        const worksheet = workbook.addWorksheet(excelSheetTitle(sheet.title, usedNames));
        sheet.data.forEach((row, rowIndex) => {
          const excelRow = worksheet.addRow(row.map((value) =>
            value.startsWith('=') ? { formula: value.slice(1) } : value,
          ));
          row.forEach((_, columnIndex) => {
            const style = sheet.cellStyles?.[`${rowIndex}:${columnIndex}`];
            if (!style) return;
            const cell = excelRow.getCell(columnIndex + 1);
            cell.font = {
              bold: style.bold,
              italic: style.italic,
              underline: style.underline,
              size: style.fontSize,
              color: style.color ? { argb: `FF${style.color.slice(1)}` } : undefined,
            };
            if (style.backgroundColor) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${style.backgroundColor.slice(1)}` } };
            cell.alignment = { horizontal: style.horizontal, vertical: style.vertical === 'middle' ? 'middle' : style.vertical, wrapText: style.wrap };
            cell.numFmt = excelNumberFormat(style.numberFormat);
            if (style.border && style.border !== 'none') {
              const borderStyle = style.border === 'medium' ? 'medium' : 'thin';
              cell.border = { top: { style: borderStyle }, bottom: { style: borderStyle }, left: { style: borderStyle }, right: { style: borderStyle } };
            }
          });
        });
      });
      const output = await workbook.xlsx.writeBuffer();
      downloadBlob(output, `${activeWorkbook.title}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch {
      setError('Excel workbook could not be exported.');
    }
  };

  const visibleRows = useMemo(() => {
    if (!activeSheet) return [];
    const hiddenRows = new Set(activeSheet.hiddenRows ?? []);
    let rows = activeSheet.data.map((_, index) => index).filter((index) => !hiddenRows.has(index));
    const searchQuery = search.trim().toLowerCase();
    const filterQuery = filter.trim().toLowerCase();
    rows = rows.filter((rowIndex) => {
      const cells = activeSheet.data[rowIndex];
      const matchesSearch = !searchQuery || cells.some((value) => value.toLowerCase().includes(searchQuery));
      const matchesFilter = !filterQuery || cells.some((value) => value.toLowerCase().includes(filterQuery));
      return matchesSearch && matchesFilter;
    });
    if (sortDirection) {
      rows.sort((left, right) => {
        const a = activeSheet.data[left][selectedCell.column] ?? '';
        const b = activeSheet.data[right][selectedCell.column] ?? '';
        const comparison = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    return rows;
  }, [activeSheet, search, filter, sortDirection, selectedCell.column]);
  const visibleColumns = useMemo(() => {
    if (!activeSheet) return [];
    const hiddenColumns = new Set(activeSheet.hiddenColumns ?? []);
    return Array.from({ length: activeSheet.columnCount }, (_, column) => column).filter((column) => !hiddenColumns.has(column));
  }, [activeSheet]);

  const selectSheet = async (sheetId: string) => {
    if (activeWorkbook && activeSheet) {
      try {
        await flushPending(activeWorkbook._id, activeSheet._id);
      } catch {
        return;
      }
    }
    setActiveSheetId(sheetId);
    setSelectedCell({ row: 0, column: 0 });
    setColumnWidths({});
    setPast([]);
    setFuture([]);
    setSearch('');
    setFilter('');
  };

  const fillSelectionTo = (targetRow: number, targetColumn: number) => {
    if (!activeSheet) return;
    const source = fillSource.current;
    if (!source) return;
    const startRow = Math.min(source.startRow, source.endRow);
    const endRow = Math.max(source.startRow, source.endRow);
    const startColumn = Math.min(source.startColumn, source.endColumn);
    const endColumn = Math.max(source.startColumn, source.endColumn);
    const minRow = Math.min(startRow, targetRow);
    const maxRow = Math.max(endRow, targetRow);
    const minColumn = Math.min(startColumn, targetColumn);
    const maxColumn = Math.max(endColumn, targetColumn);
    const rowCount = endRow - startRow + 1;
    const columnCount = endColumn - startColumn + 1;
    const firstVertical = Number(activeSheet.data[startRow]?.[startColumn] ?? '');
    const secondVertical = Number(activeSheet.data[startRow + 1]?.[startColumn] ?? '');
    const firstHorizontal = Number(activeSheet.data[startRow]?.[startColumn] ?? '');
    const secondHorizontal = Number(activeSheet.data[startRow]?.[startColumn + 1] ?? '');
    const verticalStep = rowCount > 1 && Number.isFinite(secondVertical - firstVertical) ? secondVertical - firstVertical : 1;
    const horizontalStep = columnCount > 1 && Number.isFinite(secondHorizontal - firstHorizontal) ? secondHorizontal - firstHorizontal : 1;
    const styleUpdates: Array<{ row: number; column: number; style: CellStyle | null }> = [];
    const changes: Array<{ row: number; column: number; before: string; after: string }> = [];
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        if (row >= startRow && row <= endRow && column >= startColumn && column <= endColumn) continue;
        const sourceRow = startRow + ((row - startRow) % rowCount + rowCount) % rowCount;
        const sourceColumn = startColumn + ((column - startColumn) % columnCount + columnCount) % columnCount;
        const sourceValue = activeSheet.data[sourceRow]?.[sourceColumn] ?? '';
        let value = sourceValue;
        if (sourceValue.startsWith('=')) {
          value = shiftFormula(sourceValue, row - sourceRow, column - sourceColumn);
        } else if (columnCount === 1 && rowCount > 1 && row > endRow &&
            /^-?\d+(?:\.\d+)?$/.test(activeSheet.data[startRow]?.[startColumn] ?? '') &&
            /^-?\d+(?:\.\d+)?$/.test(activeSheet.data[endRow]?.[startColumn] ?? '')) {
          const first = Number(activeSheet.data[startRow][startColumn]);
          const last = Number(activeSheet.data[endRow][startColumn]);
          value = String(last + (row - endRow) * (last - first) / (rowCount - 1));
        } else if (rowCount === 1 && columnCount > 1 && column > endColumn &&
            /^-?\d+(?:\.\d+)?$/.test(activeSheet.data[startRow]?.[startColumn] ?? '') &&
            /^-?\d+(?:\.\d+)?$/.test(activeSheet.data[startRow]?.[endColumn] ?? '')) {
          const first = Number(activeSheet.data[startRow][startColumn]);
          const last = Number(activeSheet.data[startRow][endColumn]);
          value = String(last + (column - endColumn) * (last - first) / (columnCount - 1));
        } else if (rowCount === 1 && columnCount === 1 && /^-?\d+(?:\.\d+)?$/.test(sourceValue)) {
          if (row !== startRow) value = String(firstVertical + (row - startRow) * verticalStep);
          else if (column !== startColumn) value = String(firstHorizontal + (column - startColumn) * horizontalStep);
        } else if (rowCount === 1 && columnCount === 1 && /^\d{4}-\d{2}-\d{2}$/.test(sourceValue)) {
          const date = new Date(`${sourceValue}T00:00:00Z`);
          date.setUTCDate(date.getUTCDate() + row - startRow + column - startColumn);
          value = date.toISOString().slice(0, 10);
        }
        const before = activeSheet.data[row]?.[column] ?? '';
        if (before !== value) changes.push({ row, column, before, after: value });
        const style = activeSheet.cellStyles?.[`${sourceRow}:${sourceColumn}`];
        styleUpdates.push({ row, column, style: style ? { ...style } : null });
      }
    }
    if (changes.length) {
      recordHistory({ kind: 'range', sheetId: activeSheet._id, changes });
      changes.forEach(({ row, column, after }) => applyCellValue(row, column, after));
    }
    if (styleUpdates.length) void persistPastedStyles(styleUpdates);
    fillSource.current = null;
    fillPointerId.current = null;
    setFillTarget(null);
    editingCell.current = false;
  };

  const resizeColumn = (column: number, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const initialWidth = columnWidths[column] ?? 112;
    const onMove = (moveEvent: PointerEvent) => {
      const width = Math.max(68, Math.min(420, initialWidth + moveEvent.clientX - startX));
      setColumnWidths((current) => ({ ...current, [column]: width }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const insertFormulaReference = (row: number, column: number, shift: boolean) => {
    const input = formulaInputRef.current;
    const formulaRow = selectedCell.row;
    const formulaColumn = selectedCell.column;
    const previousSpan = formulaReferenceSpan.current;
    const canExtend = shift && previousSpan?.formulaRow === formulaRow && previousSpan.formulaColumn === formulaColumn;
    const from = canExtend ? previousSpan.anchor : { row, column };
    const start = `${columnName(from.column)}${from.row + 1}`;
    const end = `${columnName(column)}${row + 1}`;
    const reference = start === end ? start : `${start}:${end}`;
    const current = formulaBarValue;
    const cursorStart = canExtend ? previousSpan.start : input?.selectionStart ?? current.length;
    const cursorEnd = canExtend ? previousSpan.end : input?.selectionEnd ?? cursorStart;
    const next = `${current.slice(0, cursorStart)}${reference}${current.slice(cursorEnd)}`;
    setSelection({ startRow: from.row, startColumn: from.column, endRow: row, endColumn: column });
    if (!canExtend) selectionAnchor.current = { row, column };
    setFormulaBarValue(next);
    updateCell(formulaRow, formulaColumn, next);
    formulaReferenceMode.current = true;
    formulaReferenceSpan.current = {
      start: cursorStart,
      end: cursorStart + reference.length,
      anchor: from,
      formulaRow,
      formulaColumn,
    };
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(cursorStart + reference.length, cursorStart + reference.length);
    });
  };

  const handleCellKeyDown = (event: KeyboardEvent<HTMLInputElement>, row: number, column: number) => {
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key;
    if (key === 'F2') {
      event.preventDefault();
      editingCell.current = true;
      historyEditKey.current = '';
      const input = event.currentTarget;
      window.requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      editingCell.current = false;
      historyEditKey.current = '';
      const value = activeSheet?.data[row]?.[column] ?? '';
      setFormulaBarValue(value);
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (!editingCell.current) {
        event.preventDefault();
        clearSelectedCells();
      }
      return;
    }
    if (key === 'Enter' || key === 'Tab') {
      event.preventDefault();
      const reverse = event.shiftKey;
      editingCell.current = false;
      moveSelection(
        row + (key === 'Enter' ? (reverse ? -1 : 1) : 0),
        column + (key === 'Tab' ? (reverse ? -1 : 1) : 0),
      );
      return;
    }
    const arrow = key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
    if (arrow && (!editingCell.current || modifier || event.shiftKey)) {
      event.preventDefault();
      let nextRow = row;
      let nextColumn = column;
      if (key === 'ArrowUp') nextRow -= 1;
      if (key === 'ArrowDown') nextRow += 1;
      if (key === 'ArrowLeft') nextColumn -= 1;
      if (key === 'ArrowRight') nextColumn += 1;
      if (modifier && activeSheet) {
        const rowStep = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
        const columnStep = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
        const limit = rowStep ? activeSheet.rowCount : activeSheet.columnCount;
        const currentIndex = rowStep ? row : column;
        const step = rowStep || columnStep;
        const readValue = (index: number) => rowStep
          ? activeSheet.data[index]?.[column] ?? ''
          : activeSheet.data[row]?.[index] ?? '';
        let index = currentIndex;
        if (readValue(index) !== '') {
          while (index + step >= 0 && index + step < limit && readValue(index + step) !== '') index += step;
        } else {
          while (index + step >= 0 && index + step < limit && readValue(index + step) === '') index += step;
          if (index + step >= 0 && index + step < limit) index += step;
        }
        if (rowStep) nextRow = index;
        else nextColumn = index;
      }
      moveSelection(nextRow, nextColumn, event.shiftKey);
      return;
    }
    if (!modifier && !event.altKey && !event.shiftKey && key.length === 1) {
      event.preventDefault();
      selectionAnchor.current = { row, column };
      setSelectedCell({ row, column });
      setSelection({ startRow: row, startColumn: column, endRow: row, endColumn: column });
      editingCell.current = true;
      historyEditKey.current = '';
      updateCell(row, column, key);
      if (key === '=') formulaReferenceMode.current = true;
      setFormulaBarValue(key);
      const input = event.currentTarget;
      window.requestAnimationFrame(() => input.setSelectionRange(1, 1));
    } else if (modifier && key.toLowerCase() === 'a') {
      event.preventDefault();
      if (!activeSheet) return;
      selectionAnchor.current = { row: 0, column: 0 };
      setSelectedCell({ row: 0, column: 0 });
      setSelection({ startRow: 0, startColumn: 0, endRow: activeSheet.rowCount - 1, endColumn: activeSheet.columnCount - 1 });
      focusCell(0, 0);
      editingCell.current = false;
    }
  };

  const savingLabel = saveStatus === 'saving'
    ? 'Saving…'
    : saveStatus === 'unsaved'
      ? 'Unsaved changes'
      : saveStatus === 'error'
        ? 'Sync issue'
        : 'All changes saved';
  const formulaFragment = formulaBarValue.match(/(?:^|[=(,+\-*/&])([A-Z_]*)$/i)?.[1]?.toUpperCase() ?? '';
  const formulaSuggestions = formulaBarValue.startsWith('=')
    ? formulaFunctionNames.filter((name) => !formulaFragment || name.startsWith(formulaFragment)).slice(0, 8)
    : [];
  const selectedRangeValue = selectionRange(selection);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sheets"
        subtitle="Work with your team’s data in a familiar spreadsheet."
        icon={FileSpreadsheet}
        iconColor="text-emerald-700"
        iconBg="bg-emerald-50"
        actions={
          <button type="button" onClick={() => void createWorkbook()} disabled={creating} className="btn-primary">
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New spreadsheet
          </button>
        }
      />

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <div className="flex shrink-0 items-center gap-3">
            {loadFailed && <button type="button" onClick={() => void loadWorkbooks()} className="font-semibold underline">Retry</button>}
            <button type="button" onClick={() => setError('')} aria-label="Dismiss error" className="font-semibold">×</button>
          </div>
        </div>
      )}

      {recoveryDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200" role="status">
          <span>An unsynced local draft was found. Restore it to apply those edits to the saved spreadsheet.</span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={recoverLocalDraft} className="font-semibold underline">Restore draft</button>
            <button type="button" onClick={() => setRecoveryDraft(null)} className="font-medium">Dismiss</button>
          </span>
        </div>
      )}

      {loading ? (
        <div className="surface flex min-h-80 items-center justify-center gap-3 text-sm theme-text-muted">
          <LoaderCircle className="h-5 w-5 animate-spin text-[var(--accent)]" />Loading your spreadsheets…
        </div>
      ) : !activeWorkbook ? (
        <div className="surface flex min-h-[26rem] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            <Sheet className="h-8 w-8" />
          </span>
          <h2 className="text-lg font-semibold theme-text-primary">A clear space for your numbers</h2>
          <p className="mt-2 max-w-md text-sm leading-6 theme-text-secondary">Create a spreadsheet to organize, filter, and share the information your team works with.</p>
          <button type="button" onClick={() => void createWorkbook()} disabled={creating} className="btn-primary mt-6">
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create spreadsheet
          </button>
        </div>
      ) : (
        <section className="surface overflow-hidden">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex min-w-0 items-center gap-3">
              <select
                aria-label="Choose spreadsheet"
                value={activeWorkbook._id}
                onChange={(event) => {
                  const nextWorkbook = workbooks.find((item) => item._id === event.target.value);
                  if (!nextWorkbook) return;
                  setActiveWorkbook(nextWorkbook);
                  setActiveSheetId(nextWorkbook.sheets[0]?._id ?? '');
                  setPast([]);
                  setFuture([]);
                }}
                className="max-w-56 truncate rounded-lg border px-3 py-2 text-sm font-semibold theme-text-primary theme-bg-card"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {workbooks.map((workbook) => <option key={workbook._id} value={workbook._id}>{workbook.title}</option>)}
              </select>
              <button
                type="button"
                onClick={() => {
                  const title = window.prompt('Rename spreadsheet', activeWorkbook.title)?.trim();
                  if (title) void updateWorkbookTitle(title);
                }}
                className="rounded-lg p-2 theme-text-muted transition hover:bg-[var(--bg-hover)] hover:theme-text-primary"
                aria-label="Rename spreadsheet"
                title="Rename spreadsheet"
              ><MoreHorizontal className="h-4 w-4" /></button>
              <button type="button" onClick={() => void deleteWorkbook()} aria-label="Delete spreadsheet" title="Delete spreadsheet" className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2 text-xs ${saveStatus === 'error' ? 'text-rose-600' : 'theme-text-muted'}`} role="status">
                {saveStatus === 'saving' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
                {savingLabel}
              </span>
              <button type="button" className="btn-secondary" onClick={() => importInput.current?.click()}><Upload className="h-4 w-4" />Import</button>
              <input ref={importInput} type="file" accept=".xlsx,.csv" onChange={(event) => void importFile(event)} className="hidden" />
              <div className="relative">
                <details className="group relative">
                  <summary className="btn-secondary list-none cursor-pointer"><Download className="h-4 w-4" />Export<ChevronDown className="h-3.5 w-3.5" /></summary>
                  <div className="absolute right-0 z-30 mt-2 min-w-40 rounded-xl border p-1.5 shadow-lg theme-bg-card" style={{ borderColor: 'var(--border-color)' }}>
                    <button type="button" onClick={exportExcel} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs theme-text-secondary hover:bg-[var(--bg-hover)]"><FileSpreadsheet className="h-4 w-4" />Excel workbook</button>
                    <button type="button" onClick={exportCsv} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs theme-text-secondary hover:bg-[var(--bg-hover)]"><Download className="h-4 w-4" />Current sheet as CSV</button>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {activeSheet ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5 sm:px-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <button type="button" onClick={() => void undo()} disabled={!past.some((entry) => entry.sheetId === activeSheet._id)} title="Undo (Ctrl+Z)" aria-label="Undo" className="rounded-lg p-2 theme-text-secondary transition hover:bg-[var(--bg-hover)] disabled:opacity-40"><RotateCcw className="h-4 w-4" /></button>
                <button type="button" onClick={() => void redo()} disabled={!future.some((entry) => entry.sheetId === activeSheet._id)} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className="rounded-lg p-2 theme-text-secondary transition hover:bg-[var(--bg-hover)] disabled:opacity-40"><RotateCw className="h-4 w-4" /></button>
                <span className="mx-1 hidden h-6 w-px sm:block" style={{ background: 'var(--border-color)' }} />
                <label className="relative min-w-36 flex-1 sm:max-w-56">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 theme-text-muted" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cells" className="input-field h-9 pl-9 text-xs" />
                </label>
                <button type="button" onClick={findAndReplace} className="btn-secondary h-9" title="Find and replace in this sheet">Find &amp; replace</button>
                <label className="relative min-w-36 flex-1 sm:max-w-56">
                  <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 theme-text-muted" />
                  <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter rows" className="input-field h-9 pl-9 text-xs" />
                </label>
                <button
                  type="button"
                  onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')}
                  className="btn-secondary h-9"
                  title={`Sort by column ${columnName(selectedCell.column)}`}
                >
                  {sortDirection === 'desc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
                  Sort {columnName(selectedCell.column)}
                </button>
                <label className="flex h-9 items-center gap-1 rounded-lg border px-2 text-xs theme-text-secondary" style={{ borderColor: 'var(--border-color)' }}>
                  Zoom
                  <select aria-label="Sheet zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="bg-transparent text-xs outline-none">
                    {[75, 90, 100, 110, 125, 150].map((value) => <option key={value} value={value}>{value}%</option>)}
                  </select>
                </label>
                <span className="mx-1 hidden h-6 w-px sm:block" style={{ background: 'var(--border-color)' }} />
                <button type="button" onClick={() => void applyCellFormatting({ bold: !activeSheet.cellStyles?.[`${selectedCell.row}:${selectedCell.column}`]?.bold })} title="Bold" aria-label="Bold" className="rounded-lg p-2 theme-text-secondary hover:bg-[var(--bg-hover)]"><Bold className="h-4 w-4" /></button>
                <button type="button" onClick={() => void applyCellFormatting({ italic: !activeSheet.cellStyles?.[`${selectedCell.row}:${selectedCell.column}`]?.italic })} title="Italic" aria-label="Italic" className="rounded-lg p-2 theme-text-secondary hover:bg-[var(--bg-hover)]"><Italic className="h-4 w-4" /></button>
                <button type="button" onClick={() => void applyCellFormatting({ underline: !activeSheet.cellStyles?.[`${selectedCell.row}:${selectedCell.column}`]?.underline })} title="Underline" aria-label="Underline" className="rounded-lg p-2 theme-text-secondary hover:bg-[var(--bg-hover)]"><Underline className="h-4 w-4" /></button>
                <button type="button" onClick={() => void applyCellFormatting({ horizontal: 'left' })} title="Align left" aria-label="Align left" className="rounded-lg p-2 theme-text-secondary hover:bg-[var(--bg-hover)]"><AlignLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => void applyCellFormatting({ horizontal: 'center' })} title="Align center" aria-label="Align center" className="rounded-lg p-2 theme-text-secondary hover:bg-[var(--bg-hover)]"><AlignCenter className="h-4 w-4" /></button>
                <button type="button" onClick={() => void applyCellFormatting({ horizontal: 'right' })} title="Align right" aria-label="Align right" className="rounded-lg p-2 theme-text-secondary hover:bg-[var(--bg-hover)]"><AlignRight className="h-4 w-4" /></button>
                <label className="flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] theme-text-muted" style={{ borderColor: 'var(--border-color)' }} title="Text color">
                  A<input aria-label="Text color" type="color" className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => void applyCellFormatting({ color: event.target.value })} />
                </label>
                <label className="flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] theme-text-muted" style={{ borderColor: 'var(--border-color)' }} title="Cell fill">
                  Fill<input aria-label="Cell fill color" type="color" className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => void applyCellFormatting({ backgroundColor: event.target.value })} />
                </label>
                <select aria-label="Font size" className="h-9 rounded-lg border px-2 text-xs theme-bg-card theme-text-secondary" style={{ borderColor: 'var(--border-color)' }} defaultValue="14" onChange={(event) => void applyCellFormatting({ fontSize: Number(event.target.value) })}>
                  {[10, 11, 12, 14, 16, 18, 24, 32].map((size) => <option key={size} value={size}>{size}px</option>)}
                </select>
                <button type="button" onClick={() => void applyCellFormatting({ wrap: !activeSheet.cellStyles?.[`${selectedCell.row}:${selectedCell.column}`]?.wrap })} title="Toggle text wrap" className="btn-secondary h-9">Wrap</button>
                <button type="button" onClick={() => void applyCellFormatting({ border: 'thin' })} title="Add cell borders" className="btn-secondary h-9">Borders</button>
                <select aria-label="Number format" className="h-9 rounded-lg border px-2 text-xs theme-bg-card theme-text-secondary" style={{ borderColor: 'var(--border-color)' }} defaultValue="general" onChange={(event) => void applyCellFormatting({ numberFormat: event.target.value as CellStyle['numberFormat'] })}>
                  <option value="general">General</option><option value="number">Number</option><option value="currency">Currency</option><option value="percentage">Percent</option><option value="date">Date</option>
                </select>
                <button type="button" onClick={() => void transformGrid('row', 'insert')} className="btn-secondary h-9"><Plus className="h-4 w-4" />Insert row</button>
                <button type="button" onClick={() => void transformGrid('column', 'insert')} className="btn-secondary h-9"><Plus className="h-4 w-4" />Insert column</button>
                <button type="button" onClick={() => void transformGrid('row', 'delete')} className="btn-secondary h-9" title="Delete selected row"><Trash2 className="h-3.5 w-3.5" />Row</button>
                <button type="button" onClick={() => void transformGrid('column', 'delete')} className="btn-secondary h-9" title="Delete selected column"><Trash2 className="h-3.5 w-3.5" />Column</button>
                <button type="button" onClick={() => void setHiddenDimension('hiddenRows', true)} className="btn-secondary h-9">Hide rows</button>
                <button type="button" onClick={() => void setHiddenDimension('hiddenColumns', true)} className="btn-secondary h-9">Hide columns</button>
                {((activeSheet.hiddenRows?.length ?? 0) > 0 || (activeSheet.hiddenColumns?.length ?? 0) > 0) &&
                  <button type="button" onClick={async () => {
                    if (!activeWorkbook) return;
                    try {
                      const response = await api.patch(`/sheets/workbooks/${activeWorkbook._id}/sheets/${activeSheet._id}`, { hiddenRows: [], hiddenColumns: [] });
                      applyWorkbook(response.data.workbook as Workbook);
                    } catch {
                      setError('Hidden rows and columns could not be shown.');
                    }
                  }} className="btn-secondary h-9">Unhide all</button>
                }
                <button type="button" onClick={() => void setFreeze('frozenRows')} className="btn-secondary h-9">Freeze rows</button>
                <button type="button" onClick={() => void setFreeze('frozenColumns')} className="btn-secondary h-9">Freeze columns</button>
                <button type="button" onClick={() => void applyValidation('list')} className="btn-secondary h-9"><ChevronDown className="h-4 w-4" />Dropdown</button>
                <button type="button" onClick={() => void applyValidation('checkbox')} className="btn-secondary h-9"><CheckSquare className="h-4 w-4" />Checkbox</button>
                <button type="button" onClick={() => void addConditionalFormat()} className="btn-secondary h-9">Conditional format</button>
                <button type="button" onClick={saveNote} className="btn-secondary h-9">Note</button>
                <button type="button" onClick={() => setShowChart((current) => !current)} className="btn-secondary h-9"><BarChart3 className="h-4 w-4" />Chart</button>
              </div>

              <div className="flex items-center gap-2 border-b px-3 py-2 sm:px-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
                <span className="flex h-8 min-w-12 items-center justify-center rounded-md border bg-white px-2 font-mono text-xs font-semibold theme-text-secondary" style={{ borderColor: 'var(--border-color)' }}>
                  {columnName(selectedCell.column)}{selectedCell.row + 1}
                </span>
                <span aria-hidden="true" className="font-serif text-sm italic theme-text-muted">fx</span>
                <input
                  ref={formulaInputRef}
                  aria-label="Formula bar"
                  value={formulaBarValue}
                  onFocus={() => {
                    setShowFormulaSuggestions(true);
                    formulaReferenceMode.current = formulaBarValue.startsWith('=');
                    formulaReferenceSpan.current = null;
                    editingCell.current = true;
                    historyEditKey.current = '';
                  }}
                  onBlur={() => window.setTimeout(() => {
                    setShowFormulaSuggestions(false);
                    if (document.activeElement !== gridRef.current) {
                      formulaReferenceMode.current = false;
                      editingCell.current = false;
                      historyEditKey.current = '';
                    }
                  }, 150)}
                  onChange={(event) => {
                    editingCell.current = true;
                    setFormulaBarValue(event.target.value);
                    formulaReferenceMode.current = event.target.value.startsWith('=');
                    formulaReferenceSpan.current = null;
                    updateCell(selectedCell.row, selectedCell.column, event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === 'Tab') {
                      event.preventDefault();
                      setShowFormulaSuggestions(false);
                      formulaReferenceMode.current = false;
                      moveSelection(
                        selectedCell.row + (event.key === 'Enter' ? (event.shiftKey ? -1 : 1) : 0),
                        selectedCell.column + (event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0),
                      );
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setShowFormulaSuggestions(false);
                      formulaReferenceMode.current = false;
                      setFormulaBarValue(activeSheet.data[selectedCell.row]?.[selectedCell.column] ?? '');
                    }
                    if (event.key === 'ArrowDown' && showFormulaSuggestions && formulaSuggestions.length) {
                      event.preventDefault();
                      const name = formulaSuggestions[0];
                      const nextValue = formulaBarValue.replace(/[A-Z_]*$/i, `${name}(`);
                      setFormulaBarValue(nextValue);
                      updateCell(selectedCell.row, selectedCell.column, nextValue);
                    }
                  }}
                  className="input-field h-8 flex-1 rounded-md bg-white text-sm"
                  placeholder="Enter a value or formula"
                />
                <span className="hidden max-w-64 truncate text-xs text-rose-600 md:block" role="status">
                  {String(formulaCellValue(selectedCell.row, selectedCell.column)).startsWith('#') ? String(formulaCellValue(selectedCell.row, selectedCell.column)) : ''}
                </span>
                {showFormulaSuggestions && formulaSuggestions.length > 0 && (
                  <div className="absolute left-28 top-full z-30 mt-1 max-h-56 w-64 overflow-auto rounded-xl border p-1.5 shadow-lg theme-bg-card" style={{ borderColor: 'var(--border-color)' }}>
                    {formulaSuggestions.map((name) => (
                      <button key={name} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        const nextValue = formulaBarValue.replace(/[A-Z_]*$/i, `${name}(`);
                        setFormulaBarValue(nextValue);
                        updateCell(selectedCell.row, selectedCell.column, nextValue);
                        setShowFormulaSuggestions(false);
                      }} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs theme-text-secondary hover:bg-[var(--bg-hover)]">
                        <span className="font-mono font-semibold text-[var(--accent-text)]">{name}</span><span>Insert function</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {showChart && (
                <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-xs theme-text-secondary">Create chart from {selectedRangeValue}</span>
                  <select value={chartType} onChange={(event) => setChartType(event.target.value as SheetChart['type'])} aria-label="Chart type" className="input-field h-9 w-auto">
                    <option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option>
                  </select>
                  <button type="button" onClick={() => void createChart()} className="btn-primary h-9">Add chart</button>
                </div>
              )}
              {(activeSheet.charts ?? []).length > 0 && (
                <div className="grid gap-4 border-b p-4 sm:grid-cols-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  {activeSheet.charts?.map((chart, chartIndex) => {
                    const data = chartRows(activeSheet, chart, formulaValues);
                    const keys = data.length ? Object.keys(data[0]).filter((key) => key !== 'name') : [];
                    return (
                      <div key={`${chart.range}:${chartIndex}`} className="h-64 rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="mb-2 text-sm font-semibold theme-text-primary">{chart.title}</h3>
                        <ResponsiveContainer width="100%" height="90%">
                          {chart.type === 'line'
                            ? <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip />{keys.map((key, index) => <Line key={key} type="monotone" dataKey={key} stroke={['#4f46e5', '#0ea5e9', '#f97316'][index % 3]} />)}</LineChart>
                            : chart.type === 'pie'
                              ? <PieChart><Tooltip /><Pie data={data} dataKey={keys[0] ?? ''} nameKey="name" outerRadius={80}>{data.map((_, index) => <ChartCell key={index} fill={['#4f46e5', '#0ea5e9', '#f97316', '#10b981'][index % 4]} />)}</Pie></PieChart>
                              : <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip />{keys.map((key, index) => <Bar key={key} dataKey={key} fill={['#4f46e5', '#0ea5e9', '#f97316'][index % 3]} />)}</BarChart>}
                        </ResponsiveContainer>
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                ref={gridRef}
                className="max-h-[calc(100dvh-22rem)] min-h-[22rem] overflow-auto"
                role="region"
                aria-label={`${activeSheet.title} spreadsheet grid`}
                tabIndex={0}
                onKeyDown={(event) => void gridClipboardKeyDown(event)}
                onPointerMove={(event) => {
                  if (fillPointerId.current !== event.pointerId) return;
                  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-grid-cell]');
                  const coordinates = target?.dataset.gridCell?.split(':').map(Number);
                  if (coordinates?.length === 2) setFillTarget({ row: coordinates[0], column: coordinates[1] });
                }}
                onPointerUp={(event) => {
                  if (fillPointerId.current !== event.pointerId) return;
                  const target = fillTarget ?? { row: selectedCell.row, column: selectedCell.column };
                  fillSelectionTo(target.row, target.column);
                }}
                onPointerCancel={() => {
                  fillPointerId.current = null;
                  fillSource.current = null;
                  setFillTarget(null);
                }}
                onScroll={(event) => {
                  const scrollTop = event.currentTarget.scrollTop;
                  const viewportRows = Math.ceil(event.currentTarget.clientHeight / 36);
                  const start = Math.max(0, Math.floor(scrollTop / 36) - 8);
                  setVirtualRows({ start, end: Math.min(visibleRows.length, start + viewportRows + 16) });
                }}
              >
                <table className="border-separate border-spacing-0 text-sm" style={{ minWidth: '100%', zoom: zoom / 100 }}>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="sticky left-0 z-20 h-9 min-w-12 border-b border-r p-0 text-center text-[11px] font-medium theme-text-muted" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                        <button type="button" aria-label="Select all cells" title="Select all cells" onClick={() => {
                          selectionAnchor.current = { row: 0, column: 0 };
                          setSelectedCell({ row: 0, column: 0 });
                          setSelection({ startRow: 0, startColumn: 0, endRow: activeSheet.rowCount - 1, endColumn: activeSheet.columnCount - 1 });
                          focusCell(0, 0);
                        }} className="h-full w-full hover:bg-[var(--bg-hover)]">#</button>
                      </th>
                      {visibleColumns.map((column) => (
                        <th key={column} onContextMenu={(event) => {
                          event.preventDefault();
                          setSelectedCell({ row: 0, column });
                          selectionAnchor.current = { row: 0, column };
                          setSelection({ startRow: 0, startColumn: column, endRow: activeSheet.rowCount - 1, endColumn: column });
                          setGridContext({ x: event.clientX, y: event.clientY, axis: 'column', row: 0, column });
                        }} className="relative h-9 border-b border-r p-0 text-center font-medium" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)', width: columnWidths[column] ?? 112, minWidth: columnWidths[column] ?? 112, position: column < (activeSheet.frozenColumns ?? 0) ? 'sticky' : undefined, left: column < (activeSheet.frozenColumns ?? 0) ? 48 + Array.from({ length: column }, (_, index) => columnWidths[index] ?? 112).reduce((sum, width) => sum + width, 0) : undefined, zIndex: column < (activeSheet.frozenColumns ?? 0) ? 15 : undefined }}>
                          <button type="button" onClick={(event) => {
                            const anchor = event.shiftKey ? selectionAnchor.current : { row: 0, column };
                            setSelectedCell({ row: 0, column });
                            setSelection({
                              startRow: 0,
                              startColumn: Math.min(anchor.column, column),
                              endRow: activeSheet.rowCount - 1,
                              endColumn: Math.max(anchor.column, column),
                            });
                            if (!event.shiftKey) selectionAnchor.current = { row: 0, column };
                            focusCell(0, column);
                          }} className={`h-full w-full px-3 text-xs ${selectedCell.column === column ? 'font-semibold text-[var(--accent-text)]' : 'theme-text-secondary'}`}>
                            {columnName(column)}
                          </button>
                          <button type="button" aria-label={`Resize column ${columnName(column)}`} onPointerDown={(event) => resizeColumn(column, event)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none hover:bg-[var(--accent)]/30" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {virtualRows.start > 0 && <tr><td colSpan={visibleColumns.length + 1} style={{ height: virtualRows.start * 36, padding: 0, border: 0 }} /></tr>}
                    {visibleRows.slice(virtualRows.start, virtualRows.end).map((row) => (
                      <tr key={row}>
                        <th onContextMenu={(event) => {
                          event.preventDefault();
                          setSelectedCell({ row, column: 0 });
                          selectionAnchor.current = { row, column: 0 };
                          setSelection({ startRow: row, startColumn: 0, endRow: row, endColumn: activeSheet.columnCount - 1 });
                          setGridContext({ x: event.clientX, y: event.clientY, axis: 'row', row, column: 0 });
                        }} className="sticky left-0 z-[1] h-9 min-w-12 border-b border-r p-0 text-center text-[11px] font-normal theme-text-muted" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)', position: row < (activeSheet.frozenRows ?? 0) ? 'sticky' : undefined, top: row < (activeSheet.frozenRows ?? 0) ? 36 + row * 36 : undefined, zIndex: row < (activeSheet.frozenRows ?? 0) ? 14 : undefined }}>
                          <button type="button" aria-label={`Select row ${row + 1}`} onClick={(event) => {
                            const anchor = event.shiftKey ? selectionAnchor.current : { row, column: 0 };
                            setSelectedCell({ row, column: 0 });
                            setSelection({
                              startRow: Math.min(anchor.row, row),
                              startColumn: 0,
                              endRow: Math.max(anchor.row, row),
                              endColumn: activeSheet.columnCount - 1,
                            });
                            if (!event.shiftKey) selectionAnchor.current = { row, column: 0 };
                            focusCell(row, 0);
                          }} className="h-full w-full hover:bg-[var(--bg-hover)]">{row + 1}</button>
                        </th>
                        {visibleColumns.map((column) => {
                          const selected = row >= Math.min(selection.startRow, selection.endRow) && row <= Math.max(selection.startRow, selection.endRow) &&
                            column >= Math.min(selection.startColumn, selection.endColumn) && column <= Math.max(selection.startColumn, selection.endColumn);
                          const fillSelected = fillTarget && row >= Math.min(selection.startRow, fillTarget.row) && row <= Math.max(selection.endRow, fillTarget.row) &&
                            column >= Math.min(selection.startColumn, fillTarget.column) && column <= Math.max(selection.endColumn, fillTarget.column);
                          const style = activeSheet.cellStyles?.[`${row}:${column}`] ?? {};
                          const conditional = conditionalStyle(row, column);
                          const validation = activeSheet.validations?.find((rule) => {
                            const range = parseRange(rule.range);
                            return range && row >= range.startRow && row <= range.endRow && column >= range.startColumn && column <= range.endColumn;
                          });
                          const rawValue = activeSheet.data[row]?.[column] ?? '';
                          const displayValue = row === selectedCell.row && column === selectedCell.column && rawValue.startsWith('=')
                            ? rawValue
                            : formattedCell(formulaCellValue(row, column), style.numberFormat);
                          const leftOffset = column < (activeSheet.frozenColumns ?? 0)
                            ? 48 + Array.from({ length: column }, (_, index) => columnWidths[index] ?? 112).reduce((sum, width) => sum + width, 0)
                            : undefined;
                          const cellStyle: React.CSSProperties = {
                            color: conditional.color ?? style.color,
                            backgroundColor: conditional.backgroundColor ?? (selected || fillSelected ? 'var(--accent-subtle)' : style.backgroundColor),
                            fontWeight: style.bold ? 700 : undefined,
                            fontStyle: style.italic ? 'italic' : undefined,
                            fontSize: style.fontSize,
                            textDecoration: style.underline ? 'underline' : undefined,
                            textAlign: style.horizontal ?? 'left',
                            whiteSpace: style.wrap ? 'pre-wrap' : 'nowrap',
                            borderWidth: style.border === 'medium' ? 2 : style.border === 'thin' ? 1 : undefined,
                            position: column < (activeSheet.frozenColumns ?? 0) ? 'sticky' : undefined,
                            left: leftOffset,
                            zIndex: column < (activeSheet.frozenColumns ?? 0) ? 5 : undefined,
                          };
                          return (
                            <td key={column} onContextMenu={(event) => {
                              event.preventDefault();
                              setSelectedCell({ row, column });
                              selectionAnchor.current = { row, column };
                              setSelection({ startRow: row, startColumn: column, endRow: row, endColumn: column });
                              setGridContext({ x: event.clientX, y: event.clientY, axis: 'cell', row, column });
                            }} className={`relative h-9 border-b border-r p-0 ${selected && row === selectedCell.row && column === selectedCell.column ? 'z-[3] outline outline-2 outline-[var(--accent)] outline-offset-[-2px]' : ''}`} title={activeSheet.notes?.[`${row}:${column}`]} style={{ borderColor: 'var(--border-subtle)', width: columnWidths[column] ?? 112, minWidth: columnWidths[column] ?? 112, ...cellStyle }}>
                              {validation?.type === 'list' ? (
                                <select data-grid-cell={`${row}:${column}`} aria-label={`Cell ${columnName(column)}${row + 1}`} value={rawValue} onFocus={() => setSelectedCell({ row, column })} onChange={(event) => updateCell(row, column, event.target.value)} className="h-full w-full border-0 bg-transparent px-2 text-sm outline-none" style={cellStyle}>
                                  <option value="" />
                                  {validation.options.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              ) : validation?.type === 'checkbox' ? (
                                <input data-grid-cell={`${row}:${column}`} type="checkbox" aria-label={`Cell ${columnName(column)}${row + 1}`} checked={rawValue === 'TRUE'} onFocus={() => { setSelectedCell({ row, column }); editingCell.current = false; }} onChange={(event) => updateCell(row, column, event.target.checked ? 'TRUE' : 'FALSE')} className="ml-3 h-4 w-4 accent-[var(--accent)]" />
                              ) : (
                                <input
                                  data-grid-cell={`${row}:${column}`}
                                  aria-label={`Cell ${columnName(column)}${row + 1}`}
                                  value={displayValue}
                                  onMouseDown={(event) => {
                                    if (formulaReferenceMode.current) {
                                      event.preventDefault();
                                      insertFormulaReference(row, column, event.shiftKey);
                                      return;
                                    }
                                    const nextSelection: Selection = event.shiftKey
                                      ? { startRow: selectionAnchor.current.row, startColumn: selectionAnchor.current.column, endRow: row, endColumn: column }
                                      : { startRow: row, startColumn: column, endRow: row, endColumn: column };
                                    if (!event.shiftKey) selectionAnchor.current = { row, column };
                                    setSelection(nextSelection);
                                  }}
                                  onFocus={() => {
                                    setSelectedCell({ row, column });
                                    setFormulaBarValue(rawValue);
                                    formulaReferenceMode.current = false;
                                    formulaReferenceSpan.current = null;
                                    editingCell.current = false;
                                  }}
                                  onChange={(event) => {
                                    editingCell.current = true;
                                    setFormulaBarValue(event.target.value);
                                    formulaReferenceMode.current = event.target.value.startsWith('=');
                                    formulaReferenceSpan.current = null;
                                    updateCell(row, column, event.target.value);
                                  }}
                                  onDoubleClick={() => { editingCell.current = true; }}
                                  onPaste={(event) => {
                                    event.preventDefault();
                                    applyPaste(event.clipboardData.getData('text'));
                                  }}
                                  onKeyDown={(event) => handleCellKeyDown(event, row, column)}
                                  className="h-full w-full border-0 bg-transparent px-2 text-sm outline-none focus:relative focus:z-[2] focus:ring-2 focus:ring-inset focus:ring-[var(--border-focus)]"
                                  style={cellStyle}
                                />
                              )}
                              {selection.startRow <= selection.endRow && selection.startColumn <= selection.endColumn &&
                                row === Math.max(selection.startRow, selection.endRow) &&
                                column === Math.max(selection.startColumn, selection.endColumn) &&
                                <button type="button" aria-label="Drag to fill selected cells" title="Drag to fill" onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  fillSource.current = { ...selection };
                                  fillPointerId.current = event.pointerId;
                                  setFillTarget({ row: selectedCell.row, column: selectedCell.column });
                                  event.currentTarget.setPointerCapture(event.pointerId);
                                }} className="absolute -bottom-1 -right-1 z-10 h-2.5 w-2.5 cursor-crosshair border border-white bg-[var(--accent)] shadow-sm" />
                              }
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {virtualRows.end < visibleRows.length && <tr><td colSpan={visibleColumns.length + 1} style={{ height: (visibleRows.length - virtualRows.end) * 36, padding: 0, border: 0 }} /></tr>}
                    {visibleRows.length === 0 && (
                      <tr><td colSpan={visibleColumns.length + 1} className="py-12 text-center text-sm theme-text-muted">No rows match your search or filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {gridContext && (
                <div className="fixed inset-0 z-40" onMouseDown={() => setGridContext(null)}>
                  <div role="menu" aria-label="Cell actions" className="fixed z-50 min-w-48 rounded-xl border p-1.5 shadow-xl theme-bg-card" style={{ left: Math.min(gridContext.x, window.innerWidth - 220), top: Math.min(gridContext.y, window.innerHeight - 250), borderColor: 'var(--border-color)' }} onMouseDown={(event) => event.stopPropagation()}>
                    <button type="button" role="menuitem" onClick={() => { void transformGrid('row', 'insert', gridContext.row); setGridContext(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs theme-text-secondary hover:bg-[var(--bg-hover)]">Insert row above</button>
                    <button type="button" role="menuitem" onClick={() => { void transformGrid('column', 'insert', gridContext.column); setGridContext(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs theme-text-secondary hover:bg-[var(--bg-hover)]">Insert column left</button>
                    <button type="button" role="menuitem" onClick={() => { void transformGrid(gridContext.axis === 'column' ? 'column' : 'row', 'delete', gridContext.axis === 'column' ? gridContext.column : gridContext.row); setGridContext(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50">Delete {gridContext.axis === 'column' ? 'column' : 'row'}</button>
                    <button type="button" role="menuitem" onClick={() => { void saveNote(); setGridContext(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs theme-text-secondary hover:bg-[var(--bg-hover)]">Add or edit note</button>
                  </div>
                </div>
              )}

              <div className="flex min-h-12 items-center justify-between border-t px-3 sm:px-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                  {activeWorkbook.sheets.map((sheet) => (
                    <button key={sheet._id} type="button" onClick={() => void selectSheet(sheet._id)} className={`flex min-h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-medium transition ${sheet._id === activeSheet._id ? 'border-[var(--accent)] text-[var(--accent-text)]' : 'border-transparent theme-text-secondary hover:bg-[var(--bg-hover)]'}`}>
                      <Sheet className="h-3.5 w-3.5" />{sheet.title}
                    </button>
                  ))}
                  <button type="button" onClick={() => void addSheet()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg theme-text-muted transition hover:bg-[var(--bg-hover)] hover:theme-text-primary" aria-label="Add sheet" title="Add sheet"><Plus className="h-4 w-4" /></button>
                </div>
                <details className="relative shrink-0">
                  <summary aria-label="Sheet options" className="list-none cursor-pointer rounded-lg p-2 theme-text-muted hover:bg-[var(--bg-hover)]"><MoreHorizontal className="h-4 w-4" /></summary>
                  <div className="absolute bottom-full right-0 z-30 mb-2 min-w-44 rounded-xl border p-1.5 shadow-lg theme-bg-card" style={{ borderColor: 'var(--border-color)' }}>
                    <button type="button" onClick={() => void renameSheet()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs theme-text-secondary hover:bg-[var(--bg-hover)]">Rename sheet</button>
                    <button type="button" onClick={() => void duplicateSheet()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs theme-text-secondary hover:bg-[var(--bg-hover)]"><Copy className="h-3.5 w-3.5" />Duplicate sheet</button>
                    <button type="button" onClick={() => void deleteSheet()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Delete sheet</button>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <div className="flex min-h-80 items-center justify-center text-sm theme-text-muted">This workbook has no available sheets.</div>
          )}
        </section>
      )}
    </div>
  );
}
