import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import MiniAppPage from './pages/MiniAppPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ResearchPage from './pages/ResearchPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<MiniAppPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/research" element={<ResearchPage />} />
      </Routes>
    </BrowserRouter>
  );
}
