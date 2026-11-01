import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { TestAttempt } from '../types';
import { format } from 'date-fns';
import { Clock, FileText, ArrowLeft } from 'lucide-react';

export function TestHistory({ user }: { user: User }) {
  const [tests, setTests] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500 font-medium">Loading history...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pt-2 pb-16 relative z-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all bg-white/70 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:border-[#9A7D3C]/40 cursor-pointer backdrop-blur-md w-fit"
        >
          <ArrowLeft className="w-4 h-4 text-[#9A7D3C]" /> Back to Dashboard
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9A7D3C]/10 dark:bg-[#9A7D3C]/20 border border-[#9A7D3C]/30 dark:border-[#9A7D3C]/40 backdrop-blur-md">
          <Clock className="w-3.5 h-3.5 text-[#9A7D3C] dark:text-[#E5C378]" />
          <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-amber-200 tracking-wider uppercase">
            HISTORICAL ATTEMPTS ARCHIVE
          </span>
        </div>
      </div>

      {/* Test History Card */}
      <div className="relative bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-[0_0_35px_-10px_rgba(0,0,0,0.7)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9A7D3C]/40 to-transparent pointer-events-none" />
        
        <div className="flex items-center justify-between p-4 sm:p-7 border-b border-slate-200/60 dark:border-white/10 bg-white/30 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-[#9A7D3C] dark:text-[#E5C378] border border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">All past tests</h3>
              <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Complete chronological evaluation log</span>
            </div>
          </div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-sm">
            Total: {tests.length} attempts
          </div>
        </div>
        <div className="divide-y divide-slate-200/60 dark:divide-white/10">
          {tests.length === 0 ? (
            <div className="p-8 sm:p-16 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-[#9A7D3C] dark:text-[#E5C378] border border-amber-500/20 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-[#9A7D3C] dark:text-[#E5C378]" />
              </div>
              <p className="text-xl sm:text-2xl font-serif font-bold text-slate-900 dark:text-white">No tests taken yet</p>
              <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-xs sm:text-base">Start a new exam to see your history here.</p>
            </div>
          ) : (
            tests.map(test => {
              const mcqQs = test.questions?.filter(q => q.type === 'MCQ') || [];
              const descQs = test.questions?.filter(q => q.type === 'Descriptive') || [];
              
              const tMcqScore = mcqQs.reduce((sum, q) => sum + Math.max(0, q.score || 0), 0);
              const tMcqMax = mcqQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              const tMcqAcc = tMcqMax > 0 ? Math.round((tMcqScore / tMcqMax) * 100) : 0;
              
              const tDescScore = descQs.reduce((sum, q) => {
                const qId = q.id || test.questions?.indexOf(q).toString();
                return sum + (test.evaluations?.[qId]?.totalScore || 0);
              }, 0);
              const tDescMax = descQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              const tDescAcc = tDescMax > 0 ? Math.round((tDescScore / tDescMax) * 100) : 0;
              
              const tTotalMax = tMcqMax + tDescMax;
              const tOverall = tTotalMax > 0 ? Math.round(((test.totalScore || 0) / tTotalMax) * 100) : 0;

              const timeUsedSecs = ((test.submittedAt || 0) - (test.startedAt || 0)) / 1000;
              const allotted = test.durationSeconds || 1;
              const timePct = Math.min(100, Math.max(0, Math.round((timeUsedSecs / allotted) * 100)));

              return (
                <div key={test.id} className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 hover:bg-white/50 dark:hover:bg-white/[0.03] transition-all group border-b border-slate-200/60 dark:border-white/5 last:border-0">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2 sm:mb-2.5 text-base sm:text-lg">
                      {test.status === 'in-progress' ? 'Test in progress' : `Mock Exam • ${format(test.createdAt, 'MMMM d, yyyy')}`}
                    </h4>
                    {test.status === 'completed' && (
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                        <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200/80 dark:border-white/10 px-3 py-1 rounded-full shadow-xs">
                          MCQ: <span className="text-[#9A7D3C] dark:text-[#E5C378] font-bold ml-1">{tMcqAcc}%</span>
                        </div>
                        <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200/80 dark:border-white/10 px-3 py-1 rounded-full shadow-xs">
                          Desc: <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">{tDescAcc}%</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full backdrop-blur-md border shadow-xs ${timePct >= 95 ? 'bg-red-50/80 dark:bg-red-500/20 border-red-200 dark:border-red-500/30' : 'bg-white/80 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/10'}`}>
                          Time: <span className={`font-bold ml-1 ${timePct >= 95 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{timePct}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-8 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-white/5">
                    {test.status === 'completed' && (
                      <div className="text-left md:text-right">
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 block mb-0.5 uppercase tracking-wider">Total Score</span>
                        <span className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white">{tOverall}%</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 md:flex-initial justify-end">
                      {test.status !== 'completed' && (
                        <button
                          onClick={() => handleTerminate(test.id)}
                          className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center transition-all bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-600 dark:text-red-400 cursor-pointer whitespace-nowrap"
                        >
                          Terminate
                        </button>
                      )}
                      <Link 
                        to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                        className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center transition-all bg-gradient-to-r from-[#9A7D3C] to-amber-600 hover:from-[#886d33] hover:to-[#9A7D3C] text-white shadow-md shadow-[#9A7D3C]/20 hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
                      >
                        {test.status === 'completed' ? 'View Results' : 'Resume'}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
