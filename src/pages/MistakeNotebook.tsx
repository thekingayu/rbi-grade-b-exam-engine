import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { useSubject } from '../context/SubjectContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  RotateCcw, ArrowLeft, Check, X, ShieldAlert, Sparkles, 
  Trash2, ChevronRight, Layers, ArrowUpRight, BookOpen, 
  Clock, Target, AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export function MistakeNotebook({ user }: { user: User }) {
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

  const boxCounts = [1, 2, 3, 4, 5].map(b => ({
    box: b,
    count: mistakes.filter(m => m.leitnerBox === b).length
  }));

  const handleLaunchRetry = (subjectSlug?: string) => {
    const slug = subjectSlug || (selectedSubjectFilter !== 'all' ? selectedSubjectFilter : 'general-awareness');
    navigate(`/new?subject=${slug}&retryMistakes=true`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pt-2 pb-16 relative z-10 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
            <Link to="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-900 dark:text-white uppercase">
              Mistake Notebook
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <RotateCcw className="w-6 h-6 text-rose-500" />
            <span>Spaced-Repetition Mistake Repository</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
            5-Stage Leitner Box algorithm to systematically eliminate flawed reasoning.
          </p>
        </div>

        {mistakes.length > 0 && (
          <button
            onClick={() => handleLaunchRetry()}
            className="sketch-tactile-btn px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-xl shadow-rose-600/25 flex items-center gap-2 cursor-pointer self-start sm:self-center"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Filtered Mistakes</span>
          </button>
        )}
      </div>

      {/* Leitner Box Progress Tracker */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { box: 1, label: 'Box 1: Daily', interval: 'Every 24h', color: '#EF4444' },
          { box: 2, label: 'Box 2: 3-Day', interval: 'Every 3 days', color: '#F97316' },
          { box: 3, label: 'Box 3: Weekly', interval: 'Every 7 days', color: '#F59E0B' },
          { box: 4, label: 'Box 4: Bi-Weekly', interval: 'Every 14 days', color: '#06B6D4' },
          { box: 5, label: 'Box 5: Mastered', interval: 'Every 30 days', color: '#10B981' },
        ].map(b => {
          const count = mistakes.filter(m => m.leitnerBox === b.box).length;
          const isSelected = selectedBoxFilter === b.box;
          return (
            <button
              key={b.box}
              onClick={() => setSelectedBoxFilter(isSelected ? 'all' : b.box)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900 text-white border-white/20 shadow-lg'
                  : 'bg-white/70 dark:bg-[#070B19]/80 border-slate-200/80 dark:border-white/10 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span 
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-xl font-serif font-black">{count}</span>
              </div>
              <div className="mt-2">
                <p className="font-bold text-xs truncate">{b.label}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{b.interval}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/70 dark:bg-[#070B19]/80 border border-slate-200/80 dark:border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">Filter Subject:</span>
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="all">All Subjects ({mistakes.length})</option>
            {subjects.slice(0, 7).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="text-xs font-mono text-slate-500">
          Showing {filteredMistakes.length} mistakes
        </div>
      </div>

      {/* Mistakes List */}
      <div className="space-y-3">
        {filteredMistakes.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white/70 dark:bg-[#070B19]/80 border border-slate-200/80 dark:border-white/10">
            <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white">
              No mistakes found for this filter!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Complete mock exams and any flawed answers will automatically populate this Leitner box review.
            </p>
          </div>
        ) : (
          filteredMistakes.map(m => {
            const isExpanded = expandedId === m.id;
            const sub = subjects.find(s => s.id === m.subjectId || s.slug === m.subjectSlug);
            return (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-xl p-5 shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                        Box {m.leitnerBox}
                      </span>
                      {sub && (
                        <span 
                          className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border"
                          style={{
                            color: sub.accentColor,
                            borderColor: `${sub.accentColor}40`,
                            backgroundColor: `${sub.accentColor}10`
                          }}
                        >
                          {sub.name}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">
                        Topic: {m.topic}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white pt-1 whitespace-pre-wrap">
                      {m.text}
                    </h4>

                    {m.userAnswer && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                        Your submitted answer: <span className="font-bold">{m.userAnswer}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      {isExpanded ? 'Hide' : 'Explain'}
                    </button>
                    <button
                      onClick={() => deleteMistake(m.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 cursor-pointer"
                      title="Remove from notebook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Explanation & Leitner Buttons */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-white/10 space-y-3 animate-in fade-in">
                    {m.correctAnswer && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                        <span className="font-bold">Correct Benchmark Answer: </span>
                        {m.correctAnswer}
                      </div>
                    )}

                    {m.explanation && (
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span className="font-bold text-slate-900 dark:text-white block mb-1">Analytical Breakdown:</span>
                        {m.explanation}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] font-mono text-slate-400">
                        Reviews: {m.reviewCount} · Due: {m.nextReviewDue ? formatDistanceToNow(m.nextReviewDue, { addSuffix: true }) : 'Now'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateMistakeBox(m.id, false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 cursor-pointer"
                        >
                          Demote to Box 1
                        </button>
                        <button
                          onClick={() => updateMistakeBox(m.id, true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Promote to Box {Math.min(5, m.leitnerBox + 1)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
