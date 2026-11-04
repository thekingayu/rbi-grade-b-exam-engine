import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubject } from '../context/SubjectContext';
import { 
  Search, Compass, Plus, Clock, RotateCcw, 
  SlidersHorizontal, ArrowRight, BookOpen, X, User as UserIcon 
} from 'lucide-react';
import { SubjectIcon } from './dashboard/SubjectIcon';

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { subjects } = useSubject();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickLinks = [
    { label: 'Officer Profile & Dossier', path: '/profile', icon: UserIcon, badge: 'Profile' },
    { label: 'Global Command Center', path: '/', icon: Compass, badge: 'Home' },
    { label: 'Start New Exam Wizard', path: '/new', icon: Plus, badge: 'Exam' },
    { label: 'Spaced Mistake Notebook', path: '/mistakes', icon: RotateCcw, badge: 'Review' },
    { label: 'Exam Attempt Archive', path: '/history', icon: Clock, badge: 'History' },
    { label: 'Manage Subjects & Patterns', path: '/manage-subjects', icon: SlidersHorizontal, badge: 'Admin' },
  ];

  const filteredLinks = quickLinks.filter(l => l.label.toLowerCase().includes(query.toLowerCase()));
  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(query.toLowerCase()) || 
    s.syllabusTopics.some(t => t.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-start justify-center pt-8 sm:pt-20 p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette quick navigation"
    >
      <div 
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto sm:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 sm:gap-3 px-3.5 py-3 border-b border-slate-200 dark:border-white/10 shrink-0">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400 shrink-0" />
          <input
            type="text"
            placeholder="Type a subject, topic, or command (e.g. 'quant', 'mistakes', 'esi')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-500 shrink-0">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 -mr-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Close dialog (Esc)"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {/* Quick Actions */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 block mb-1">
              Navigation Commands
            </span>
            <div className="space-y-1">
              {filteredLinks.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(item.path)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-400">
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subjects */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 block mb-1">
              Jump to Subject Dashboard
            </span>
            <div className="space-y-1">
              {filteredSubjects.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(`/subject/${s.slug}`)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${s.accentColor}18`,
                        borderColor: `${s.accentColor}35`,
                        color: s.accentColor
                      }}
                    >
                      <SubjectIcon name={s.icon} className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{s.phase} · {s.totalMarks} Marks</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info & touch close button */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <span>Tap outside or</span>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold">
              ESC
            </kbd>
            <span>to close</span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
