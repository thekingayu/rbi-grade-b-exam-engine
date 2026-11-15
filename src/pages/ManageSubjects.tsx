import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { useSubject } from '../context/SubjectContext';
import { Link } from 'react-router-dom';
import {
  SlidersHorizontal,
  ArrowLeft,
  ChevronRight,
  Edit2,
  X,
  Check,
  CheckSquare,
  FileText,
  Palette
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
  SPRING_BOUNCY,
} from '../components/MotionPrimitives';

const PRESET_ACCENT_COLORS = [
  '#0D9488',
  '#0D47FF',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#059669',
  '#DC2626',
];

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
          className="w-full sm:w-auto min-h-[38px] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] px-3.5 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer text-center transition-colors"
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
                className="w-full md:w-auto min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border-[1.5px] border-[#141413] shadow-[2px_2px_0px_#141413] flex items-center justify-center gap-1.5 cursor-pointer self-stretch md:self-center transition-colors shrink-0"
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
        maxWidthClass="max-w-xl"
      >
        {editingSubject && (
          <div
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
            className="w-full rounded-3xl bg-[#FAF8EC] dark:bg-[#191917] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF]/60 overflow-hidden flex flex-col max-h-[86dvh]"
          >
            {/* Dynamic Color Top Accent Hairline */}
            <div
              className="h-1.5 w-full shrink-0 transition-colors duration-200"
              style={{ backgroundColor: editingSubject.accentColor }}
            />

            {/* Header with Live Icon Tile Preview */}
            <div className="flex items-start justify-between gap-3 px-5 sm:px-7 pt-5 pb-4 border-b border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border-[1.5px] transition-colors duration-200"
                  style={{
                    backgroundColor: `${editingSubject.accentColor}1A`,
                    borderColor: `${editingSubject.accentColor}4D`,
                    color: editingSubject.accentColor,
                  }}
                >
                  <SubjectIcon name={editingSubject.icon} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#66665E] dark:text-[#A3A399]">
                    <span>{editingSubject.phase}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{editingSubject.slug}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] tracking-tight truncate">
                    {editingSubject.name || 'Untitled Subject'}{' '}
                    <span className="font-editorial-italic font-normal text-[#0D47FF] dark:text-[#ECD5FF]">
                      Pattern
                    </span>
                  </h3>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={SPRING_SNAPPY}
                type="button"
                onClick={() => setEditingSubject(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FAF8EC] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] hover:border-[#141413] dark:hover:border-[#FAF8EC]/60 cursor-pointer shrink-0 transition-colors"
                aria-label="Close edit modal"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Scrollable Body */}
            <form
              onSubmit={handleSave}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-5 sm:px-7 py-5 space-y-5"
            >
              {/* Live Summary Telemetry Strip */}
              <div className="grid grid-cols-3 gap-2 py-2.5 px-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-center tabular-nums">
                <div>
                  <span className="block text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">Weightage</span>
                  <span className="text-sm font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
                    {editingSubject.totalMarks} marks
                  </span>
                </div>
                <div className="border-x border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <span className="block text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">Required Pace</span>
                  <span className="text-sm font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
                    {editingSubject.durationMinutes > 0
                      ? (editingSubject.totalMarks / editingSubject.durationMinutes).toFixed(2)
                      : '0.00'}{' '}
                    m/min
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">Penalty</span>
                  <span className="text-sm font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
                    {editingSubject.negativeMarking > 0 ? `-${editingSubject.negativeMarking}` : 'Zero'}
                  </span>
                </div>
              </div>

              {/* Subject Title & Phase */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[#40403B] dark:text-[#A3A399] font-mono font-bold text-[11px] mb-1.5">
                    Subject Title
                  </label>
                  <input
                    type="text"
                    value={editingSubject.name}
                    onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-sm font-semibold text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[#40403B] dark:text-[#A3A399] font-mono font-bold text-[11px] mb-1.5">
                    Exam Stage
                  </label>
                  <select
                    value={editingSubject.phase}
                    onChange={(e) => setEditingSubject({ ...editingSubject, phase: e.target.value as 'Phase 1' | 'Phase 2' })}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-sm font-semibold text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] cursor-pointer transition-colors"
                  >
                    <option value="Phase 1">Phase 1</option>
                    <option value="Phase 2">Phase 2</option>
                  </select>
                </div>
              </div>

              {/* Marks, Duration & Penalty with Inline Unit Labels */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[#40403B] dark:text-[#A3A399] font-mono font-bold text-[11px] mb-1.5">
                    Total Marks
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={1}
                      value={editingSubject.totalMarks}
                      onChange={(e) => setEditingSubject({ ...editingSubject, totalMarks: parseInt(e.target.value, 10) || 0 })}
                      className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-sm font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] transition-colors"
                      required
                    />
                    <span className="absolute right-3 text-[10px] font-mono font-bold text-[#66665E] dark:text-[#A3A399] pointer-events-none">
                      PTS
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[#40403B] dark:text-[#A3A399] font-mono font-bold text-[11px] mb-1.5">
                    Duration
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={1}
                      value={editingSubject.durationMinutes}
                      onChange={(e) => setEditingSubject({ ...editingSubject, durationMinutes: parseInt(e.target.value, 10) || 0 })}
                      className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-sm font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] transition-colors"
                      required
                    />
                    <span className="absolute right-3 text-[10px] font-mono font-bold text-[#66665E] dark:text-[#A3A399] pointer-events-none">
                      MIN
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[#40403B] dark:text-[#A3A399] font-mono font-bold text-[11px] mb-1.5">
                    Negative Marking
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={0}
                      step="0.05"
                      value={editingSubject.negativeMarking}
                      onChange={(e) => setEditingSubject({ ...editingSubject, negativeMarking: parseFloat(e.target.value) || 0 })}
                      className="w-full min-h-[44px] pl-3.5 pr-12 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-sm font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] transition-colors"
                      required
                    />
                    <span className="absolute right-3 text-[10px] font-mono font-bold text-[#66665E] dark:text-[#A3A399] pointer-events-none">
                      -PTS
                    </span>
                  </div>
                </div>
              </div>

              {/* Question Format Mix — Tactile Toggle Cards */}
              <div>
                <span className="block text-[#40403B] dark:text-[#A3A399] font-mono font-bold text-[11px] mb-1.5">
                  Question Format Mix
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING_SNAPPY}
                    type="button"
                    onClick={() =>
                      setEditingSubject({
                        ...editingSubject,
                        questionTypeMix: {
                          ...editingSubject.questionTypeMix,
                          mcq: !editingSubject.questionTypeMix.mcq,
                        },
                      })
                    }
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border-[1.5px] text-left cursor-pointer transition-all ${
                      editingSubject.questionTypeMix.mcq
                        ? 'bg-[#FFFFFF] dark:bg-[#141413] border-[#0D47FF] dark:border-[#ECD5FF] shadow-[2px_2px_0px_#0D47FF] dark:shadow-[2px_2px_0px_#ECD5FF]'
                        : 'bg-[#FFFFFF]/60 dark:bg-[#141413]/60 border-[#E5E1CE] dark:border-[#2E2E2A] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          editingSubject.questionTypeMix.mcq
                            ? 'bg-[#0D47FF]/12 text-[#0D47FF] dark:bg-[#ECD5FF]/15 dark:text-[#ECD5FF]'
                            : 'bg-[#F3F0E0] dark:bg-[#242421] text-[#66665E]'
                        }`}
                      >
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-[#141413] dark:text-[#FAF8EC]">
                          Objective MCQs
                        </span>
                        <span className="block text-[11px] text-[#66665E] dark:text-[#A3A399]">
                          Timed single-choice items
                        </span>
                      </div>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                        editingSubject.questionTypeMix.mcq
                          ? 'bg-[#0D47FF] border-[#0D47FF] text-white dark:bg-[#ECD5FF] dark:border-[#ECD5FF] dark:text-[#141413]'
                          : 'border-[#CBC6B3] dark:border-[#3A3A34]'
                      }`}
                    >
                      {editingSubject.questionTypeMix.mcq && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING_SNAPPY}
                    type="button"
                    onClick={() =>
                      setEditingSubject({
                        ...editingSubject,
                        questionTypeMix: {
                          ...editingSubject.questionTypeMix,
                          descriptive: !editingSubject.questionTypeMix.descriptive,
                        },
                      })
                    }
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border-[1.5px] text-left cursor-pointer transition-all ${
                      editingSubject.questionTypeMix.descriptive
                        ? 'bg-[#FFFFFF] dark:bg-[#141413] border-[#0D47FF] dark:border-[#ECD5FF] shadow-[2px_2px_0px_#0D47FF] dark:shadow-[2px_2px_0px_#ECD5FF]'
                        : 'bg-[#FFFFFF]/60 dark:bg-[#141413]/60 border-[#E5E1CE] dark:border-[#2E2E2A] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          editingSubject.questionTypeMix.descriptive
                            ? 'bg-[#0D47FF]/12 text-[#0D47FF] dark:bg-[#ECD5FF]/15 dark:text-[#ECD5FF]'
                            : 'bg-[#F3F0E0] dark:bg-[#242421] text-[#66665E]'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-[#141413] dark:text-[#FAF8EC]">
                          Descriptive Writing
                        </span>
                        <span className="block text-[11px] text-[#66665E] dark:text-[#A3A399]">
                          Long-form rubric evaluation
                        </span>
                      </div>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                        editingSubject.questionTypeMix.descriptive
                          ? 'bg-[#0D47FF] border-[#0D47FF] text-white dark:bg-[#ECD5FF] dark:border-[#ECD5FF] dark:text-[#141413]'
                          : 'border-[#CBC6B3] dark:border-[#3A3A34]'
                      }`}
                    >
                      {editingSubject.questionTypeMix.descriptive && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </span>
                  </motion.button>
                </div>
              </div>

              {/* Curated Accent Color Swatches + Custom Hex Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#40403B] dark:text-[#A3A399] font-mono font-bold text-[11px]">
                    Subject Accent Color
                  </span>
                  <span className="text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] uppercase">
                    {editingSubject.accentColor}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_ACCENT_COLORS.map((hex) => {
                      const active = editingSubject.accentColor.toUpperCase() === hex.toUpperCase();
                      return (
                        <motion.button
                          key={hex}
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.92 }}
                          transition={SPRING_BOUNCY}
                          type="button"
                          onClick={() => setEditingSubject({ ...editingSubject, accentColor: hex })}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                            active
                              ? 'ring-2 ring-offset-2 ring-[#141413] dark:ring-[#FAF8EC] dark:ring-offset-[#141413]'
                              : 'hover:opacity-90'
                          }`}
                          style={{ backgroundColor: hex }}
                          aria-label={`Select color ${hex}`}
                        >
                          {active && <Check className="w-4 h-4 text-white drop-shadow-xs stroke-[2.5]" />}
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="hidden sm:block w-px h-6 bg-[#E5E1CE] dark:bg-[#2E2E2A] mx-1" />

                  <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                    <label
                      className="relative w-8 h-8 rounded-lg border-[1.5px] border-[#141413]/30 dark:border-[#FAF8EC]/30 flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
                      style={{ backgroundColor: editingSubject.accentColor }}
                      title="Custom color picker"
                    >
                      <Palette className="w-3.5 h-3.5 text-white drop-shadow-xs pointer-events-none" />
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(editingSubject.accentColor) ? editingSubject.accentColor : '#0D9488'}
                        onChange={(e) => setEditingSubject({ ...editingSubject, accentColor: e.target.value.toUpperCase() })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        aria-label="Pick custom accent color"
                      />
                    </label>
                    <input
                      type="text"
                      value={editingSubject.accentColor}
                      onChange={(e) => setEditingSubject({ ...editingSubject, accentColor: e.target.value })}
                      placeholder="#0D9488"
                      className="w-full min-h-[34px] px-2.5 py-1 rounded-lg bg-[#FAF8EC] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs font-mono font-bold text-[#141413] dark:text-[#FAF8EC] uppercase focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                    />
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#FAF8EC]/60 text-xs font-bold text-[#40403B] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] cursor-pointer transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_SNAPPY}
                  type="submit"
                  className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#0D47FF] hover:bg-[#0936CC] text-white text-xs font-bold border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] dark:shadow-[3px_3px_0px_#FFD426] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Save Pattern</span>
                </motion.button>
              </div>
            </form>
          </div>
        )}
      </MotionModal>

    </MotionPage>
  );
}
