import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Workbook, { IWorkbook, IWorkbookSheet } from '../models/Workbook';

const MAX_TITLE_LENGTH = 120;
const MAX_CELL_LENGTH = 10_000;
const MAX_BATCH_UPDATES = 1_000;
const MAX_SHEETS = 100;
const MAX_WORKBOOK_CELLS = 500_000;
const MAX_WORKBOOK_DATA_BYTES = 8 * 1024 * 1024;
const MAX_STYLE_UPDATES = 1_000;

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function badRequest(message: string): never {
  throw new RequestError(400, message);
}

function getUserScope(req: AuthRequest): { companyId: string; creatorId: string } {
  const companyId = req.user?.companyId;
  const creatorId = req.user?.userId;
  if (!companyId || !creatorId) {
    throw new RequestError(403, 'Company membership is required.');
  }
  return { companyId, creatorId };
}

function requireObjectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    badRequest('A JSON object is required.');
  }
  return body as Record<string, unknown>;
}

function optionalObjectBody(body: unknown): Record<string, unknown> {
  return body === undefined ? {} : requireObjectBody(body);
}

function validateTitle(value: unknown, field: string): string {
  if (typeof value !== 'string') badRequest(`${field} must be a string.`);
  const title = value.trim();
  if (!title) badRequest(`${field} cannot be empty.`);
  if (title.length > MAX_TITLE_LENGTH) badRequest(`${field} cannot exceed ${MAX_TITLE_LENGTH} characters.`);
  return title;
}

function validateDimension(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    badRequest(`${field} must be an integer between 1 and ${max}.`);
  }
  return value;
}

function validateCell(value: unknown, field = 'Cell value'): string {
  if (typeof value !== 'string') badRequest(`${field} must be a string.`);
  if (value.length > MAX_CELL_LENGTH) badRequest(`${field} cannot exceed ${MAX_CELL_LENGTH} characters.`);
  return value;
}

function validateCellStyles(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) badRequest('style must be an object.');
  const input = value as Record<string, unknown>;
  const allowed = new Set(['bold', 'italic', 'underline', 'fontSize', 'color', 'backgroundColor', 'horizontal', 'vertical', 'wrap', 'numberFormat', 'border']);
  const result: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(input)) {
    if (!allowed.has(key)) badRequest(`Unsupported cell style: ${key}.`);
    if (key === 'bold' || key === 'italic' || key === 'underline' || key === 'wrap') {
      if (typeof entry !== 'boolean') badRequest(`${key} must be a boolean.`);
      result[key] = entry;
    } else if (key === 'fontSize') {
      if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 8 || entry > 48) badRequest('fontSize must be an integer from 8 to 48.');
      result[key] = entry;
    } else if (key === 'color' || key === 'backgroundColor') {
      if (typeof entry !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(entry)) badRequest(`${key} must be a six-digit hex color.`);
      result[key] = entry;
    } else if (key === 'horizontal') {
      if (!['left', 'center', 'right'].includes(String(entry))) badRequest('horizontal alignment is invalid.');
      result[key] = String(entry);
    } else if (key === 'vertical') {
      if (!['top', 'middle', 'bottom'].includes(String(entry))) badRequest('vertical alignment is invalid.');
      result[key] = String(entry);
    } else if (key === 'numberFormat') {
      if (!['general', 'number', 'currency', 'percentage', 'date'].includes(String(entry))) badRequest('numberFormat is invalid.');
      result[key] = String(entry);
    } else if (key === 'border') {
      if (!['none', 'thin', 'medium'].includes(String(entry))) badRequest('border is invalid.');
      result[key] = String(entry);
    }
  }
  return result;
}

function validateRange(value: unknown): string {
  if (typeof value !== 'string' || value.length > 32 ||
      !/^\$?[A-Z]{1,3}\$?[1-9]\d{0,2}(?::\$?[A-Z]{1,3}\$?[1-9]\d{0,2})?$/i.test(value)) {
    badRequest('range must be a valid cell or cell range, such as A1:B8.');
  }
  return value.toUpperCase();
}

