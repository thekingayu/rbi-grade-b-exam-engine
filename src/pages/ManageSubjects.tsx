import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { useSubject } from '../context/SubjectContext';
import { Link } from 'react-router-dom';
import { 
  SlidersHorizontal, ArrowLeft, Check, RotateCcw, 
  ChevronRight, Edit2, ShieldAlert, Sparkles, BookOpen 
} from 'lucide-react';
import { Subject } from '../types';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';

export function ManageSubjects({ user }: { user: User }) {
  const { subjects, updateSubject, resetSubjectsToDefault } = useSubject();
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubject) {
      updateSubject(editingSubject);
      setEditingSubject(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pt-2 pb-16 relative z-10 animate-in fade-in duration-500">
      
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
              Curriculum Administration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <SlidersHorizontal className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <span>Manage RBI Examination Subjects</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
            Adjust exam marks, durations, negative-marking penalties, and question mixes dynamically.
          </p>
        </div>

        <button
          onClick={() => {
            if (window.confirm("Reset all subjects back to standard RBI Grade B defaults?")) {
              resetSubjectsToDefault();
            }
          }}
          className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer self-start sm:self-center"
        >
          Reset to Factory Defaults
        </button>
      </div>

      {/* Subject Configuration List */}
      <div className="space-y-4">
        {subjects.map(s => (
          <div
            key={s.id}
            className="p-5 rounded-2xl bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: `${s.accentColor}18`,
                  borderColor: `${s.accentColor}35`,
                  color: s.accentColor
                }}
              >
                <SubjectIcon name={s.icon} className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                    {s.phase}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Slug: {s.slug}
                  </span>
                </div>
                <h3 className="font-serif font-black text-lg text-slate-900 dark:text-white mt-0.5">
                  {s.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>Marks: <strong className="text-slate-800 dark:text-slate-200">{s.totalMarks}</strong></span>
                  <span>Duration: <strong className="text-slate-800 dark:text-slate-200">{s.durationMinutes}m</strong></span>
                  <span>Negative: <strong className="text-slate-800 dark:text-slate-200">-{s.negativeMarking}</strong></span>
                  <span>MCQ: <strong className="text-slate-800 dark:text-slate-200">{s.questionTypeMix.mcq ? 'Yes' : 'No'}</strong></span>
                  <span>Desc: <strong className="text-slate-800 dark:text-slate-200">{s.questionTypeMix.descriptive ? 'Yes' : 'No'}</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setEditingSubject(s)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/25 flex items-center gap-1.5 cursor-pointer self-start md:self-center transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Pattern</span>
            </button>
          </div>
        ))}
      </div>

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-white/10 p-6 sm:p-7 shadow-2xl space-y-4">
            <h3 className="text-xl font-serif font-black text-slate-900 dark:text-white">
              Edit {editingSubject.name} Pattern
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-500 uppercase font-mono text-[10px] mb-1">Subject Name</label>
                <input
                  type="text"
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 uppercase font-mono text-[10px] mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={editingSubject.totalMarks}
                    onChange={(e) => setEditingSubject({ ...editingSubject, totalMarks: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 uppercase font-mono text-[10px] mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    value={editingSubject.durationMinutes}
                    onChange={(e) => setEditingSubject({ ...editingSubject, durationMinutes: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 uppercase font-mono text-[10px] mb-1">Negative Mark</label>
                  <input
                    type="number"
                    step="0.05"
                    value={editingSubject.negativeMarking}
                    onChange={(e) => setEditingSubject({ ...editingSubject, negativeMarking: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSubject.questionTypeMix.mcq}
                    onChange={(e) => setEditingSubject({
                      ...editingSubject,
                      questionTypeMix: { ...editingSubject.questionTypeMix, mcq: e.target.checked }
                    })}
                    className="accent-teal-600"
                  />
                  <span>Includes MCQs</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSubject.questionTypeMix.descriptive}
                    onChange={(e) => setEditingSubject({
                      ...editingSubject,
                      questionTypeMix: { ...editingSubject.questionTypeMix, descriptive: e.target.checked }
                    })}
                    className="accent-teal-600"
                  />
                  <span>Includes Descriptive</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-500 uppercase font-mono text-[10px] mb-1">Accent Hex Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingSubject.accentColor}
                    onChange={(e) => setEditingSubject({ ...editingSubject, accentColor: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={editingSubject.accentColor}
                    onChange={(e) => setEditingSubject({ ...editingSubject, accentColor: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
