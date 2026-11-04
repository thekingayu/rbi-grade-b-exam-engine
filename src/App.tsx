/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SubjectDashboard } from './pages/SubjectDashboard';
import { TestHistory } from './pages/TestHistory';
import { NewTest } from './pages/NewTest';
import { MistakeNotebook } from './pages/MistakeNotebook';
import { ManageSubjects } from './pages/ManageSubjects';
import { Exam } from './pages/Exam';
import { Results } from './pages/Results';
import { Profile } from './pages/Profile';
import { SmoothScroll } from './components/SmoothScroll';
import { SubjectProvider } from './context/SubjectContext';
import { SketchProvider, Spinner } from 'sketchbook-ui';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#030612] text-slate-800 dark:text-slate-100 gap-4">
        <div className="p-6 rounded-2xl bg-white/70 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 backdrop-blur-xl shadow-lg flex flex-col items-center gap-3">
          <Spinner variant="spiral" size="lg" colors={{ stroke: '#0D9488' }} />
          <div className="text-center">
            <p className="font-serif font-bold text-base text-slate-900 dark:text-white">RBI Grade B Engine</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wider mt-0.5">INITIALIZING CADRE WORKSPACE...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SubjectProvider>
      <SketchProvider>
        <BrowserRouter>
          <SmoothScroll>
            <Routes>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
              <Route path="/exam/:testId" element={user ? <Exam user={user} /> : <Navigate to="/login" />} />
              <Route path="/" element={user ? <Layout user={user} /> : <Navigate to="/login" />}>
                <Route index element={<Dashboard user={user} />} />
                <Route path="subject/:slug" element={<SubjectDashboard user={user} />} />
                <Route path="new" element={<NewTest user={user} />} />
                <Route path="exam/new" element={<NewTest user={user} />} />
                <Route path="history" element={<TestHistory user={user} />} />
                <Route path="archive" element={<TestHistory user={user} />} />
                <Route path="mistakes" element={<MistakeNotebook user={user} />} />
                <Route path="manage-subjects" element={<ManageSubjects user={user} />} />
                <Route path="results/:testId" element={<Results user={user} />} />
                <Route path="profile" element={<Profile user={user} />} />
              </Route>
            </Routes>
          </SmoothScroll>
        </BrowserRouter>
      </SketchProvider>
    </SubjectProvider>
  );
}
