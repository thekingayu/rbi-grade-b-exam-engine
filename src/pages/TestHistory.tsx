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
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-base font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 px-5 py-2.5 rounded-xl border border-white/60 dark:border-white/10 shadow-sm hover:shadow cursor-pointer backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>
      </div>

      {/* Test History */}
      <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-slate-200/50 dark:border-white/10 bg-white/20 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 flex items-center justify-center shadow-sm shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#9A7D3C]" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">All past tests</h3>
              <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Complete historical breakdown</span>
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-200/50 dark:divide-white/10">
          {tests.length === 0 ? (
            <div className="p-8 sm:p-16 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-sm">
                <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
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
                <div key={test.id} className="p-4 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 hover:bg-white/40 dark:hover:bg-white/[0.04] transition-all group border-b border-slate-200/50 dark:border-white/5 last:border-0">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2 sm:mb-3 text-base sm:text-lg">
                      {test.status === 'in-progress' ? 'Test in progress' : `Mock Exam • ${format(test.createdAt, 'MMMM d, yyyy')}`}
                    </h4>
                    {test.status === 'completed' && (
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-sm">
                          MCQ: <span className="text-slate-900 dark:text-white font-bold ml-1">{tMcqAcc}%</span>
                        </div>
                        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-sm">
                          Desc: <span className="text-slate-900 dark:text-white font-bold ml-1">{tDescAcc}%</span>
                        </div>
                        <div className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full backdrop-blur-md border shadow-sm ${timePct >= 95 ? 'bg-red-50/80 dark:bg-red-500/20 border-red-200 dark:border-red-500/30' : 'bg-white/60 dark:bg-white/10 border-white/50 dark:border-white/5'}`}>
                          Time used: <span className={`font-bold ml-1 ${timePct >= 95 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{timePct}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-8 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/50 dark:border-white/5">
                    {test.status === 'completed' && (
                      <div className="text-left md:text-right">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-0.5 uppercase tracking-wider">Total Score</span>
                        <span className="text-2xl sm:text-4xl font-serif font-bold text-slate-900 dark:text-white">{tOverall}%</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 md:flex-initial justify-end">
                      {test.status !== 'completed' && (
                        <button
                          onClick={() => handleTerminate(test.id)}
                          className="h-10 sm:h-12 px-4 sm:px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center transition-all bg-red-50 dark:bg-red-500/10 backdrop-blur-md border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 shadow-md hover:bg-red-100 dark:hover:bg-red-500/20 hover:-translate-y-0.5 whitespace-nowrap"
                        >
                          Terminate
                        </button>
                      )}
                      <Link 
                        to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                        className="h-10 sm:h-12 px-4 sm:px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center transition-all bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-slate-900 dark:text-white shadow-md hover:bg-white/90 dark:hover:bg-white/20 hover:-translate-y-0.5 whitespace-nowrap"
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
