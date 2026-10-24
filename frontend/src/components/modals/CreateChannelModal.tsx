'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import { X, Hash, Lock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/lib/i18n';

export function CreateChannelModal({ onCreated }: { onCreated?: () => void }) {
  const { isCreateModalOpen, createModalType, closeCreateModal } = useAppStore(useShallow((s) => ({ isCreateModalOpen: s.isCreateModalOpen, createModalType: s.createModalType, closeCreateModal: s.closeCreateModal })));

  const t = useT('chat');
  const tc = useT('common');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [isLoading, setIsLoading] = useState(false);

  if (!isCreateModalOpen || createModalType !== 'channel') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const sanitizedName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
      const res = await api.post('/channels', {
        name: sanitizedName,
        description,
        type,
      });

      if (res.data.success) {
        closeCreateModal();
        setName('');
        setDescription('');
        if (onCreated) onCreated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">{t('channelModal.title')}</h3>
          </div>
          <button
            onClick={closeCreateModal}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              {t('channelModal.nameLabel')}
            </label>
            <div className="relative mt-1.5 rounded-xl shadow-xs">
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-400 font-bold">
                #
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('channelModal.namePlaceholder')}
                className="block w-full rounded-xl border-0 py-2.5 ps-8 pe-3.5 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              {t('channelModal.topicLabel')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('channelModal.topicPlaceholder')}
              className="mt-1.5 block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t('channelModal.visibilityLabel')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('public')}
                className={`flex items-start gap-2.5 rounded-xl p-3 border text-start transition-all ${
                  type === 'public'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Hash className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900">{t('channelModal.public')}</p>
                  <p className="text-[11px] text-slate-500">{t('channelModal.publicHint')}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('private')}
                className={`flex items-start gap-2.5 rounded-xl p-3 border text-start transition-all ${
                  type === 'private'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Lock className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900">{t('channelModal.private')}</p>
                  <p className="text-[11px] text-slate-500">{t('channelModal.privateHint')}</p>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeCreateModal}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {tc('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {isLoading ? t('channelModal.creating') : t('channelModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
