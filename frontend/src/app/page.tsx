"use client";
import { useState, useEffect } from 'react';
import StoryBanner from '@/components/StoryBanner';
import InteractiveAnalogMap from '@/components/InteractiveAnalogMap';
import { Crosshair, Database, Activity, SlidersHorizontal, Map, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MissionControl() {
  const [geologyWeight, setGeologyWeight] = useState(80);
  const [environmentWeight, setEnvironmentWeight] = useState(90);
  
  // New State for Django API Data
  const [analogs, setAnalogs] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<string>("Connecting to Backend...");

  // Fetch from Django on component mount
  useEffect(() => {
    const fetchAnalogData = async () => {
      try {
        // REPLACE THIS URL WITH YOUR ACTUAL RENDER URL
        const response = await fetch('https://solmate-api.onrender.com');
        const data = await response.json();
        setAnalogs(data.analogs);
        setTelemetry(data.telemetry_status);
      } catch (error) {
        console.error("Backend connection failed:", error);
        setTelemetry("Offline");
      }
    };
    fetchAnalogData();
  }, []);
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-screen bg-space-900 flex flex-col">
      <main className="flex-grow p-4 md:p-8 font-sans max-w-7xl mx-auto w-full overflow-hidden">
        <motion.header 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex justify-between items-center mb-8 border-b border-space-700 pb-4"
        >
          <div className="flex items-center gap-3">
            <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Rocket className="text-accent-cyan" size={32} />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold tracking-tighter text-white">SolMate</h1>
              <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Team Northern Lights // Planetary Analog Pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs text-accent-cyan bg-accent-cyan/10 px-4 py-2 rounded border border-accent-cyan/20">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse"></div> API: {telemetry}</span>
          </div>
        </motion.header>

        <StoryBanner />

        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div variants={item} className="bg-space-800 border border-space-700 rounded-lg p-0 overflow-hidden shadow-lg">
              <div className="bg-space-900 p-3 border-b border-space-700 flex justify-between items-center">

<Map size={14} />
<span className="font-mono text-xs text-gray-400 flex items-center gap-2"> PHASE ONE & TWO: DIGITAL DISCOVERY</span>
                <span className="font-mono text-xs text-accent-amber animate-pulse">TARGET: JEZERO CRATER, MARS</span>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 h-[400px]">
                 <div className="bg-space-900 border border-space-700 rounded flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 opacity-70 group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">NASA PDS API</span>
                      <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">SHARAD Radar</span>
                    </div>
                    <Crosshair className="text-accent-mars opacity-20 group-hover:opacity-60 transition-opacity mb-2 group-hover:scale-110 duration-300" size={48} />
                    <span className="text-gray-500 font-mono text-sm">Martian Target Feed</span>
                 </div>
                 <div className="bg-space-900 border border-space-700 rounded flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 opacity-70 group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">NASA ASTER / EMIT</span>
                      <span className="bg-black/80 px-2 py-1 text-[10px] font-mono border border-gray-800 text-gray-300">ESA Sentinel-2</span>
                    </div>
                    <Activity className="text-accent-cyan opacity-20 group-hover:opacity-60 transition-opacity mb-2 group-hover:scale-110 duration-300" size={48} />
                    <span className="text-gray-500 font-mono text-sm">Earth Analog Overlay</span>
                 </div>
              </div>
            </motion.div>

            <motion.div variants={item} className="bg-space-800 border border-space-700 rounded-lg p-6">
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
                    {analogs.map((analog) => (
                      <motion.tr 
                        key={analog.site_id}
                        whileHover={{ backgroundColor: "rgba(26, 32, 44, 0.8)", x: 5 }} 
                        className="border-b border-space-700/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 font-semibold text-white">{analog.name}</td>
                        <td className="py-3">
                          <span className="text-accent-cyan font-mono font-bold">
                            {(analog.match_score * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3">{analog.spectral_fit}</td>
                        <td className="py-3">{analog.topography_score}%</td>
                      </motion.tr>
                    ))}
                    {analogs.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-center text-gray-500 font-mono">Awaiting API Data...</td></tr>
                    )}
                  </tbody>
               </table>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <motion.div variants={item} className="bg-space-800 border border-space-700 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><SlidersHorizontal size={18} className="text-accent-cyan" /> POMDP Mission Planner</h3>
              <p className="text-xs text-gray-400 mb-6">Adjust priority weights to recalculate Spectral Angle Mapper outputs.</p>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-mono text-gray-300">Geology / Mineralogy</span>
                    <span className="text-accent-cyan font-bold">{geologyWeight}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={geologyWeight} onChange={(e) => setGeologyWeight(Number(e.target.value))} className="w-full h-2 bg-space-900 rounded-lg appearance-none cursor-pointer accent-accent-cyan" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-mono text-gray-300">Environment (Thermal)</span>
                    <span className="text-accent-amber font-bold">{environmentWeight}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={environmentWeight} onChange={(e) => setEnvironmentWeight(Number(e.target.value))} className="w-full h-2 bg-space-900 rounded-lg appearance-none cursor-pointer accent-accent-amber" />
                </div>
              </div>
            </motion.div>

            <motion.div variants={item} className="bg-space-800 border border-space-700 rounded-lg p-6">
               <h3 className="text-sm font-bold text-gray-400 mb-4 font-mono uppercase tracking-widest">API Telemetry Stream</h3>
               <div className="space-y-3 font-mono text-[10px] text-gray-500 overflow-y-auto max-h-[200px]">
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="border-l-2 border-accent-cyan pl-2">
                   <span className="text-accent-cyan">OK</span> [{new Date().toISOString().split('T')[0]}] Connected: NASA PDS Search API
                 </motion.div>
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="border-l-2 border-accent-cyan pl-2">
                   <span className="text-accent-cyan">OK</span> [{new Date().toISOString().split('T')[0]}] Fetching: LEND hydrogen distributions
                 </motion.div>
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="border-l-2 border-accent-amber pl-2">
                   <span className="text-accent-amber">WARN</span> [{new Date().toISOString().split('T')[0]}] Diviner/THEMIS thermal data sparse
                 </motion.div>
               </div>
            </motion.div>
          </div>
        </motion.div>

        {/* The New Interactive Map Section */}
        <motion.div variants={item} initial="hidden" animate="show">
          <InteractiveAnalogMap />
        </motion.div>

      </main>

      {/* Footer Section */}
      <footer className="w-full border-t border-space-700 bg-space-800 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-70">
            <Rocket className="text-gray-400" size={20} />
            <span className="text-gray-400 font-bold text-sm tracking-widest">SOLMATE</span>
          </div>
          <p className="text-xs text-gray-500 font-mono text-center">
            Built for the <span className="text-accent-cyan">NASA Space Apps Challenge</span>. 
            Powered by open planetary data from NASA, ESA, and partner agencies.
          </p>
          <div className="text-xs text-gray-500 font-mono">
            &copy; {new Date().getFullYear()} Team Northern Lights
          </div>
        </div>
      </footer>
    </div>
  );
}