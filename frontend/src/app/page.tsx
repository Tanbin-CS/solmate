"use client";
import { useState } from 'react';
import StoryBanner from '@/components/StoryBanner';
import { Crosshair, Database, Activity, SlidersHorizontal, Map, Rocket } from 'lucide-react';

export default function MissionControl() {
  const [geologyWeight, setGeologyWeight] = useState(80);
  const [environmentWeight, setEnvironmentWeight] = useState(90);
  
  return (
    <main className="min-h-screen p-4 md:p-8 font-sans max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-8 border-b border-space-700 pb-4">
        <div className="flex items-center gap-3">
          <Rocket className="text-accent-cyan" size={32} />
          <div>
            <h1 className="text-3xl font-bold tracking-tighter text-white">SolMate</h1>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Team Northern Lights // Planetary Analog Pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-accent-cyan bg-accent-cyan/10 px-4 py-2 rounded border border-accent-cyan/20">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse"></div> Live API Sync Active</span>
        </div>
      </header>

      <StoryBanner />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Data Ingestion & Target */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-space-800 border border-space-700 rounded-lg p-0 overflow-hidden">
            <div className="bg-space-900 p-3 border-b border-space-700 flex justify-between items-center">

<Map size={14} />
<span className="font-mono text-xs text-gray-400 flex items-center gap-2"> PHASE ONE & TWO: DIGITAL DISCOVERY & CHARACTERIZATION</span>
              <span className="font-mono text-xs text-accent-amber">TARGET: JEZERO CRATER, MARS</span>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 h-[400px]">
               {/* Placeholders for 3D Viewers (CesiumJS/MapLibre) */}
               <div className="bg-space-900 border border-space-700 rounded flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">NASA PDS Search API</span>
                    <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">SHARAD Radar</span>
                    <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">MOLA DEM</span>
                  </div>
                  <Crosshair className="text-accent-mars opacity-20 mb-2" size={48} />
                  <span className="text-gray-500 font-mono text-sm">Martian Target Feed</span>
               </div>
               <div className="bg-space-900 border border-space-700 rounded flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">NASA ASTER / EMIT</span>
                    <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">ESA Sentinel-2</span>
                  </div>
                  <Activity className="text-accent-cyan opacity-20 mb-2" size={48} />
                  <span className="text-gray-500 font-mono text-sm">Earth Analog Overlay</span>
               </div>
            </div>
          </div>

          <div className="bg-space-800 border border-space-700 rounded-lg p-6">
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Database size={18} className="text-accent-cyan" /> Ranked Terrestrial Analogs</h3>
             <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-space-700 text-gray-400 font-mono text-xs">
                    <th className="pb-3">Candidate Site</th>
                    <th className="pb-3">Match Score</th>
                    <th className="pb-3">Spectral Fit</th>
                    <th className="pb-3">Topography</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-space-700/50 hover:bg-space-700/30 transition-colors">
                    <td className="py-3 font-semibold text-white">Lake Salda, Turkey</td>
                    <td className="py-3"><span className="text-accent-cyan font-mono">89.4%</span></td>
                    <td className="py-3">96% (Carbonates)</td>
                    <td className="py-3">81%</td>
                  </tr>
                  <tr className="border-b border-space-700/50 hover:bg-space-700/30 transition-colors">
                    <td className="py-3 font-semibold text-white">Atacama, Chile</td>
                    <td className="py-3"><span className="text-accent-amber font-mono">86.1%</span></td>
                    <td className="py-3">82% (Sulfates)</td>
                    <td className="py-3">88%</td>
                  </tr>
                </tbody>
             </table>
          </div>
        </div>

        {/* Right Column: Mission Planning */}
        <div className="space-y-6">
          <div className="bg-space-800 border border-space-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><SlidersHorizontal size={18} className="text-accent-cyan" /> POMDP Mission Planner</h3>
            <p className="text-xs text-gray-400 mb-6">Adjust priority weights to recalculate Spectral Angle Mapper outputs and Bayesian surprise estimations.</p>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-mono text-gray-300">Geology / Mineralogy</span>
                  <span className="text-accent-cyan">{geologyWeight}%</span>
                </div>
                <input type="range" min="0" max="100" value={geologyWeight} onChange={(e) => setGeologyWeight(Number(e.target.value))} className="w-full accent-accent-cyan" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-mono text-gray-300">Environment (Thermal/Humidity)</span>
                  <span className="text-accent-amber">{environmentWeight}%</span>
                </div>
                <input type="range" min="0" max="100" value={environmentWeight} onChange={(e) => setEnvironmentWeight(Number(e.target.value))} className="w-full accent-accent-amber" />
              </div>
            </div>
          </div>

          <div className="bg-space-800 border border-space-700 rounded-lg p-6">
             <h3 className="text-sm font-bold text-gray-400 mb-4 font-mono uppercase">API Telemetry Stream</h3>
             <div className="space-y-3 font-mono text-[10px] text-gray-500 overflow-y-auto max-h-[200px]">
               <div className="border-l-2 border-accent-cyan pl-2">
                 <span className="text-accent-cyan">OK</span> [2026-10-10] Connected: NASA PDS Search API
               </div>
               <div className="border-l-2 border-accent-cyan pl-2">
                 <span className="text-accent-cyan">OK</span> [2026-10-10] Fetching: LEND hydrogen distributions
               </div>
               <div className="border-l-2 border-accent-cyan pl-2">
                 <span className="text-accent-cyan">OK</span> [2026-10-10] Ingesting: MOLA & LOLA elevation models
               </div>
               <div className="border-l-2 border-accent-amber pl-2">
                 <span className="text-accent-amber">WARN</span> [2026-10-10] Diviner/THEMIS thermal data sparse in current sector
               </div>
             </div>
          </div>
        </div>
      </div>
    </main>
  );
}