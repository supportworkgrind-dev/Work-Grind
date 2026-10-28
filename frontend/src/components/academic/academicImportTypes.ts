import type { AxiosResponse } from 'axios';

export type ImportField = { key: string; label: string; required?: boolean; help: string; example?: string; values?: string[] };
export type ImportModule = {
  id: string;
  label: string;
  description: string;
  headers: string[];
  required: string[];
  requirementNote?: string;
  fields: ImportField[];
  exportable: boolean;
  invitable: boolean;
};
export type ImportIssue = { rowNumber: number; field?: string; code: string; message: string; severity?: 'error' | 'warning' };
export type ImportRowAction = 'create' | 'update' | 'skip' | 'error';
export type ImportMapping = Record<string, string | null>;
export type ImportPreview = {
  sheets: string[];
  worksheet?: string;
  headers: string[];
  headerLabels: string[];
  fields: ImportField[];
  mapping: ImportMapping;
  unmappedHeaders: string[];
  totalRows: number;
  previewRows: Array<{ rowNumber: number; action: ImportRowAction; values: Record<string, string>; generated: string[] }>;
  issues: ImportIssue[];
  validRows: number;
  invalidRows: number;
  warningCount: number;
  actions: { create: number; update: number; skip: number };
  generatedIds: number;
  previousImport?: { id: string; createdAt: string; status: string; originalFilename: string };
};
export type ImportJob = {
  id: string;
  module: string;
  mode: string;
  originalFilename: string;
  status: 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  skippedRows: number;
  failedRows: number;
  issueCount: number;
  warningCount?: number;
  generatedIdCount?: number;
  personCount?: number;
  createdAt: string;
  completedAt?: string;
};
export type InvitationSummary = { sent: number; failed: number; already_linked: number; already_accepted: number; no_email: number; inactive: number };

/** Saves a blob response with the server's filename when it sent one. */
export function saveDownload(response: AxiosResponse<Blob>, fallbackName: string): void {
  const disposition = String(response.headers?.['content-disposition'] ?? '');
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function skippedInvitations(summary: InvitationSummary): number {
  return summary.already_linked + summary.already_accepted + summary.no_email + summary.inactive;
}
