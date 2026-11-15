import { useState } from 'react';
import { User } from 'firebase/auth';
import { useSubject } from '../context/SubjectContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  RotateCcw, ArrowLeft, Check, Trash2, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import {
  MotionPage,
  AnimatedNumber,
  SPRING_SNAPPY,
  EASE_OUT_EXPO,
} from '../components/MotionPrimitives';

export function MistakeNotebook({ user: _user }: { user: User }) {
  const navigate = useNavigate();
  const { subjects, mistakes, updateMistakeBox, deleteMistake } = useSubject();
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<number | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter mistakes
  const filteredMistakes = mistakes.filter(m => {
    if (selectedSubjectFilter !== 'all' && m.subjectId !== selectedSubjectFilter && m.subjectSlug !== selectedSubjectFilter) {
      return false;
    }
    if (selectedBoxFilter !== 'all' && m.leitnerBox !== selectedBoxFilter) {
      return false;
    }
    return true;
  });

  const handleLaunchRetry = (subjectSlug?: string) => {
    const slug = subjectSlug || (selectedSubjectFilter !== 'all' ? selectedSubjectFilter : 'general-awareness');
    navigate(`/new?subject=${slug}&retryMistakes=true`);
  };

  return (
    <MotionPage className="max-w-6xl mx-auto space-y-6 pt-2 pb-16 relative z-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#66665E] dark:text-[#A3A399] mb-1">
            <Link to="/" className="hover:text-[#0D47FF] dark:hover:text-[#ECD5FF] flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-[#141413] dark:text-[#FAF8EC] uppercase">
              Mistake Notebook
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2.5 tracking-tight">
            <RotateCcw className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              Spaced-Repetition{' '}
              <span className="font-editorial-italic font-normal text-[#0D47FF] dark:text-[#ECD5FF]">
                Mistake Repository
              </span>
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#40403B] dark:text-[#A3A399] mt-1">
            5-Stage Leitner Box algorithm to systematically eliminate flawed reasoning.
          </p>
        </div>

        {mistakes.length > 0 && (
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_SNAPPY}
            onClick={() => handleLaunchRetry()}
            className="min-h-[44px] px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] transition-colors flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto self-start sm:self-center"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Retry Filtered Mistakes</span>
          </motion.button>
        )}
      </div>

      {/* Leitner Box Progress Tracker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { box: 1, label: 'Box 1: Daily', interval: 'Every 24h', color: '#E11D48' },
          { box: 2, label: 'Box 2: 3-Day', interval: 'Every 3 days', color: '#D97706' },
          { box: 3, label: 'Box 3: Weekly', interval: 'Every 7 days', color: '#FFD426' },
          { box: 4, label: 'Box 4: Bi-Weekly', interval: 'Every 14 days', color: '#0D47FF' },
          { box: 5, label: 'Box 5: Mastered', interval: 'Every 30 days', color: '#10B981' },
        ].map(b => {
          const count = mistakes.filter(m => m.leitnerBox === b.box).length;
          const isSelected = selectedBoxFilter === b.box;
          return (
            <motion.button
              key={b.box}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_SNAPPY}
              onClick={() => setSelectedBoxFilter(isSelected ? 'all' : b.box)}
              className={`p-3.5 sm:p-4 rounded-2xl border-[1.5px] text-left transition-colors cursor-pointer flex flex-col justify-between min-h-[86px] ${
                isSelected
                  ? 'bg-[#141413] text-[#FAF8EC] border-[#141413] dark:border-[#ECD5FF] shadow-[4px_4px_0px_#0D47FF]'
                  : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] hover:border-[#141413] dark:hover:border-[#ECD5FF]'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className="w-3 h-3 rounded-full border border-[#141413]/30 shrink-0"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-xl font-heading font-extrabold tabular-nums">
                  <AnimatedNumber value={count} duration={0.45} />
                </span>
              </div>
              <div className="mt-2 w-full">
                <p className="font-bold text-xs truncate">{b.label}</p>
                <p className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-[#ECD5FF]' : 'text-[#66665E] dark:text-[#A3A399]'}`}>
                  {b.interval}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A]">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-mono font-bold text-[#66665E] dark:text-[#A3A399] uppercase">Filter Subject:</span>
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="flex-1 sm:flex-initial min-h-[38px] text-xs font-bold px-3 py-2 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] cursor-pointer"
          >
            <option value="all">All Subjects ({mistakes.length})</option>
            {subjects.slice(0, 7).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="text-xs font-mono font-bold px-2.5 py-1.5 rounded-md bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] dark:text-[#A3A399] tabular-nums self-start sm:self-center">
          Showing {filteredMistakes.length} mistakes
        </div>
      </div>

      {/* Mistakes List */}
      <div className="space-y-3">
        {filteredMistakes.length === 0 ? (
          <div className="p-10 sm:p-12 text-center rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A]">
            <Check className="w-12 h-12 text-[#0D47FF] dark:text-[#ECD5FF] mx-auto mb-3" />
            <h3 className="font-heading font-bold text-lg text-[#141413] dark:text-[#FAF8EC]">
              No mistakes found for this filter!
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">
              Complete mock exams and any flawed answers will automatically populate this Leitner box review.
            </p>
          </div>
        ) : (
          filteredMistakes.map(m => {
            const isExpanded = expandedId === m.id;
            const sub = subjects.find(s => s.id === m.subjectId || s.slug === m.subjectSlug);
            return (
              <motion.div
                key={m.id}
                layout="position"
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="rounded-2xl border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#1C1C1A] p-4 sm:p-5 transition-colors hover:border-[#141413] dark:hover:border-[#ECD5FF]/60"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-[#FFD426] text-[#141413] border border-[#141413]">
                        Box {m.leitnerBox}
                      </span>
                      {sub && (
                        <span
                          className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border"
                          style={{
                            color: sub.accentColor,
                            borderColor: `${sub.accentColor}45`,
                            backgroundColor: `${sub.accentColor}12`
                          }}
                        >
                          {sub.name}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
                        Topic: {m.topic}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#141413] dark:text-[#FAF8EC] pt-1 whitespace-pre-wrap">
                      {m.text}
                    </h4>

                    {m.userAnswer && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                        Your submitted answer: <span className="font-bold">{m.userAnswer}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                      className="min-h-[36px] text-xs font-bold px-3.5 py-1.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] text-[#141413] dark:text-[#FAF8EC] transition-colors cursor-pointer"
                    >
                      {isExpanded ? 'Hide' : 'Explain'}
                    </button>
                    <button
                      onClick={() => deleteMistake(m.id)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#66665E] dark:text-[#A3A399] hover:text-rose-600 cursor-pointer"
                      title="Remove from notebook"
                      aria-label="Remove mistake from notebook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Explanation & Leitner Buttons */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                      className="mt-4 pt-4 border-t border-[#E5E1CE] dark:border-[#2E2E2A] space-y-3"
                    >
                      {m.correctAnswer && (
                        <div className="p-3 rounded-xl bg-[#ECD5FF]/40 dark:bg-[#ECD5FF]/15 border border-[#141413]/30 dark:border-[#ECD5FF]/40 text-xs text-[#141413] dark:text-[#FAF8EC] font-medium">
                          <span className="font-bold">Correct Benchmark Answer: </span>
                          {m.correctAnswer}
                        </div>
                      )}

                      {m.explanation && (
                        <div className="p-3 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs text-[#40403B] dark:text-[#D5D5C8] leading-relaxed">
                          <span className="font-bold text-[#141413] dark:text-[#FAF8EC] block mb-1">Analytical Breakdown:</span>
                          {m.explanation}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
                          Reviews: {m.reviewCount} · Due: {m.nextReviewDue ? formatDistanceToNow(m.nextReviewDue, { addSuffix: true }) : 'Now'}
                        </span>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => updateMistakeBox(m.id, false)}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 cursor-pointer"
                          >
                            Demote to Box 1
                          </button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => updateMistakeBox(m.id, true)}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border border-[#141413] shadow-[2px_2px_0px_#141413] cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Promote to Box {Math.min(5, m.leitnerBox + 1)}</span>
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

    </MotionPage>
  );
}
