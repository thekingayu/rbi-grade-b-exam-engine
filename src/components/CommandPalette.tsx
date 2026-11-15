import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useSubject } from '../context/SubjectContext';
import {
  Search,
  Compass,
  Plus,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  ArrowRight,
  BookOpen,
  X,
  User as UserIcon
} from 'lucide-react';
import { SubjectIcon } from './dashboard/SubjectIcon';
import { SPRING_SNAPPY } from './MotionPrimitives';

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { subjects } = useSubject();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const quickLinks = [
    { label: 'Officer Profile & Pass', path: '/profile', icon: UserIcon, badge: 'Profile' },
    { label: 'Command Center', path: '/', icon: Compass, badge: 'Home' },
    { label: 'Start New Exam Wizard', path: '/new', icon: Plus, badge: 'Exam' },
    { label: 'Spaced Mistake Notebook', path: '/mistakes', icon: RotateCcw, badge: 'Review' },
    { label: 'Exam Attempt Archive', path: '/history', icon: Clock, badge: 'History' },
    { label: 'Official Syllabus & PDF', path: '/syllabus', icon: BookOpen, badge: 'Syllabus' },
    { label: 'Manage Subjects', path: '/manage-subjects', icon: SlidersHorizontal, badge: 'Admin' }
  ];

  const filteredLinks = quickLinks.filter((l) => l.label.toLowerCase().includes(query.toLowerCase()));
  const filteredSubjects = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.syllabusTopics.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[99999] flex items-start justify-center pt-8 sm:pt-20 p-3 sm:p-4 bg-[#141413]/75 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette quick navigation"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={SPRING_SNAPPY}
            className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/80 shadow-[5px_5px_0px_#141413] dark:shadow-[5px_5px_0px_#ECD5FF] overflow-hidden my-auto sm:my-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] shrink-0">
              <Search className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
              <input
                type="text"
                placeholder="Search subject, syllabus topic, or route..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC] placeholder:text-[#66665E] focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#66665E] hover:text-[#141413] dark:hover:text-white cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-3 space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] px-2 block mb-1.5">
                  Navigation
                </span>
                <div className="space-y-1">
                  {filteredLinks.map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <motion.button
                        key={idx}
                        whileHover={{ x: 2 }}
                        onClick={() => handleSelect(item.path)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#ECD5FF] hover:text-[#141413] text-left text-xs font-semibold text-[#141413] dark:text-[#FAF8EC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <IconComponent className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-65">{item.badge}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] px-2 block mb-1.5">
                  Subjects
                </span>
                <div className="space-y-1">
                  {filteredSubjects.map((s) => (
                    <motion.button
                      key={s.id}
                      whileHover={{ x: 2 }}
                      onClick={() => handleSelect(`/subject/${s.slug}`)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FFFFFF] dark:hover:bg-[#242421] border border-transparent hover:border-[#E5E1CE] dark:hover:border-[#2E2E2A] text-left text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: `${s.accentColor}15`,
                            borderColor: `${s.accentColor}35`,
                            color: s.accentColor
                          }}
                        >
                          <SubjectIcon name={s.icon} className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-[#141413] dark:text-[#FAF8EC]">{s.name}</p>
                          <p className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
                            {s.phase} · {s.totalMarks} Marks
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#66665E]" />
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
