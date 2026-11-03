import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { TestAttempt } from '../types';
import { format } from 'date-fns';
import { 
  Clock, FileText, ArrowLeft, Download, SlidersHorizontal, 
  Search, ArrowRight, Check, X, GitCompare, RefreshCw 
} from 'lucide-react';
import { useSubject } from '../context/SubjectContext';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';
import { Spinner } from 'sketchbook-ui';

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

  useEffect(() => {
    const fetchTests = async () => {
      if (!user?.uid) return;
      try {
        const q = query(
          collection(db, 'tests'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const fetchedTests = snapshot.docs.map(doc => ({
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

  const handleTerminate = async (testId: string) => {
    if (!window.confirm("Are you sure you want to terminate and delete this in-progress test?")) return;
    try {
      await deleteDoc(doc(db, 'tests', testId));
      setTests(prev => prev.filter(t => t.id !== testId));
    } catch (e) {
      console.error(e);
      alert("Error terminating test. Please try again.");
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (tests.length === 0) return;
    const headers = ['Attempt ID', 'Date', 'Subject', 'Mode', 'Status', 'Score %', 'Time Used (s)', 'Questions Count'];
    const rows = tests.map(t => {
      const sub = subjects.find(s => s.id === t.subjectId || s.slug === t.subjectSlug)?.name || 'Unassigned';
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
      setSelectedForReassign([]);
      setShowReassignModal(false);
      alert(`Successfully reassigned ${selectedForReassign.length} tests to ${targetSub.name}!`);
    } catch (e) {
      console.error(e);
      alert("Error reassigning tests. Please try again.");
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
      const subName = t.subjectName || subjects.find(s => s.id === t.subjectId || s.slug === t.subjectSlug)?.name || '';
      return subName.toLowerCase().includes(q) || (t.mode || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Attempt Compare Pairs
  const compareTest1 = tests.find(t => t.id === selectedForCompare[0]);
  const compareTest2 = tests.find(t => t.id === selectedForCompare[1]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500 font-medium gap-3">
        <Spinner variant="spiral" size="lg" colors={{ stroke: '#0D9488' }} />
        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Loading Test History...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pt-2 pb-16 relative z-10">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white">
            Historical Examination Archive
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Complete record of preliminary mocks, sectional speed drills, and descriptive writing evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedForCompare.length === 2 && (
            <button
              onClick={() => setShowCompareModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-all animate-pulse"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Selected (2)</span>
            </button>
          )}

          <button
            onClick={() => setShowReassignModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reassign Legacy Tests</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#070B19]/80 border border-slate-200/80 dark:border-white/10 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by subject or mode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs font-mono text-slate-400">Subject:</span>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="all">All Subjects ({tests.length})</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tests Table */}
      <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
        <div className="divide-y divide-slate-200/60 dark:divide-white/10">
          {filteredTests.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="font-serif font-bold text-lg text-slate-900 dark:text-white">No exams found</p>
              <p className="text-xs text-slate-500 mt-1">Adjust search parameters or launch a new exam.</p>
            </div>
          ) : (
            filteredTests.map(test => {
              const subMatch = subjects.find(s => s.id === test.subjectId || s.slug === test.subjectSlug) || {
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
                <div key={test.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3.5">
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
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                      title="Select to compare (max 2)"
                    />

                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${subMatch.accentColor}18`,
                        borderColor: `${subMatch.accentColor}35`,
                        color: subMatch.accentColor
                      }}
                    >
                      <SubjectIcon name={subMatch.icon} className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span 
                          className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border"
                          style={{
                            color: subMatch.accentColor,
                            borderColor: `${subMatch.accentColor}35`,
                            backgroundColor: `${subMatch.accentColor}10`
                          }}
                        >
                          {subMatch.name}
                        </span>
                        {test.mode && (
                          <span className="text-[10px] font-mono text-slate-400">
                            · {test.mode}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          · {format(test.createdAt, 'MMM d, yyyy · h:mm a')}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base mt-1">
                        {test.status === 'in-progress' ? 'In-Progress Exam' : `Exam Assessment (${test.questions?.length || 0} Questions)`}
                      </h4>

                      {test.status === 'completed' && (
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          {mcqQs.length > 0 && <span>MCQ: <strong className="text-teal-600 dark:text-teal-400">{tMcqAcc}%</strong></span>}
                          {descQs.length > 0 && <span>Desc: <strong className="text-indigo-600 dark:text-indigo-400">{tDescAcc}%</strong></span>}
                          <span>Total: <strong className="text-slate-900 dark:text-white font-serif">{totalPct}%</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3">
                    {test.status === 'completed' ? (
                      <Link
                        to={`/results/${test.id}`}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 text-slate-800 dark:text-slate-200 transition-colors"
                      >
                        View Report
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTerminate(test.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 cursor-pointer"
                        >
                          Terminate
                        </button>
                        <Link
                          to={`/exam/${test.id}`}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-xs"
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
      {showCompareModal && compareTest1 && compareTest2 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in"
          onClick={() => setShowCompareModal(false)}
        >
          <div 
            className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-indigo-500" />
                <h3 className="font-serif font-black text-lg text-slate-900 dark:text-white">
                  Side-by-Side Attempt Comparison
                </h3>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
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
                  <div key={t.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Attempt {i + 1}</span>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{t.subjectName || 'Exam'}</p>
                    <p className="text-3xl font-serif font-black text-teal-600 dark:text-teal-300">{score}%</p>
                    <p className="text-xs text-slate-500 font-mono">{format(t.createdAt, 'MMM d, yyyy')}</p>
                    <p className="text-xs text-slate-500">{t.questions?.length} Questions · {t.mode || 'Standard'}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-900 dark:text-indigo-200 text-center">
              Delta: {Math.abs(
                Math.round(((compareTest1.totalScore || 0) / (compareTest1.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1)) * 100) -
                Math.round(((compareTest2.totalScore || 0) / (compareTest2.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1)) * 100)
              )}% score differential between attempts.
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reassign Modal */}
      {showReassignModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in"
          onClick={() => setShowReassignModal(false)}
        >
          <div 
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="font-serif font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-teal-600" />
                <span>Reassign Legacy Tests to Subject</span>
              </h3>
              <button
                onClick={() => setShowReassignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                aria-label="Close reassign modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select any past tests (including previously unassigned ones) and choose the target subject to re-index them into the correct dashboard metrics.
            </p>

            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Target Subject
              </label>
              <select
                value={targetReassignSubjectId}
                onChange={(e) => setTargetReassignSubjectId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.phase})</option>
                ))}
              </select>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-white/10 rounded-xl p-2">
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
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-teal-500/15 border-teal-500 text-teal-900 dark:text-teal-200'
                        : 'border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{format(t.createdAt, 'MMM d, yyyy')} · {t.subjectName || 'Unassigned'}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-teal-600 text-white' : 'border-slate-300'}`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono text-slate-400">
                {selectedForReassign.length} tests selected
              </span>
              <button
                onClick={handleBulkReassign}
                disabled={isReassigning || selectedForReassign.length === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md cursor-pointer disabled:opacity-50"
              >
                {isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
