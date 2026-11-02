import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubject } from '../context/SubjectContext';
import { 
  Search, Compass, Plus, Clock, RotateCcw, 
  SlidersHorizontal, ArrowRight, BookOpen, X 
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
    <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-24 px-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div 
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-white/10">
          <Search className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <input
            type="text"
            placeholder="Type a subject, topic, or command (e.g., 'quant', 'mistakes', 'esi')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          <kbd className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-500">
            ESC
          </kbd>
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
      </div>
    </div>
  );
}
