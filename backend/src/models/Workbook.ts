import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkbookSheet {
  _id: mongoose.Types.ObjectId;
  title: string;
  rowCount: number;
  columnCount: number;
  data: string[][];
  hiddenRows: number[];
  hiddenColumns: number[];
  cellStyles: Map<string, Record<string, string | number | boolean>>;
  frozenRows: number;
  frozenColumns: number;
  validations: Array<{
    range: string;
    type: 'list' | 'checkbox';
    options: string[];
  }>;
  notes: Map<string, string>;
  conditionalFormats: Array<{
    range: string;
    condition: 'greaterThan' | 'lessThan' | 'equalTo' | 'textContains';
    value: string;
    color: string;
    backgroundColor: string;
  }>;
  charts: Array<{
    title: string;
    type: 'bar' | 'line' | 'pie';
    range: string;
  }>;
}

export interface IWorkbook extends Document {
  companyId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  title: string;
  sheets: IWorkbookSheet[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SheetSchema = new Schema<IWorkbookSheet>({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  rowCount: { type: Number, required: true, min: 1, max: 500 },
  columnCount: { type: Number, required: true, min: 1, max: 100 },
  data: { type: [[String]], required: true, default: [] },
  hiddenRows: { type: [Number], default: [] },
  hiddenColumns: { type: [Number], default: [] },
  cellStyles: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  frozenRows: { type: Number, min: 0, max: 25, default: 0 },
  frozenColumns: { type: Number, min: 0, max: 10, default: 0 },
  validations: {
    type: [{
      range: { type: String, required: true, maxlength: 32 },
      type: { type: String, enum: ['list', 'checkbox'], required: true },
      options: { type: [String], default: [] },
    }],
    default: [],
  },
  notes: { type: Map, of: { type: String, maxlength: 2000 }, default: () => new Map() },
  conditionalFormats: {
    type: [{
      range: { type: String, required: true, maxlength: 32 },
      condition: { type: String, enum: ['greaterThan', 'lessThan', 'equalTo', 'textContains'], required: true },
      value: { type: String, maxlength: 100 },
      color: { type: String, maxlength: 32 },
      backgroundColor: { type: String, maxlength: 32 },
    }],
    default: [],
  },
  charts: {
    type: [{
      title: { type: String, maxlength: 120 },
      type: { type: String, enum: ['bar', 'line', 'pie'], required: true },
      range: { type: String, required: true, maxlength: 32 },
    }],
    default: [],
  },
});

const WorkbookSchema = new Schema<IWorkbook>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  sheets: { type: [SheetSchema], required: true, default: [] },
  isArchived: { type: Boolean, default: false, index: true },
}, { timestamps: true });

WorkbookSchema.index({ companyId: 1, creatorId: 1, isArchived: 1, updatedAt: -1 });

export default mongoose.model<IWorkbook>('Workbook', WorkbookSchema);