function validateRangeBounds(range: string, rowCount: number, columnCount: number): void {
  const references = range.match(/\$?[A-Z]{1,3}\$?[1-9]\d*/g) ?? [];
  for (const reference of references) {
    const clean = reference.replace(/\$/g, '');
    const letters = clean.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? '';
    const row = Number(clean.match(/\d+$/)?.[0] ?? '0');
    let column = 0;
    for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
    if (row > rowCount || column > columnCount) badRequest(`Range ${range} is outside the sheet dimensions.`);
  }
}

function blankGrid(rowCount: number, columnCount: number): string[][] {
  return Array.from({ length: rowCount }, () => Array<string>(columnCount).fill(''));
}

function assertWorkbookSize(workbook: IWorkbook): void {
  const data = workbook.sheets.map((sheet) => ({
    title: sheet.title,
    data: sheet.data,
    cellStyles: sheet.cellStyles,
    validations: sheet.validations,
    notes: sheet.notes,
    conditionalFormats: sheet.conditionalFormats,
    charts: sheet.charts,
  }));
  const cellCount = workbook.sheets.reduce(
    (total, sheet) => total + sheet.data.reduce((rows, row) => rows + row.length, 0),
    0,
  );
  if (cellCount > MAX_WORKBOOK_CELLS) {
    badRequest(`A workbook cannot contain more than ${MAX_WORKBOOK_CELLS} cells.`);
  }
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_WORKBOOK_DATA_BYTES) {
    badRequest('Workbook data exceeds the maximum supported size.');
  }
}

async function findWorkbook(req: AuthRequest): Promise<IWorkbook> {
  const { companyId, creatorId } = getUserScope(req);
  const workbook = await Workbook.findOne({
    _id: req.params.workbookId,
    companyId,
    creatorId,
    isArchived: false,
  });
  if (!workbook) throw new RequestError(404, 'Workbook not found.');
  return workbook;
}

function findSheet(workbook: IWorkbook, sheetId: string): IWorkbookSheet {
  const sheet = workbook.sheets.find((candidate) => candidate._id.toString() === sheetId);
  if (!sheet) throw new RequestError(404, 'Sheet not found.');
  return sheet;
}

function validateGrid(value: unknown): { data: string[][]; rowCount: number; columnCount: number } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) {
    badRequest('data must contain between 1 and 500 rows.');
  }

  let columnCount = 0;
  const rows = value.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length > 100) {
      badRequest(`Row ${rowIndex} must be an array with no more than 100 columns.`);
    }
    columnCount = Math.max(columnCount, row.length);
    return row.map((cell, columnIndex) =>
      validateCell(cell, `Cell at row ${rowIndex}, column ${columnIndex}`));
  });
  if (columnCount < 1) badRequest('data must contain at least one column.');

  const data = rows.map((row) => [
    ...row,
    ...Array<string>(columnCount - row.length).fill(''),
  ]);
  return { data, rowCount: data.length, columnCount };
}

function resizeGrid(
  current: string[][],
  oldColumnCount: number,
  rowCount: number,
  columnCount: number,
): string[][] {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const oldRow = current[rowIndex] || [];
    return Array.from({ length: columnCount }, (_, columnIndex) =>
      columnIndex < oldColumnCount ? (oldRow[columnIndex] ?? '') : '');
  });
}

function sendError(error: unknown, next: (error?: unknown) => void): void {
  if (error instanceof RequestError) {
    next(error);
    return;
  }
  next(error);
}

export const getWorkbooks = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const { companyId, creatorId } = getUserScope(req);
    const workbooks = await Workbook.find({ companyId, creatorId, isArchived: false }).sort({ updatedAt: -1 });
    res.json({ success: true, workbooks });
  } catch (error) {
    sendError(error, next);
  }
};

export const createWorkbook = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const body = optionalObjectBody(req.body);
    const unknownFields = Object.keys(body).filter((key) => key !== 'title');
    if (unknownFields.length) badRequest(`Unsupported field: ${unknownFields[0]}.`);
    const title = body.title === undefined ? 'Untitled workbook' : validateTitle(body.title, 'title');
    const { companyId, creatorId } = getUserScope(req);
    const workbook = await Workbook.create({
      companyId,
      creatorId,
      title,
      sheets: [{
        title: 'Sheet 1',
        rowCount: 100,
        columnCount: 26,
        data: blankGrid(100, 26),
      }],
    });
    res.status(201).json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};

export const getWorkbook = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const workbook = await findWorkbook(req);
    res.json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};

