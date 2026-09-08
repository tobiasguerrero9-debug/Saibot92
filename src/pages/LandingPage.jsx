import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ProductValueStrip from '../components/ProductValueStrip';
import SectionReads from '../components/SectionReads';
import SectionAgentExperience from '../components/SectionAgentExperience';
import SectionChromeCompanion from '../components/SectionChromeCompanion';
import SectionPurpleContext from '../components/SectionPurpleContext';
import SectionMiniAppPreview from '../components/SectionMiniAppPreview';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFC] text-[#12141A] font-sans selection:bg-[#7C3AED] selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <ProductValueStrip />
        <SectionReads />
        <SectionAgentExperience />
        <SectionChromeCompanion />
        <SectionPurpleContext />
        <SectionMiniAppPreview />
      </main>
      <Footer />
    </div>
  );
}
