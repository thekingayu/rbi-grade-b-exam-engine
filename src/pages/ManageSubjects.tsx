import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { useSubject } from '../context/SubjectContext';
import { Link } from 'react-router-dom';
import {
  SlidersHorizontal, ArrowLeft, ChevronRight, Edit2, X
} from 'lucide-react';
import { Subject } from '../types';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';
import { motion } from 'motion/react';
import {
  MotionPage,
  MotionStaggerGrid,
  MotionStaggerItem,
  MotionModal,
  SPRING_SNAPPY,
} from '../components/MotionPrimitives';

export function ManageSubjects({ user: _user }: { user: User }) {
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
    <MotionPage className="max-w-5xl mx-auto space-y-6 pt-2 pb-16 relative z-10">
      
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
              Curriculum Administration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2.5 tracking-tight">
            <SlidersHorizontal className="w-6 h-6 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
            <span>
              Manage RBI{' '}
              <span className="font-editorial-italic font-normal text-[#0D47FF] dark:text-[#ECD5FF]">
                Examination Subjects
              </span>
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#40403B] dark:text-[#A3A399] mt-1">
            Adjust exam marks, durations, negative-marking penalties, and question mixes dynamically.
          </p>
        </div>

        <button
          onClick={() => {
            if (window.confirm("Reset all subjects back to standard RBI Grade B defaults?")) {
              resetSubjectsToDefault();
            }
          }}
          className="min-h-[38px] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] px-3.5 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer self-start sm:self-center transition-colors"
        >
          Reset to Factory Defaults
        </button>
      </div>

      {/* Subject Configuration List */}
      <MotionStaggerGrid className="space-y-4">
        {subjects.map(s => (
          <MotionStaggerItem key={s.id}>
            <motion.div
              whileHover={{ y: -2 }}
              transition={SPRING_SNAPPY}
              className="p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border border-[#141413]/15 dark:border-[#2E2E2A]"
                  style={{
                    backgroundColor: `${s.accentColor}18`,
                    color: s.accentColor
                  }}
                >
                  <SubjectIcon name={s.icon} className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border border-[#141413]/25 dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#ECD5FF]">
                      {s.phase}
                    </span>
                    <span className="text-xs font-mono text-[#66665E] dark:text-[#A3A399]">
                      Slug: {s.slug}
                    </span>
                  </div>
                  <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] mt-0.5 truncate">
                    {s.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#66665E] dark:text-[#A3A399] mt-1 tabular-nums">
                    <span>Marks: <strong className="text-[#141413] dark:text-[#FAF8EC]">{s.totalMarks}</strong></span>
                    <span>Duration: <strong className="text-[#141413] dark:text-[#FAF8EC]">{s.durationMinutes}m</strong></span>
                    <span>Negative: <strong className="text-[#141413] dark:text-[#FAF8EC]">-{s.negativeMarking}</strong></span>
                    <span>MCQ: <strong className="text-[#141413] dark:text-[#FAF8EC]">{s.questionTypeMix.mcq ? 'Yes' : 'No'}</strong></span>
                    <span>Desc: <strong className="text-[#141413] dark:text-[#FAF8EC]">{s.questionTypeMix.descriptive ? 'Yes' : 'No'}</strong></span>
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setEditingSubject(s)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border-[1.5px] border-[#141413] shadow-[2px_2px_0px_#141413] flex items-center justify-center gap-1.5 cursor-pointer self-start md:self-center transition-colors shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Pattern</span>
              </motion.button>
            </motion.div>
          </MotionStaggerItem>
        ))}
      </MotionStaggerGrid>

      {/* Edit Subject Modal */}
      <MotionModal
        isOpen={!!editingSubject}
        onClose={() => setEditingSubject(null)}
        maxWidthClass="max-w-lg"
      >
        {editingSubject && (
          <div className="w-full rounded-3xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[2px] border-[#141413] dark:border-[#ECD5FF] p-5 sm:p-7 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF]/40 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E1CE] dark:border-[#2E2E2A] pb-3">
              <h3 className="text-lg sm:text-xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
                Edit {editingSubject.name} Pattern
              </h3>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="p-1.5 rounded-lg text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] cursor-pointer"
                aria-label="Close edit modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[#66665E] dark:text-[#A3A399] uppercase font-mono font-bold text-[10px] mb-1">Subject Name</label>
                <input
                  type="text"
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#66665E] dark:text-[#A3A399] uppercase font-mono font-bold text-[10px] mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={editingSubject.totalMarks}
                    onChange={(e) => setEditingSubject({ ...editingSubject, totalMarks: parseInt(e.target.value, 10) || 0 })}
                    className="w-full min-h-[42px] px-3 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] tabular-nums focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[#66665E] dark:text-[#A3A399] uppercase font-mono font-bold text-[10px] mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    value={editingSubject.durationMinutes}
                    onChange={(e) => setEditingSubject({ ...editingSubject, durationMinutes: parseInt(e.target.value, 10) || 0 })}
                    className="w-full min-h-[42px] px-3 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] tabular-nums focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[#66665E] dark:text-[#A3A399] uppercase font-mono font-bold text-[10px] mb-1">Negative Mark</label>
                  <input
                    type="number"
                    step="0.05"
                    value={editingSubject.negativeMarking}
                    onChange={(e) => setEditingSubject({ ...editingSubject, negativeMarking: parseFloat(e.target.value) || 0 })}
                    className="w-full min-h-[42px] px-3 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] tabular-nums focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-2 text-[#141413] dark:text-[#FAF8EC] font-bold">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSubject.questionTypeMix.mcq}
                    onChange={(e) => setEditingSubject({
                      ...editingSubject,
                      questionTypeMix: { ...editingSubject.questionTypeMix, mcq: e.target.checked }
                    })}
                    className="accent-[#0D47FF]"
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
                    className="accent-[#0D47FF]"
                  />
                  <span>Includes Descriptive</span>
                </label>
              </div>

              <div>
                <label className="block text-[#66665E] dark:text-[#A3A399] uppercase font-mono font-bold text-[10px] mb-1">Accent Hex Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingSubject.accentColor}
                    onChange={(e) => setEditingSubject({ ...editingSubject, accentColor: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-[#141413]"
                  />
                  <input
                    type="text"
                    value={editingSubject.accentColor}
                    onChange={(e) => setEditingSubject({ ...editingSubject, accentColor: e.target.value })}
                    className="flex-1 min-h-[42px] px-3 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  className="min-h-[40px] px-5 py-2.5 rounded-xl bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] font-bold cursor-pointer"
                >
                  Save Changes
                </motion.button>
              </div>
            </form>
          </div>
        )}
      </MotionModal>

    </MotionPage>
  );
}