export const updateWorkbook = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const body = requireObjectBody(req.body);
    const fields = Object.keys(body);
    if (fields.length !== 1 || fields[0] !== 'title') badRequest('Only the title field can be updated.');
    const workbook = await findWorkbook(req);
    workbook.title = validateTitle(body.title, 'title');
    await workbook.save();
    res.json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};

export const deleteWorkbook = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const workbook = await findWorkbook(req);
    workbook.isArchived = true;
    await workbook.save();
    res.json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};

export const createSheet = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const body = optionalObjectBody(req.body);
    const unknownFields = Object.keys(body).filter((key) => key !== 'title');
    if (unknownFields.length) badRequest(`Unsupported field: ${unknownFields[0]}.`);
    const workbook = await findWorkbook(req);
    if (workbook.sheets.length >= MAX_SHEETS) badRequest(`A workbook cannot contain more than ${MAX_SHEETS} sheets.`);
    const title = body.title === undefined
      ? `Sheet ${workbook.sheets.length + 1}`
      : validateTitle(body.title, 'title');
    workbook.sheets.push({
      title,
      rowCount: 100,
      columnCount: 26,
      data: blankGrid(100, 26),
    } as IWorkbookSheet);
    assertWorkbookSize(workbook);
    await workbook.save();
    res.status(201).json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};

