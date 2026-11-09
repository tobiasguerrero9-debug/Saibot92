import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import MiniAppPage from './pages/MiniAppPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ResearchPage from './pages/ResearchPage';
import AugustusPage from './pages/AugustusPage';
import MainnetCanaryPage from './pages/MainnetCanaryPage';
import AugustusProductPage from './pages/AugustusProductPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<MiniAppPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/augustus92" element={import.meta.env.DEV ? <AugustusPage /> : <Navigate to="/augustus" replace />} />
        <Route path="/augustus" element={<AugustusProductPage />} />
        {import.meta.env.DEV && <Route path="/augustus92/canary" element={<MainnetCanaryPage />} />}
      </Routes>
    </BrowserRouter>
  );
}
