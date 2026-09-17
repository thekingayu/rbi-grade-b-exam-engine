import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { TestAttempt } from '../types';
import { Plus, Clock, FileText, CheckCircle, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';

export function Dashboard({ user }: { user: User }) {
  const [tests, setTests] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTests = async () => {
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

  const completedTests = tests.filter(t => t.status === 'completed');
  const avgScore = completedTests.length > 0 
    ? completedTests.reduce((acc, t) => acc + (t.totalScore || 0), 0) / completedTests.length 
    : 0;

  if (loading) {
    return <div className="flex justify-center py-20">Loading...</div>;
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl mx-auto pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">
            Welcome back, {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Student'}
          </h1>
        </div>
        <Link 
          to="/new" 
          className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-6 py-3 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Start New Exam</span>
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Your Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Average Score</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{avgScore.toFixed(0)}%</p>
          </div>
          <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Tests</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{completedTests.length}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Tests</h2>
        {tests.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">No tests yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Upload your notes to generate your first mock exam.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map(test => {
              const mcqQs = test.questions?.filter(q => q.type === 'MCQ') || [];
              const descQs = test.questions?.filter(q => q.type === 'Descriptive') || [];
              
              const mcqScore = mcqQs.reduce((sum, q) => sum + Math.max(0, q.score || 0), 0);
              const mcqMax = mcqQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              
              const descScore = descQs.reduce((sum, q) => sum + Math.max(0, q.score || 0), 0);
              const descMax = descQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              
              const totalMax = mcqMax + descMax;
              const overallPercent = totalMax > 0 ? Math.round(((test.totalScore || 0) / totalMax) * 100) : 0;

              return (
                <div key={test.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-shadow hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-slate-900/20">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-slate-900 dark:text-white mb-1">
                      {test.status === 'in-progress' ? 'Test in progress' : 'Economics Notes Test'}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      {test.status === 'completed' && (
                        <>
                          <span>MCQs {mcqScore}/{mcqMax}</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>Descriptive {descScore}/{descMax}</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                        </>
                      )}
                      <span>{format(test.createdAt, 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {test.status === 'completed' && (
                      <div className="text-right">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{overallPercent}%</span>
                      </div>
                    )}
                    <Link 
                      to={test.status === 'completed' ? `/results/${test.id}` : `/exam/${test.id}`}
                      className={`px-5 py-2 rounded-lg font-medium transition-colors ${
                        test.status === 'completed' 
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700' 
                          : 'bg-[#9A7D3C] text-white hover:bg-[#856930]'
                      }`}
                    >
                      {test.status === 'completed' ? 'View Results' : 'Resume Test'}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center gap-4">
      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}