export const updateSheet = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const body = requireObjectBody(req.body);
    const allowed = new Set(['title', 'rowCount', 'columnCount', 'frozenRows', 'frozenColumns', 'hiddenRows', 'hiddenColumns', 'cellStyles', 'validations', 'notes', 'conditionalFormats', 'charts']);
    const unknownField = Object.keys(body).find((key) => !allowed.has(key));
    if (unknownField) badRequest(`Unsupported field: ${unknownField}.`);
    if (!Object.keys(body).length) badRequest('At least one sheet field must be provided.');

    const workbook = await findWorkbook(req);
    const sheet = findSheet(workbook, req.params.sheetId);
    if (body.title !== undefined) sheet.title = validateTitle(body.title, 'title');
    const rowCount = body.rowCount === undefined
      ? sheet.rowCount
      : validateDimension(body.rowCount, 'rowCount', 500);
    const columnCount = body.columnCount === undefined
      ? sheet.columnCount
      : validateDimension(body.columnCount, 'columnCount', 100);
    if (body.rowCount !== undefined || body.columnCount !== undefined) {
      sheet.data = resizeGrid(sheet.data, sheet.columnCount, rowCount, columnCount);
      const maxCellKey = (key: string) => {
        const [row, column] = key.split(':').map(Number);
        return row < rowCount && column < columnCount;
      };
      const styles = sheet.cellStyles;
      for (const key of styles.keys()) if (!maxCellKey(key)) styles.delete(key);
      sheet.cellStyles = styles;
      sheet.hiddenRows = sheet.hiddenRows.filter((row) => row < rowCount);
      sheet.hiddenColumns = sheet.hiddenColumns.filter((column) => column < columnCount);
      sheet.rowCount = rowCount;
      sheet.columnCount = columnCount;
      assertWorkbookSize(workbook);
    }
    if (body.frozenRows !== undefined) {
      if (typeof body.frozenRows !== 'number' || !Number.isInteger(body.frozenRows) || body.frozenRows < 0 || body.frozenRows > Math.min(25, sheet.rowCount)) {
        badRequest('frozenRows must be between 0 and 25 and within sheet bounds.');
      }
      sheet.frozenRows = body.frozenRows;
    }
    if (body.frozenColumns !== undefined) {
      if (typeof body.frozenColumns !== 'number' || !Number.isInteger(body.frozenColumns) || body.frozenColumns < 0 || body.frozenColumns > Math.min(10, sheet.columnCount)) {
        badRequest('frozenColumns must be between 0 and 10 and within sheet bounds.');
      }
      sheet.frozenColumns = body.frozenColumns;
    }
    if (body.hiddenRows !== undefined) {
      if (!Array.isArray(body.hiddenRows) || body.hiddenRows.length > sheet.rowCount ||
          body.hiddenRows.some((row) => typeof row !== 'number' || !Number.isInteger(row) || row < 0 || row >= sheet.rowCount)) {
        badRequest('hiddenRows must be an array of valid row indexes.');
      }
      sheet.hiddenRows = [...new Set(body.hiddenRows as number[])].sort((a, b) => a - b);
      if (sheet.hiddenRows.length >= sheet.rowCount) badRequest('At least one row must remain visible.');
    }
    if (body.hiddenColumns !== undefined) {
      if (!Array.isArray(body.hiddenColumns) || body.hiddenColumns.length > sheet.columnCount ||
          body.hiddenColumns.some((column) => typeof column !== 'number' || !Number.isInteger(column) || column < 0 || column >= sheet.columnCount)) {
        badRequest('hiddenColumns must be an array of valid column indexes.');
      }
      sheet.hiddenColumns = [...new Set(body.hiddenColumns as number[])].sort((a, b) => a - b);
      if (sheet.hiddenColumns.length >= sheet.columnCount) badRequest('At least one column must remain visible.');
    }
    if (body.cellStyles !== undefined) {
      if (!body.cellStyles || typeof body.cellStyles !== 'object' || Array.isArray(body.cellStyles) ||
          Object.keys(body.cellStyles).length > 5_000) badRequest('cellStyles must be an object with no more than 5,000 entries.');
      const styles = new Map<string, Record<string, string | number | boolean>>();
      for (const [key, value] of Object.entries(body.cellStyles as Record<string, unknown>)) {
        if (!/^\d+:\d+$/.test(key)) badRequest(`Cell style key ${key} is invalid.`);
        const [row, column] = key.split(':').map(Number);
        if (row >= rowCount || column >= columnCount) badRequest(`Cell style ${key} is outside the sheet dimensions.`);
        styles.set(key, validateCellStyles(value));
      }
      sheet.cellStyles = styles;
    }
    if (body.validations !== undefined) {
      if (!Array.isArray(body.validations) || body.validations.length > 100) badRequest('validations must be an array of at most 100 rules.');
      sheet.validations = body.validations.map((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) badRequest(`Validation ${index} must be an object.`);
        const item = raw as Record<string, unknown>;
        const range = validateRange(item.range);
        validateRangeBounds(range, sheet.rowCount, sheet.columnCount);
        if (item.type !== 'list' && item.type !== 'checkbox') badRequest(`Validation ${index} type is invalid.`);
        if (item.type === 'checkbox') return { range, type: 'checkbox' as const, options: [] };
        if (!Array.isArray(item.options) || item.options.length < 1 || item.options.length > 50 ||
            item.options.some((option) => typeof option !== 'string' || option.length > 80)) {
          badRequest(`Validation ${index} list needs 1–50 text options, each no longer than 80 characters.`);
        }
        return { range, type: 'list' as const, options: item.options as string[] };
      });
    }
    if (body.notes !== undefined) {
      if (!body.notes || typeof body.notes !== 'object' || Array.isArray(body.notes) ||
          Object.keys(body.notes).length > 500) badRequest('notes must be an object with at most 500 cell notes.');
      const noteMap = new Map<string, string>();
      for (const [key, value] of Object.entries(body.notes as Record<string, unknown>)) {
        if (!/^\d+:\d+$/.test(key) || typeof value !== 'string' || value.length > 2_000) badRequest(`Note for ${key} is invalid.`);
        const [row, column] = key.split(':').map(Number);
        if (row >= sheet.rowCount || column >= sheet.columnCount) badRequest(`Note for ${key} is outside the sheet.`);
        if (value) noteMap.set(key, value);
      }
      sheet.notes = noteMap;
    }
    if (body.conditionalFormats !== undefined) {
      if (!Array.isArray(body.conditionalFormats) || body.conditionalFormats.length > 50) badRequest('conditionalFormats must contain at most 50 rules.');
      sheet.conditionalFormats = body.conditionalFormats.map((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) badRequest(`Conditional format ${index} must be an object.`);
        const item = raw as Record<string, unknown>;
        if (!['greaterThan', 'lessThan', 'equalTo', 'textContains'].includes(String(item.condition))) badRequest(`Conditional format ${index} condition is invalid.`);
        if (typeof item.value !== 'string' || item.value.length > 100 ||
            typeof item.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(item.color) ||
            typeof item.backgroundColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(item.backgroundColor)) {
          badRequest(`Conditional format ${index} values or colors are invalid.`);
        }
        const range = validateRange(item.range);
        validateRangeBounds(range, sheet.rowCount, sheet.columnCount);
        return {
          range,
          condition: item.condition as IWorkbookSheet['conditionalFormats'][number]['condition'],
          value: item.value,
          color: item.color,
          backgroundColor: item.backgroundColor,
        };
      });
    }
    if (body.charts !== undefined) {
      if (!Array.isArray(body.charts) || body.charts.length > 20) badRequest('charts must contain at most 20 charts.');
      sheet.charts = body.charts.map((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) badRequest(`Chart ${index} must be an object.`);
        const item = raw as Record<string, unknown>;
        if (!['bar', 'line', 'pie'].includes(String(item.type))) badRequest(`Chart ${index} type is invalid.`);
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (title.length > 120) badRequest(`Chart ${index} title is too long.`);
        const range = validateRange(item.range);
        validateRangeBounds(range, sheet.rowCount, sheet.columnCount);
        return {
          title,
          type: item.type as IWorkbookSheet['charts'][number]['type'],
          range,
        };
      });
    }
    await workbook.save();
    res.json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};

