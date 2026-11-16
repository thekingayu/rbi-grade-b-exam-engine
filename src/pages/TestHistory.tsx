import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { TestAttempt } from '../types';
import { format } from 'date-fns';
import {
  FileText, ArrowLeft, Download, Search, Check, X, GitCompare, RefreshCw, RotateCcw, Trash2, AlertTriangle
} from 'lucide-react';
import { useSubject } from '../context/SubjectContext';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';
import { isSyncDocument, handleFirestoreError, OperationType } from '../utils/firestore';
import { getFullPhaseDisplayMeta } from '../data/fullPhaseBlueprints';
import { createFreshReattemptTest, clearPreloadedTest, waitForPendingTestWrite } from '../utils/reattempt';
import { FuturisticScreenLoader, FuturisticSpinner } from '../components/FuturisticLoader';
import { motion } from 'motion/react';
import { MotionPage, MotionModal, SPRING_SNAPPY } from '../components/MotionPrimitives';

export function TestHistory({ user }: { user: User }) {
  const [tests, setTests] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const { subjects } = useSubject();
  const navigate = useNavigate();

  // Filters & Search
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Compare attempts (max 2 selected)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Bulk Reassign Legacy Tests
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedForReassign, setSelectedForReassign] = useState<string[]>([]);
  const [targetReassignSubjectId, setTargetReassignSubjectId] = useState<string>(subjects[0]?.id || '');
  const [isReassigning, setIsReassigning] = useState(false);
  const [reattemptingId, setReattemptingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<TestAttempt | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);

  const handleReattempt = async (sourceTest: TestAttempt) => {
    if (reattemptingId) return;
    try {
      setActionError(null);
      setReattemptingId(sourceTest.id);
      const newTestId = await createFreshReattemptTest(sourceTest, user);
      navigate(`/exam/${newTestId}`);
    } catch (err: any) {
      console.error('Failed to reattempt exam:', err);
      setActionError(err?.message || 'Unable to start a fresh reattempt.');
      setReattemptingId(null);
    }
  };

  useEffect(() => {
    const fetchTests = async () => {
      if (!user?.uid) return;
      try {
        const q = query(
          collection(db, 'tests'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const fetchedTests = snapshot.docs
          .filter(d => !isSyncDocument(d.id, d.data()))
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as TestAttempt[];
        
        fetchedTests.sort((a, b) => b.createdAt - a.createdAt);
        setTests(fetchedTests);
      } catch (error) {
        console.error('Error fetching tests:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, [user.uid]);

  const openTerminateModal = (targetTest: TestAttempt) => {
    setTerminateError(null);
    setTerminateTarget(targetTest);
  };

  const confirmTerminate = async () => {
    if (!terminateTarget || terminating) return;
    const targetId = terminateTarget.id;
    setTerminating(true);
    setTerminateError(null);
    try {
      try {
        localStorage.removeItem(`rbi_cbt_state_${targetId}`);
      } catch {
        // Ignore storage errors
      }
      clearPreloadedTest(targetId);

      const writeStatus = await waitForPendingTestWrite(targetId);
      if (writeStatus.ok) {
        await deleteDoc(doc(db, 'tests', targetId));
      }
      setTests(prev => prev.filter(t => t.id !== targetId));
      setTerminateTarget(null);
    } catch (e: any) {
      console.error('Failed to terminate test:', e);
      try {
        handleFirestoreError(e, OperationType.DELETE, `tests/${targetId}`, user);
      } catch {
        // Logged structured Firestore error details
      }
      setTerminateError(e?.message || 'Error terminating test. Please try again.');
    } finally {
      setTerminating(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (tests.length === 0) return;
    const headers = ['Attempt ID', 'Date', 'Subject', 'Mode', 'Status', 'Score %', 'Time Used (s)', 'Questions Count'];
    const rows = tests.map(t => {
      const sub = subjects.find(s => s.id === t.subjectId || s.slug === t.subjectSlug)?.name
        || getFullPhaseDisplayMeta(t.subjectSlug, t.subjectName)?.name
        || 'Unassigned';
      const maxMarks = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
      const scorePct = Math.round(((t.totalScore || 0) / maxMarks) * 100);
      return [
        t.id,
        format(t.createdAt, 'yyyy-MM-dd HH:mm'),
        `"${sub}"`,
        t.mode || 'Standard',
        t.status,
        scorePct,
        t.durationUsedSeconds || t.durationSeconds,
        t.questions?.length || 0
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rbi_grade_b_tests_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Reassign Handler
  const handleBulkReassign = async () => {
    if (selectedForReassign.length === 0) return;
    const targetSub = subjects.find(s => s.id === targetReassignSubjectId);
    if (!targetSub) return;

    setIsReassigning(true);
    try {
      for (const testId of selectedForReassign) {
        await updateDoc(doc(db, 'tests', testId), {
          subjectId: targetSub.id,
          subjectSlug: targetSub.slug,
          subjectName: targetSub.name
        });
      }
      setTests(prev => prev.map(t => {
        if (selectedForReassign.includes(t.id)) {
          return {
            ...t,
            subjectId: targetSub.id,
            subjectSlug: targetSub.slug,
            subjectName: targetSub.name
          };
        }
        return t;
      }));
      const count = selectedForReassign.length;
      setSelectedForReassign([]);
      setShowReassignModal(false);
      setActionError(null);
      setActionNotice(`Successfully reassigned ${count} test${count === 1 ? '' : 's'} to ${targetSub.name}.`);
    } catch (e: any) {
      console.error(e);
      setActionError(e?.message || 'Error reassigning tests. Please try again.');
    } finally {
      setIsReassigning(false);
    }
  };

  // Filtered Tests
  const filteredTests = tests.filter(t => {
    if (subjectFilter !== 'all') {
      const match = t.subjectId === subjectFilter || t.subjectSlug === subjectFilter;
      if (!match) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const subName = t.subjectName
        || subjects.find(s => s.id === t.subjectId || s.slug === t.subjectSlug)?.name
        || getFullPhaseDisplayMeta(t.subjectSlug, t.subjectName)?.name
        || '';
      return subName.toLowerCase().includes(q) || (t.mode || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Attempt Compare Pairs
  const compareTest1 = tests.find(t => t.id === selectedForCompare[0]);
  const compareTest2 = tests.find(t => t.id === selectedForCompare[1]);

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <FuturisticScreenLoader
          title="Exam Attempt Archive"
          subtitle="RETRIEVING HISTORICAL TELEMETRY..."
          color="teal"
        />
      </div>
    );
  }

  return (
    <MotionPage className="space-y-6 max-w-7xl mx-auto pt-2 pb-16 relative z-10">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#66665E] dark:text-[#A3A399] hover:text-[#0D47FF] dark:hover:text-[#ECD5FF] mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] tracking-tight">
            Historical Examination{' '}
            <span className="font-editorial-italic font-normal text-[#0D47FF] dark:text-[#ECD5FF]">
              Archive
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#40403B] dark:text-[#A3A399] mt-0.5">
            Complete record of preliminary mocks, sectional speed drills, and descriptive writing evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {selectedForCompare.length === 2 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowCompareModal(true)}
              className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <GitCompare className="w-3.5 h-3.5 shrink-0" />
              <span>Compare Selected (2)</span>
            </motion.button>
          )}

          <button
            onClick={() => setShowReassignModal(true)}
            className="flex-1 sm:flex-initial min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FFFFFF] dark:bg-[#1C1C1A] hover:border-[#141413] dark:hover:border-[#ECD5FF] text-[#141413] dark:text-[#FAF8EC] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>Reassign Legacy Tests</span>
          </button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border-[1.5px] border-[#141413] shadow-[2px_2px_0px_#141413] flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export CSV</span>
          </motion.button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}
      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}
      <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#66665E] dark:text-[#A3A399] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by subject or mode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-xs text-[#141413] dark:text-[#FAF8EC] placeholder:text-[#66665E] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-mono font-bold text-[#66665E] dark:text-[#A3A399] uppercase shrink-0">Subject:</span>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="flex-1 sm:flex-initial min-h-[40px] text-xs font-bold px-3 py-2 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] cursor-pointer"
          >
            <option value="all">All Subjects ({tests.length})</option>
            <option value="phase-1-full">Full-Length Phase 1 Mock</option>
            <option value="phase-2-full">Full-Length Phase 2 Mock</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tests Table */}
      <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="divide-y divide-[#E5E1CE] dark:divide-[#2E2E2A]">
          {filteredTests.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-[#66665E] dark:text-[#A3A399] mx-auto mb-2" />
              <p className="font-heading font-bold text-lg text-[#141413] dark:text-[#FAF8EC]">No exams found</p>
              <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">Adjust search parameters or launch a new exam.</p>
            </div>
          ) : (
            filteredTests.map(test => {
              const subMatch = subjects.find(s => s.id === test.subjectId || s.slug === test.subjectSlug)
                || getFullPhaseDisplayMeta(test.subjectSlug, test.subjectName)
                || {
                  name: 'Uncategorised',
                  accentColor: '#64748B',
                  icon: 'Layers'
                };

              const mcqQs = test.questions?.filter(q => q.type === 'MCQ') || [];
              const descQs = test.questions?.filter(q => q.type === 'Descriptive') || [];
              const tMcqScore = mcqQs.reduce((sum, q) => sum + Math.max(0, q.score || 0), 0);
              const tMcqMax = mcqQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              const tMcqAcc = tMcqMax > 0 ? Math.round((tMcqScore / tMcqMax) * 100) : 0;

              const tDescScore = descQs.reduce((sum, q) => sum + (test.evaluations?.[q.id || '']?.totalScore || 0), 0);
              const tDescMax = descQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              const tDescAcc = tDescMax > 0 ? Math.round((tDescScore / tDescMax) * 100) : 0;

              const totalMax = tMcqMax + tDescMax;
              const totalPct = totalMax > 0 ? Math.round(((test.totalScore || 0) / totalMax) * 100) : 0;

              const isCheckedForCompare = selectedForCompare.includes(test.id);

              return (
                <div key={test.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 md:gap-4 hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50 transition-colors">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                    {/* Checkbox for Compare */}
                    <input
                      type="checkbox"
                      checked={isCheckedForCompare}
                      onChange={() => {
                        setSelectedForCompare(prev =>
                          isCheckedForCompare
                            ? prev.filter(id => id !== test.id)
                            : prev.length < 2 ? [...prev, test.id] : [prev[1], test.id]
                        );
                      }}
                      className="w-4 h-4 mt-1 sm:mt-0 accent-[#0D47FF] rounded cursor-pointer shrink-0"
                      title="Select to compare (max 2)"
                    />

                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[#141413]/15 dark:border-[#2E2E2A]"
                      style={{
                        backgroundColor: `${subMatch.accentColor}18`,
                        color: subMatch.accentColor
                      }}
                    >
                      <SubjectIcon name={subMatch.icon} className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span
                          className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border"
                          style={{
                            color: subMatch.accentColor,
                            borderColor: `${subMatch.accentColor}45`,
                            backgroundColor: `${subMatch.accentColor}12`
                          }}
                        >
                          {subMatch.name}
                        </span>
                        {test.mode && (
                          <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
                            · {test.mode}
                          </span>
                        )}
                        {test.reattemptOfTestId && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FFD426] text-[#141413] border border-[#141413] text-[9px] font-mono font-bold uppercase tracking-wider">
                            Reattempt
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
                          · {format(test.createdAt, 'MMM d, yyyy · h:mm a')}
                        </span>
                      </div>

                      <h4 className="font-bold text-[#141413] dark:text-[#FAF8EC] text-sm sm:text-base mt-1">
                        {test.status === 'in-progress' ? 'In-Progress Exam' : `Exam Assessment (${test.questions?.length || 0} Questions)`}
                      </h4>

                      {test.status === 'completed' && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#66665E] dark:text-[#A3A399] mt-1 tabular-nums">
                          {mcqQs.length > 0 && <span>MCQ: <strong className="text-[#0D47FF] dark:text-[#ECD5FF]">{tMcqAcc}%</strong></span>}
                          {descQs.length > 0 && <span>Desc: <strong className="text-[#141413] dark:text-[#FFD426]">{tDescAcc}%</strong></span>}
                          <span>Total: <strong className="text-[#141413] dark:text-[#FAF8EC] font-heading">{totalPct}%</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 w-full md:w-auto shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 border-[#E5E1CE]/60 dark:border-[#2E2E2A]/60">
                    {test.status === 'completed' ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleReattempt(test)}
                          disabled={!!reattemptingId || !test.questions || test.questions.length === 0}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border border-[#141413] shadow-[2px_2px_0px_#141413] cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                          title="Start this exact paper again with fresh blank answers"
                        >
                          {reattemptingId === test.id ? (
                            <FuturisticSpinner size="xs" color="cobalt" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{reattemptingId === test.id ? 'Starting...' : 'Reattempt'}</span>
                        </button>
                        <Link
                          to={`/results/${test.id}`}
                          className="flex-1 sm:flex-initial text-center px-4 py-2 rounded-xl text-xs font-bold bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:bg-[#0D47FF] hover:text-white hover:border-[#141413] text-[#141413] dark:text-[#FAF8EC] transition-colors whitespace-nowrap"
                        >
                          View Report
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => openTerminateModal(test)}
                          className="flex-1 sm:flex-initial text-center px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-pointer"
                        >
                          Terminate
                        </button>
                        <Link
                          to={`/exam/${test.id}`}
                          className="flex-1 sm:flex-initial text-center px-4 py-2 rounded-xl text-xs font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border border-[#141413] shadow-[2px_2px_0px_#141413]"
                        >
                          Resume
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Compare Modal */}
      <MotionModal
        isOpen={!!(showCompareModal && compareTest1 && compareTest2)}
        onClose={() => setShowCompareModal(false)}
        maxWidthClass="max-w-2xl"
      >
        {compareTest1 && compareTest2 && (
          <div className="w-full rounded-3xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[2px] border-[#141413] dark:border-[#ECD5FF] p-5 sm:p-6 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF]/40 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E1CE] dark:border-[#2E2E2A] pb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-[#0D47FF] dark:text-[#ECD5FF]" />
                <h3 className="font-heading font-extrabold text-lg text-[#141413] dark:text-[#FAF8EC]">
                  Side-by-Side Attempt Comparison
                </h3>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-1.5 rounded-lg text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] cursor-pointer"
                aria-label="Close compare modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[compareTest1, compareTest2].map((t, i) => {
                const max = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
                const score = Math.round(((t.totalScore || 0) / max) * 100);
                return (
                  <div key={t.id} className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] space-y-2">
                    <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] block uppercase">Attempt {i + 1}</span>
                    <p className="font-bold text-sm text-[#141413] dark:text-[#FAF8EC]">{t.subjectName || 'Exam'}</p>
                    <p className="text-3xl font-heading font-extrabold text-[#0D47FF] dark:text-[#ECD5FF] tabular-nums">{score}%</p>
                    <p className="text-xs text-[#66665E] dark:text-[#A3A399] font-mono">{format(t.createdAt, 'MMM d, yyyy')}</p>
                    <p className="text-xs text-[#66665E] dark:text-[#A3A399]">{t.questions?.length} Questions · {t.mode || 'Standard'}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-[#ECD5FF] border border-[#141413] text-xs font-bold text-[#141413] text-center tabular-nums">
              Delta: {Math.abs(
                Math.round(((compareTest1.totalScore || 0) / (compareTest1.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1)) * 100) -
                Math.round(((compareTest2.totalScore || 0) / (compareTest2.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1)) * 100)
              )}% score differential between attempts.
            </div>
          </div>
        )}
      </MotionModal>

      {/* Bulk Reassign Modal */}
      <MotionModal
        isOpen={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        maxWidthClass="max-w-xl"
      >
        <div className="w-full rounded-3xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[2px] border-[#141413] dark:border-[#ECD5FF] p-5 sm:p-6 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF]/40 space-y-4 max-h-[88vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[#E5E1CE] dark:border-[#2E2E2A] pb-3">
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
              <span>Reassign Legacy Tests to Subject</span>
            </h3>
            <button
              onClick={() => setShowReassignModal(false)}
              className="p-1.5 rounded-lg text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] cursor-pointer"
              aria-label="Close reassign modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-[#40403B] dark:text-[#A3A399]">
            Select any past tests (including previously unassigned ones) and choose the target subject to re-index them into the correct dashboard metrics.
          </p>

          <div>
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block mb-1">
              Target Subject
            </label>
            <select
              value={targetReassignSubjectId}
              onChange={(e) => setTargetReassignSubjectId(e.target.value)}
              className="w-full min-h-[42px] p-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] cursor-pointer"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phase})
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] rounded-xl p-2">
            {tests.map(t => {
              const isSelected = selectedForReassign.includes(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedForReassign(prev =>
                      isSelected ? prev.filter(id => id !== t.id) : [...prev, t.id]
                    );
                  }}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#ECD5FF] border-[#141413] text-[#141413] font-bold'
                      : 'border-[#E5E1CE] dark:border-[#2E2E2A] text-[#40403B] dark:text-[#D5D5C8]'
                  }`}
                >
                  <span>{format(t.createdAt, 'MMM d, yyyy')} · {t.subjectName || 'Unassigned'}</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#0D47FF] border-[#141413] text-white' : 'border-[#66665E]'}`}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs font-mono text-[#66665E] dark:text-[#A3A399]">
              {selectedForReassign.length} tests selected
            </span>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleBulkReassign}
              disabled={isReassigning || selectedForReassign.length === 0}
              className="min-h-[40px] px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] cursor-pointer disabled:opacity-50"
            >
              {isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}
            </motion.button>
          </div>
        </div>
      </MotionModal>

      {/* Terminate In-Progress Attempt Confirmation Modal */}
      <MotionModal
        isOpen={!!terminateTarget}
        onClose={() => !terminating && setTerminateTarget(null)}
        maxWidthClass="max-w-sm"
      >
        {terminateTarget && (
          <div className="bg-[#FAF8EC] dark:bg-[#1C1C1A] rounded-3xl w-full p-6 sm:p-8 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF]/40 border-[2px] border-[#141413] dark:border-[#ECD5FF]">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
                Terminate Attempt?
              </h3>
            </div>
            <p className="text-[#40403B] dark:text-[#A3A399] font-medium mb-4 leading-relaxed text-sm">
              This will permanently delete your in-progress attempt
              {terminateTarget.subjectName ? ` for ${terminateTarget.subjectName}` : ''}.
              {terminateTarget.reattemptOfTestId ? ' Your original past exam results remain untouched.' : ''}
            </p>
            {terminateError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
                {terminateError}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={confirmTerminate}
                disabled={terminating}
                className="w-full min-h-[46px] py-3 font-bold bg-rose-600 hover:bg-rose-700 text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 text-sm"
              >
                {terminating ? (
                  <FuturisticSpinner size="xs" color="white" />
                ) : (
                  <Trash2 className="w-4 h-4 shrink-0" />
                )}
                <span>{terminating ? 'Terminating...' : 'Confirm Terminate & Delete'}</span>
              </motion.button>
              <button
                onClick={() => setTerminateTarget(null)}
                disabled={terminating}
                className="w-full min-h-[44px] py-2.5 font-bold text-[#141413] dark:text-[#FAF8EC] bg-[#FFFFFF] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] rounded-xl transition-colors cursor-pointer text-sm"
              >
                Keep Attempt
              </button>
            </div>
          </div>
        )}
      </MotionModal>

    </MotionPage>
  );
}
