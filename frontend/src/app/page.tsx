"use client";
import { useState, useEffect } from 'react';
import { Database, Activity, SlidersHorizontal, Map, Rocket, Search, Globe, Target } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MissionControl() {
  const [geologyWeight, setGeologyWeight] = useState(80);
  const [environmentWeight, setEnvironmentWeight] = useState(90);
  
  // Search & API State
  const [searchInput, setSearchInput] = useState("");
  const [activeTarget, setActiveTarget] = useState("jezero");
  
  const [analogs, setAnalogs] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<string>("Connecting to Backend...");
  const [marsImage, setMarsImage] = useState<string>("");
  const [earthImage, setEarthImage] = useState<string>("");

  // Fires dynamically whenever `activeTarget` changes via the search bar or buttons
  useEffect(() => {
    const fetchAnalogData = async () => {
      try {
        const response = await fetch(`https://solmate-api.onrender.com/api/v1/match/?target=${activeTarget}`);
        const data = await response.json();
        setAnalogs(data.analogs);
        setTelemetry(data.telemetry_status);
        setMarsImage(data.mars_image_url);
        setEarthImage(data.earth_image_url);
      } catch (error) {
        console.error("Backend connection failed:", error);
        setTelemetry("Offline");
      }
    };
    fetchAnalogData();
  }, [activeTarget]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) setActiveTarget(searchInput.trim().toLowerCase());
  };
  
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <main className="max-w-7xl mx-auto w-full p-4 md:p-8">
        
        {/* Header - Light Theme */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-slate-200 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <Rocket className="text-blue-600" size={36} />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">SolMate</h1>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Planetary Analog Pipeline</p>
            </div>
          </div>
          
          {/* Functional Search Bar */}
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <input 
              type="text" 
              placeholder="Search targets (e.g., Gale, Malapert)..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-full border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <button type="submit" className="hidden">Search</button>
          </form>

          <div className="flex items-center gap-2 font-mono text-xs text-blue-700 bg-blue-50 px-4 py-2 rounded-full border border-blue-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div> API: {telemetry}
          </div>
        </header>

        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Full Width Responsive Images */}
          <div className="lg:col-span-2 space-y-8">
            
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2"><Target className="text-blue-600" size={20}/> Target & Analog Overlays</h2>
                <span className="font-mono text-xs text-orange-600 font-bold bg-orange-50 px-3 py-1 rounded-full uppercase">Target: {activeTarget}</span>
              </div>
              
              {/* Responsive Aspect-Video Image Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-100 border border-slate-200 group">
                    <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                      <span className="bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-mono rounded shadow-sm text-slate-700">NASA PDS API</span>
                    </div>
                    {marsImage && <img src={marsImage} alt="Space Target" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
                    <span className="absolute bottom-3 right-3 bg-slate-900/80 px-3 py-1 rounded-full text-white font-mono text-xs z-10 shadow-lg">Martian Feed</span>
                 </div>

                 <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-100 border border-slate-200 group">
                    <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                      <span className="bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-mono rounded shadow-sm text-slate-700">ESA Sentinel-2</span>
                    </div>
                    {earthImage && <img src={earthImage} alt="Earth Analog" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
                    <span className="absolute bottom-3 right-3 bg-blue-600/90 px-3 py-1 rounded-full text-white font-mono text-xs z-10 shadow-lg">Earth Analog</span>
                 </div>
              </div>
            </motion.div>

            {/* Dynamic Results Table - Light Theme */}
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
               <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Database size={18} className="text-blue-600" /> Discovered Analogs</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-slate-500 font-mono text-xs uppercase">
                        <th className="pb-3 px-2">Candidate Site</th>
                        <th className="pb-3 px-2">Match Score</th>
                        <th className="pb-3 px-2">Spectral Fit</th>
                        <th className="pb-3 px-2">Topography</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analogs.map((analog) => (
                        <motion.tr key={analog.site_id} whileHover={{ backgroundColor: "#f8fafc" }} className="border-b border-slate-100 transition-colors">
                          <td className="py-4 px-2 font-bold text-slate-800">{analog.name}</td>
                          <td className="py-4 px-2"><span className="text-blue-600 font-mono font-extrabold bg-blue-50 px-2 py-1 rounded">{(analog.match_score * 100).toFixed(1)}%</span></td>
                          <td className="py-4 px-2 text-slate-600">{analog.spectral_fit}</td>
                          <td className="py-4 px-2 text-slate-600 font-mono">{analog.topography_score}%</td>
                        </motion.tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </motion.div>
          </div>

          {/* Right Column: Mission Planner */}
          <div className="space-y-8">
            {/* Quick Select Buttons */}
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 mb-4 font-mono uppercase tracking-widest flex items-center gap-2"><Globe size={16}/> Quick Targets</h3>
              <div className="flex flex-col gap-3">
                <button onClick={() => setActiveTarget('jezero')} className={`p-3 rounded-xl border text-left transition-all ${activeTarget === 'jezero' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                  <div className="font-bold text-slate-800">Jezero Crater</div>
                  <div className="text-xs text-slate-500 font-mono">Mars</div>
                </button>
                <button onClick={() => setActiveTarget('gale')} className={`p-3 rounded-xl border text-left transition-all ${activeTarget === 'gale' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                  <div className="font-bold text-slate-800">Gale Crater</div>
                  <div className="text-xs text-slate-500 font-mono">Mars</div>
                </button>
                <button onClick={() => setActiveTarget('malapert')} className={`p-3 rounded-xl border text-left transition-all ${activeTarget === 'malapert' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                  <div className="font-bold text-slate-800">Malapert Massif</div>
                  <div className="text-xs text-slate-500 font-mono">Lunar South Pole</div>
                </button>
              </div>
            </motion.div>

            {/* Sliders */}
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><SlidersHorizontal size={18} className="text-blue-600" /> POMDP Planner</h3>
              <p className="text-xs text-slate-500 mb-6">Adjust priority weights.</p>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2"><span className="font-mono text-slate-600">Geology</span><span className="text-blue-600 font-bold">{geologyWeight}%</span></div>
                  <input type="range" min="0" max="100" value={geologyWeight} onChange={(e) => setGeologyWeight(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2"><span className="font-mono text-slate-600">Thermal</span><span className="text-orange-500 font-bold">{environmentWeight}%</span></div>
                  <input type="range" min="0" max="100" value={environmentWeight} onChange={(e) => setEnvironmentWeight(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </main>

      <footer className="w-full border-t border-slate-200 bg-white mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-80"><Rocket className="text-slate-400" size={20} /><span className="text-slate-600 font-bold text-sm tracking-widest">SOLMATE</span></div>
          <p className="text-xs text-slate-500 font-mono text-center">Built for the <span className="text-blue-600 font-bold">NASA Space Apps Challenge</span>.</p>
        </div>
      </footer>
    </div>
  );
}