export const deleteSheet = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const workbook = await findWorkbook(req);
    findSheet(workbook, req.params.sheetId);
    if (workbook.sheets.length <= 1) badRequest('A workbook must contain at least one sheet.');
    workbook.sheets.splice(workbook.sheets.findIndex((sheet) => sheet._id.toString() === req.params.sheetId), 1);
    await workbook.save();
    res.json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};

export const updateCells = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const body = requireObjectBody(req.body);
    if (Object.keys(body).length !== 1 || !Array.isArray(body.updates)) {
      badRequest('updates must be an array.');
    }
    if (body.updates.length < 1 || body.updates.length > MAX_BATCH_UPDATES) {
      badRequest(`updates must contain between 1 and ${MAX_BATCH_UPDATES} entries.`);
    }

    const validated = body.updates.map((update, index) => {
      if (!update || typeof update !== 'object' || Array.isArray(update)) {
        badRequest(`Update ${index} must be an object.`);
      }
      const entry = update as Record<string, unknown>;
      if (Object.keys(entry).some((key) => !['row', 'column', 'value'].includes(key))) {
        badRequest(`Update ${index} contains an unsupported field.`);
      }
      if (typeof entry.row !== 'number' || !Number.isInteger(entry.row) ||
          typeof entry.column !== 'number' || !Number.isInteger(entry.column)) {
        badRequest(`Update ${index} row and column must be integers.`);
      }
      return {
        row: entry.row,
        column: entry.column,
        value: validateCell(entry.value, `Update ${index} value`),
      };
    });

    const workbook = await findWorkbook(req);
    const sheet = findSheet(workbook, req.params.sheetId);
    for (const update of validated) {
      if (update.row < 0 || update.row >= sheet.rowCount || update.column < 0 || update.column >= sheet.columnCount) {
        badRequest(`Cell (${update.row}, ${update.column}) is outside the sheet dimensions.`);
      }
    }
    for (const update of validated) {
      sheet.data[update.row][update.column] = update.value;
    }
    assertWorkbookSize(workbook);
    await workbook.save();
    res.json({ success: true });
  } catch (error) {
    sendError(error, next);
  }
};

export const updateCellStyles = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const body = requireObjectBody(req.body);
    if (Object.keys(body).length !== 1 || !Array.isArray(body.updates) ||
        body.updates.length < 1 || body.updates.length > MAX_STYLE_UPDATES) {
      badRequest(`updates must contain between 1 and ${MAX_STYLE_UPDATES} entries.`);
    }
    const workbook = await findWorkbook(req);
    const sheet = findSheet(workbook, req.params.sheetId);
    const styleMap = sheet.cellStyles;
    for (const [index, raw] of body.updates.entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) badRequest(`Style update ${index} must be an object.`);
      const update = raw as Record<string, unknown>;
      if (Object.keys(update).some((key) => !['row', 'column', 'style'].includes(key)) ||
          typeof update.row !== 'number' || !Number.isInteger(update.row) ||
          typeof update.column !== 'number' || !Number.isInteger(update.column) ||
          update.row < 0 || update.row >= sheet.rowCount ||
          update.column < 0 || update.column >= sheet.columnCount) {
        badRequest(`Style update ${index} is outside the sheet dimensions or contains unsupported fields.`);
      }
      const key = `${update.row}:${update.column}`;
      if (update.style === null) styleMap.delete(key);
      else styleMap.set(key, validateCellStyles(update.style));
    }
    sheet.cellStyles = styleMap;
    await workbook.save();
    res.json({ success: true });
  } catch (error) {
    sendError(error, next);
  }
};

