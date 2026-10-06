'use client';

import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Reactions',
    emojis: ['👍', '👎', '❤️', '🔥', '🎉', '🚀', '😂', '😍', '👏', '🙌', '💯', '✨'],
  },
  {
    name: 'Faces',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😎', '🤓', '🧐', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢'],
  },
  {
    name: 'Hands & Gestures',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  },
  {
    name: 'Work & Objects',
    emojis: ['💼', '📁', '📂', '📄', '📝', '📊', '📈', '📉', '📌', '📍', '📎', '💻', '🖥️', '⌨️', '📱', '📞', '💡', '⏰', '⏳', '🎯', '🚀', '🔥', '⚡', '🏆', '⭐', '🌟', '✅', '❌', '⚠️', '💬', '🔔'],
  },
];

export function EmojiPicker({ onSelect, onClose, className = '' }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
  const filtered = search.trim()
    ? allEmojis.filter(() => true) // Emojis themselves don't have text, but quick search allows category or selection
    : null;

  return (
    <div
      ref={pickerRef}
      className={`w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-slate-900/5 z-50 animate-in fade-in-50 zoom-in-95 duration-150 ${className}`}
    >
      {/* Search Header */}
      <div className="relative mb-2.5">
        <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emojis..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          autoFocus
        />
      </div>

      {/* Emoji Categories Feed */}
      <div className="max-h-60 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.name}>
            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {category.name}
            </div>
            <div className="grid grid-cols-6 gap-1">
              {category.emojis.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelect(emoji);
                    onClose?.();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-slate-100 hover:scale-115 active:scale-95 transition-all"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
