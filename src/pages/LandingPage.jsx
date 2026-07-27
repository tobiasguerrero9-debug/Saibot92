import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import SectionReads from '../components/SectionReads';
import SectionPurpleContext from '../components/SectionPurpleContext';
import SectionMiniAppPreview from '../components/SectionMiniAppPreview';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-purple-600 selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <SectionReads />
        <SectionPurpleContext />
        <SectionMiniAppPreview />
      </main>
      <Footer />
    </div>
  );
}