export const replaceSheetData = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const body = requireObjectBody(req.body);
    if (Object.keys(body).length !== 1 || !Object.prototype.hasOwnProperty.call(body, 'data')) {
      badRequest('Only the data field can be replaced.');
    }
    const grid = validateGrid(body.data);
    const workbook = await findWorkbook(req);
    const sheet = findSheet(workbook, req.params.sheetId);
    sheet.data = grid.data;
    sheet.rowCount = grid.rowCount;
    sheet.columnCount = grid.columnCount;
    sheet.hiddenRows = sheet.hiddenRows.filter((row) => row < grid.rowCount);
    sheet.hiddenColumns = sheet.hiddenColumns.filter((column) => column < grid.columnCount);
    sheet.frozenRows = Math.min(sheet.frozenRows, grid.rowCount, 25);
    sheet.frozenColumns = Math.min(sheet.frozenColumns, grid.columnCount, 10);
    for (const key of sheet.cellStyles.keys()) {
      const [row, column] = key.split(':').map(Number);
      if (row >= grid.rowCount || column >= grid.columnCount) sheet.cellStyles.delete(key);
    }
    for (const key of sheet.notes.keys()) {
      const [row, column] = key.split(':').map(Number);
      if (row >= grid.rowCount || column >= grid.columnCount) sheet.notes.delete(key);
    }
    sheet.validations = sheet.validations.filter((item) => {
      try {
        validateRangeBounds(item.range, grid.rowCount, grid.columnCount);
        return true;
      } catch (error) {
        if (error instanceof RequestError && error.status === 400) return false;
        throw error;
      }
    });
    sheet.conditionalFormats = sheet.conditionalFormats.filter((item) => {
      try {
        validateRangeBounds(item.range, grid.rowCount, grid.columnCount);
        return true;
      } catch (error) {
        if (error instanceof RequestError && error.status === 400) return false;
        throw error;
      }
    });
    sheet.charts = sheet.charts.filter((item) => {
      try {
        validateRangeBounds(item.range, grid.rowCount, grid.columnCount);
        return true;
      } catch (error) {
        if (error instanceof RequestError && error.status === 400) return false;
        throw error;
      }
    });
    assertWorkbookSize(workbook);
    await workbook.save();
    res.json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};

export const duplicateSheet = async (req: AuthRequest, res: Response, next: (error?: unknown) => void): Promise<void> => {
  try {
    const body = optionalObjectBody(req.body);
    if (Object.keys(body).length) badRequest('Duplicate sheet does not accept fields.');
    const workbook = await findWorkbook(req);
    if (workbook.sheets.length >= MAX_SHEETS) badRequest(`A workbook cannot contain more than ${MAX_SHEETS} sheets.`);
    const source = findSheet(workbook, req.params.sheetId);
    const suffix = ' (copy)';
    const title = `${source.title.slice(0, MAX_TITLE_LENGTH - suffix.length)}${suffix}`;
    workbook.sheets.push({
      title,
      rowCount: source.rowCount,
      columnCount: source.columnCount,
      data: source.data.map((row) => [...row]),
      hiddenRows: [...source.hiddenRows],
      hiddenColumns: [...source.hiddenColumns],
      cellStyles: new Map(source.cellStyles instanceof Map ? source.cellStyles : Object.entries(source.cellStyles || {})),
      frozenRows: source.frozenRows,
      frozenColumns: source.frozenColumns,
      validations: source.validations.map((entry) => ({ ...entry, options: [...entry.options] })),
      notes: new Map(source.notes instanceof Map ? source.notes : Object.entries(source.notes || {})),
      conditionalFormats: source.conditionalFormats.map((entry) => ({ ...entry })),
      charts: source.charts.map((entry) => ({ ...entry })),
    } as IWorkbookSheet);
    assertWorkbookSize(workbook);
    await workbook.save();
    res.status(201).json({ success: true, workbook });
  } catch (error) {
    sendError(error, next);
  }
};
