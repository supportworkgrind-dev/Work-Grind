'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { FileItem, FolderItem, Project } from '@/types';
import { EmptyState } from '@/components/common/EmptyState';
import {
  FolderClosed, UploadCloud, Plus, Star, Download,
  Trash2, Search, FileText, Image as ImageIcon, Film,
  Archive, HardDrive, X, ChevronRight,
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/getApiErrorMessage';
import { BackButton } from '@/components/common/BackButton';
import Link from 'next/link';

export default function FilesPage() {
  const { company, subscription, refreshSubscription } = useAuthStore();
  const [files,          setFiles]          = useState<FileItem[]>([]);
  const [storageSnapshot, setStorageSnapshot] = useState<{ used: number; limit: number } | null>(null);
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [uploadProjectId, setUploadProjectId] = useState('');
  const [folders,        setFolders]        = useState<FolderItem[]>([]);
  const [currentFolder,  setCurrentFolder]  = useState<string | null>(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadError,    setUploadError]    = useState('');
  const [newFolderOpen,  setNewFolderOpen]  = useState(false);
  const [newFolderName,  setNewFolderName]  = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const param = currentFolder ? `?folderId=${currentFolder}` : '?folderId=root';
      const [fRes, dirRes] = await Promise.all([api.get(`/files${param}`), api.get(`/files/folders/list${param}`)]);
      if (fRes.data.success) {
        setFiles(fRes.data.files);
        if (fRes.data.storage) setStorageSnapshot(fRes.data.storage);
      }
      if (dirRes.data.success) setFolders(dirRes.data.folders);
    } catch { /* silent */ }
  };
  useEffect(() => { fetchData(); }, [currentFolder]);

  useEffect(() => {
    let active = true;
    api.get('/projects?limit=200').then((response) => {
      if (active && response.data.success) setProjects(response.data.projects);
    }).catch(() => { if (active) setProjects([]); });
    return () => { active = false; };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const storageLimit = storageSnapshot?.limit ?? subscription?.limits.storage ?? 1_073_741_824;
    const storageUsed = storageSnapshot?.used ?? subscription?.usage.storageBytes ?? company?.storage?.used ?? 0;
    if (storageLimit !== undefined && storageLimit !== -1 && storageUsed + file.size > storageLimit) {
      window.dispatchEvent(new CustomEvent('workgrind:upgrade-required', {
        detail: { message: `This upload exceeds your remaining storage. Upgrade your ${subscription?.planName} plan for more space.` },
      }));
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const fd = new FormData(); fd.append('file', file);
    if (currentFolder) fd.append('folderId', currentFolder);
    if (uploadProjectId) fd.append('projectId', uploadProjectId);
    setIsUploading(true);
    setUploadError('');
    try {
      const r = await api.post('/files/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (r.data.success) {
        setFiles((p) => [r.data.file, ...p]);
        if (r.data.storage) setStorageSnapshot(r.data.storage);
        void refreshSubscription();
      } else {
        setUploadError(r.data.message || 'File could not be uploaded.');
      }
    } catch (error: unknown) {
      setUploadError(getApiErrorMessage(error, 'File could not be uploaded.'));
    } finally { setIsUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const r = await api.post('/files/folders', { name: newFolderName, parentId: currentFolder ?? undefined });
      if (r.data.success) { setFolders((p) => [...p, r.data.folder]); setNewFolderOpen(false); setNewFolderName(''); }
    } catch { /* silent */ }
  };
  const handleStar = async (id: string, isStarred: boolean) => {
    try {
      const r = await api.patch(`/files/${id}`, { isStarred: !isStarred });
      if (r.data.success) setFiles((p) => p.map((f) => f._id === id ? r.data.file : f));
    } catch { /* silent */ }
  };
  const handleDownload = async (f: FileItem) => {
    try {
      const r = await api.get(`/files/${f._id}/download`);
      if (r.data.success && r.data.url) {
        const a = document.createElement('a');
        a.href     = r.data.url;
        a.download = r.data.filename || f.name;
        a.target   = '_blank';
        a.rel      = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        window.location.href = `/api/files/${f._id}/download`;
      }
    } catch {
      window.location.href = `/api/files/${f._id}/download`;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
      try {
        await api.delete(`/files/${id}`);
        setFiles((p) => p.filter((f) => f._id !== id));
        await fetchData();
        void refreshSubscription();
      } catch { /* silent */ }
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/'))                    return <ImageIcon className="h-5 w-5 text-emerald-500" />;
    if (mime.startsWith('video/'))                    return <Film       className="h-5 w-5 text-purple-500"  />;
    if (mime.includes('zip') || mime.includes('tar')) return <Archive    className="h-5 w-5 text-amber-500"   />;
    return <FileText className="h-5 w-5 text-indigo-500" />;
  };

  const filtered = files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const storageUsed    = storageSnapshot?.used ?? subscription?.usage.storageBytes ?? company?.storage?.used ?? 0;
  const storageLimit   = storageSnapshot?.limit ?? subscription?.limits.storage ?? 1_073_741_824;
  const storagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));
  const storageLimitReached = storageLimit !== -1 && storageUsed >= storageLimit;

  return (
    <div className="space-y-6 pb-8">
      <BackButton fallback="/dashboard" />

      {/* Header */}
      <div className="page-hero-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">File Manager</h1>
          <p className="page-subtitle">Upload, organize, and share files with your team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" ref={fileRef} onChange={handleUpload} className="hidden" />
          {projects.length > 0 && <select aria-label="Link uploaded files to project" value={uploadProjectId} onChange={(event) => setUploadProjectId(event.target.value)} className="input-base h-9 max-w-52 text-xs">
            <option value="">No project link</option>
            {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
          </select>}
          {storageLimitReached ? (
            <Link href="/billing" className="btn-secondary h-9 px-4">Upgrade storage</Link>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={isUploading} className="btn-primary h-9 px-4">
              <UploadCloud className="h-3.5 w-3.5" />
              <span>{isUploading ? 'Uploading…' : 'Upload File'}</span>
            </button>
          )}
          <button onClick={() => setNewFolderOpen(true)} className="btn-secondary h-9 px-4">
            <Plus className="h-3.5 w-3.5" /><span>New Folder</span>
          </button>
        </div>
      </div>
      {uploadError && <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs text-rose-600">{uploadError}</p>}

      {/* Storage + Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold theme-text-secondary">Storage</span>
            <HardDrive className="h-4 w-4 theme-text-muted" />
          </div>
          <div className="flex justify-between text-[11px] theme-text-muted mb-1.5">
            <span>{formatBytes(storageUsed)} used</span>
            <span>{formatBytes(storageLimit)}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(2, storagePercent)}%` }} />
          </div>
          <p className="text-[10px] theme-text-muted mt-1.5">{storagePercent}% of storage used</p>
        </div>

        <div className="surface rounded-2xl p-4 flex items-center gap-2.5 md:col-span-2">
          <Search className="h-4 w-4 theme-text-muted shrink-0" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files by name…"
            className="flex-1 border-0 bg-transparent text-sm theme-text-primary placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="btn-ghost h-6 w-6 p-0 rounded-lg">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      {currentFolder && (
        <div className="flex items-center gap-1.5 text-xs">
          <button onClick={() => setCurrentFolder(null)} className="font-semibold text-indigo-600 hover:text-indigo-700">All Files</button>
          <ChevronRight className="h-3.5 w-3.5 theme-text-muted" />
          <span className="theme-text-secondary">Current folder</span>
        </div>
      )}

      {/* Folders */}
      {folders.length > 0 && (
        <div>
          <p className="section-label mb-3">Folders</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {folders.map((f) => (
              <button key={f._id} onClick={() => setCurrentFolder(f._id)}
                className="surface rounded-xl p-3 flex items-center gap-2.5 text-left hover:border-indigo-300 transition-all card-hover">
                <FolderClosed className="h-4.5 w-4.5 text-amber-500 shrink-0" style={{ height: '1.125rem', width: '1.125rem' }} />
                <span className="truncate text-xs font-semibold theme-text-primary">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      <div>
        <p className="section-label mb-3">Files {filtered.length > 0 && `(${filtered.length})`}</p>
        {filtered.length === 0 ? (
          <EmptyState icon={UploadCloud} title="No files yet" description="Upload files to share them with your team." actionLabel="Upload File" onAction={() => fileRef.current?.click()} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((f) => (
              <div key={f._id} className="surface rounded-2xl p-4 flex flex-col gap-3 card-hover group">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
                    {getFileIcon(f.mimeType)}
                  </div>
                  <button onClick={() => handleStar(f._id, f.isStarred)}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${f.isStarred ? 'text-amber-400' : 'text-[var(--text-muted)] hover:text-amber-400'}`}>
                    <Star className="h-3.5 w-3.5 fill-current" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold theme-text-primary truncate" title={f.name}>{f.name}</p>
                  <p className="text-[10px] theme-text-muted mt-0.5">{formatBytes(f.size)} · {formatDate(f.createdAt, 'MMM d')}</p>
                  {typeof f.projectId === 'object' && f.projectId && <p className="mt-1 truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Project: {f.projectId.name}{typeof f.projectId.crmCompanyId === 'object' && f.projectId.crmCompanyId ? ` · ${f.projectId.crmCompanyId.name}` : ''}
                  </p>}
                </div>

                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    onClick={() => handleDownload(f)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">
                    <Download className="h-3.5 w-3.5" />Download
                  </button>
                  <button onClick={() => handleDelete(f._id)}
                    className="h-6 w-6 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {newFolderOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-sm">
            <div className="modal-header">
              <h3 className="modal-title">New Folder</h3>
              <button onClick={() => setNewFolderOpen(false)} className="btn-ghost h-7 w-7 p-0 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreateFolder} className="modal-body">
              <div>
                <label className="form-label" htmlFor="folder-name">Folder Name</label>
                <input id="folder-name" type="text" required value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Design Assets" className="input-base" autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setNewFolderOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Folder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
