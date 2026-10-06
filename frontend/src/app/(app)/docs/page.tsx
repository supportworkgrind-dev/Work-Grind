'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DocumentItem, Project } from '@/types';
import {
  FileText,
  Plus,
  Search,
  Sparkles,
  Clock,
  Share2,
  Trash2,
  Save,
  Check,
  BookOpen,
  ChevronRight,
  X,
} from 'lucide-react';
import { formatDate, formatTimeAgo } from '@/lib/utils';
import { BackButton } from '@/components/common/BackButton';

export default function DocsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [documentProjectId, setDocumentProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [docType, setDocType] = useState('document');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDocs = async () => {
    try {
      const [res, projectResponse] = await Promise.allSettled([
        api.get('/documents'),
        api.get('/projects?limit=200'),
      ]);
      if (res.status === 'fulfilled' && res.value.data.success) {
        setDocuments(res.value.data.documents);
        if (!selectedDoc && res.value.data.documents.length > 0) {
          selectDocument(res.value.data.documents[0]);
        }
      }
      if (projectResponse.status === 'fulfilled' && projectResponse.value.data.success) {
        setProjects(projectResponse.value.data.projects);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const selectDocument = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setTitle(doc.title);
    setContent(doc.content || '');
    setDocType(doc.type);
    setDocumentProjectId(typeof doc.projectId === 'string' ? doc.projectId : doc.projectId?._id ?? '');
    setAiSummary(null);
  };

  const handleCreateNew = async () => {
    try {
      const res = await api.post('/documents', {
        title: 'Untitled Document',
        content: '# Welcome to your new document\n\nStart drafting notes, specifications, or company policies here.',
        type: 'document',
        projectId: documentProjectId || undefined,
      });
      if (res.data.success) {
        setDocuments((prev) => [res.data.document, ...prev]);
        selectDocument(res.data.document);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);
    try {
      const res = await api.patch(`/documents/${selectedDoc._id}`, {
        title,
        content,
        type: docType,
        projectId: documentProjectId || null,
      });

      if (res.data.success) {
        setSelectedDoc(res.data.document);
        setDocuments((prev) =>
          prev.map((d) => (d._id === selectedDoc._id ? res.data.document : d))
        );
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    try {
      await api.delete(`/documents/${selectedDoc._id}`);
      const updated = documents.filter((d) => d._id !== selectedDoc._id);
      setDocuments(updated);
      setSelectedDoc(updated.length > 0 ? updated[0] : null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAISummarize = async () => {
    if (!selectedDoc) return;
    setAiLoading(true);
    try {
      const res = await api.post('/ai/summarize-document', {
        documentId: selectedDoc._id,
      });
      if (res.data.success) {
        setAiSummary(res.data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-3 min-h-0">
      <BackButton fallback="/dashboard" />
      <div className="flex flex-1 rounded-2xl border overflow-hidden min-h-0" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
      {/* Left Documents List */}
      <div className="w-64 border-r flex flex-col shrink-0" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
        <div className="p-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <span className="section-label">Documents</span>
          <button onClick={handleCreateNew} className="btn-primary h-7 px-2.5 rounded-lg text-[11px]">
            <Plus className="h-3 w-3" /><span>New</span>
          </button>
        </div>

        <div className="p-2 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 theme-text-muted" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs…"
              className="w-full rounded-lg border py-1.5 pl-8 pr-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredDocs.length === 0 ? (
            <div className="py-8 text-center text-xs theme-text-muted">No documents found</div>
          ) : (
            filteredDocs.map((doc) => (
              <button
                key={doc._id} onClick={() => selectDocument(doc)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-all ${
                  selectedDoc?._id === doc._id
                    ? 'font-semibold'
                    : 'theme-text-secondary hover:theme-bg-hover'
                }`}
                style={selectedDoc?._id === doc._id ? { background: 'var(--bg-active)', color: 'var(--accent-text)' } : {}}
              >
                <span className="text-base shrink-0">{doc.icon || '📝'}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{doc.title}</p>
                  <span className="text-[10px] theme-text-muted">{formatTimeAgo(doc.updatedAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Document Editor */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg-card)' }}>
        {selectedDoc ? (
          <>
            {/* Toolbar */}
            <div className="flex h-14 items-center justify-between border-b px-5 shrink-0" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <select value={docType} onChange={(e) => setDocType(e.target.value)}
                  className="shrink-0 rounded-lg border py-1 px-2 text-xs font-semibold"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  <option value="document">General Doc</option>
                  <option value="meeting_notes">Meeting Notes</option>
                  <option value="sop">SOP</option>
                  <option value="policy">Policy</option>
                  <option value="report">Report</option>
                </select>
                <select aria-label="Related project" value={documentProjectId} onChange={(event) => setDocumentProjectId(event.target.value)}
                  className="max-w-48 truncate rounded-lg border py-1 px-2 text-xs font-semibold"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  <option value="">No project</option>
                  {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
                </select>
                <span className="text-xs theme-text-muted truncate min-w-0">
                  v{selectedDoc.versionHistory?.length ?? 1} · {selectedDoc.lastEditedBy?.fullName ?? 'You'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={handleAISummarize} disabled={aiLoading}
                  className="btn-ghost h-8 px-3 rounded-xl text-[11px] text-indigo-600 hover:bg-indigo-50 gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiLoading ? 'Tavro AI is summarizing…' : 'Tavro AI Summary'}
                </button>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary h-8 px-3 rounded-xl text-[11px] gap-1">
                  {savedSuccess ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
                  {savedSuccess ? 'Saved' : isSaving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={handleDelete} className="btn-ghost h-8 w-8 p-0 rounded-xl text-rose-500 hover:bg-rose-50" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {typeof selectedDoc.projectId === 'object' && selectedDoc.projectId && <div className="border-b px-5 py-2 text-[11px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
              Related project: <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{selectedDoc.projectId.name}</span>
              {typeof selectedDoc.projectId.crmCompanyId === 'object' && selectedDoc.projectId.crmCompanyId && <> · Related company: <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{selectedDoc.projectId.crmCompanyId.name}</span></>}
            </div>}

            {/* Tavro AI Summary */}
            {aiSummary && (
              <div className="border-b px-5 py-3.5 flex items-start gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--accent-subtle)' }}>
                <Sparkles className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--accent-text)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--accent-text)' }}>Tavro AI Summary</p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{aiSummary}</p>
                </div>
                <button onClick={() => setAiSummary(null)} className="btn-ghost h-6 w-6 p-0 rounded-lg shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full flex flex-col">
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Document"
                className="w-full border-0 bg-transparent text-2xl font-extrabold mb-5 shrink-0 focus:outline-none placeholder:opacity-30"
                style={{ color: 'var(--text-primary)' }}
              />
              <textarea
                value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing in Markdown or plain text…"
                className="flex-1 w-full min-h-[320px] resize-none border-0 bg-transparent text-sm leading-relaxed font-mono focus:outline-none placeholder:opacity-30"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 theme-text-muted">
            <FileText className="h-10 w-10 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-semibold theme-text-secondary">No document selected</p>
              <p className="text-xs theme-text-muted mt-0.5">Pick a document or create a new one</p>
            </div>
            <button onClick={handleCreateNew} className="btn-primary mt-2">
              <Plus className="h-3.5 w-3.5" />Create Document
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
