"use client";
import { useState, useEffect } from 'react';
import { Database, SlidersHorizontal, Rocket, Search, Target, Wind, Thermometer, Droplets, Sun, Globe2, ChevronRight, Users } from 'lucide-react';
import { motion } from 'framer-motion';

// Expanded Target Database for the UI
const QUICK_TARGETS = [
  { id: 'jezero', name: 'Jezero Crater', type: 'Mars Delta' },
  { id: 'gale', name: 'Gale Crater', type: 'Mars Basin' },
  { id: 'hellas', name: 'Hellas Planitia', type: 'Mars Impact Basin' },
  { id: 'malapert', name: 'Malapert Massif', type: 'Lunar South Pole' },
  { id: 'tycho', name: 'Tycho Crater', type: 'Lunar Impact Crater' },
  { id: 'artemis', name: 'Artemis Base Camp', type: 'Lunar South Pole' },
];

// Helper component for the lucrative Bar Charts
const MetricBar = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="mb-3">
    <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500 mb-1 uppercase tracking-wider">
      <span>{label}</span>
      <span className="text-slate-800">{value}%</span>
    </div>
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-full ${color}`} />
    </div>
  </div>
);

export default function MissionControl() {
  const [geoWeight, setGeoWeight] = useState(80);
  const [tempWeight, setTempWeight] = useState(50);
  const [windWeight, setWindWeight] = useState(30);
  const [humidWeight, setHumidWeight] = useState(10);
  const [radWeight, setRadWeight] = useState(75);
  
  const [mainSearch, setMainSearch] = useState("");
  const [quickTargetSearch, setQuickTargetSearch] = useState("");
  const [activeTarget, setActiveTarget] = useState("jezero");
  
  const [analogs, setAnalogs] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<string>("Connecting...");
  const [marsImage, setMarsImage] = useState<string>("");
  const [earthImage, setEarthImage] = useState<string>("");

  useEffect(() => {
    const fetchAnalogData = async () => {
      try {
        const url = `https://solmate-api.onrender.com/api/v1/match/?target=${activeTarget}&temp=${tempWeight}&wind=${windWeight}&rad=${radWeight}`;
        const response = await fetch(url);
        const data = await response.json();
        setAnalogs(data.analogs);
        setTelemetry(data.telemetry_status);
        setMarsImage(data.mars_image_url);
        setEarthImage(data.earth_image_url);
      } catch (error) {
        setTelemetry("Offline");
      }
    };
    const delayDebounceFn = setTimeout(() => { fetchAnalogData(); }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [activeTarget, tempWeight, windWeight, radWeight, geoWeight]); 

  const handleMainSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (mainSearch.trim()) setActiveTarget(mainSearch.trim().toLowerCase());
  };

  const filteredQuickTargets = QUICK_TARGETS.filter(t => t.name.toLowerCase().includes(quickTargetSearch.toLowerCase()));
  
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <main className="max-w-7xl mx-auto w-full p-4 md:p-8">
        
        <header className="flex flex-col xl:flex-row justify-between items-center mb-8 border-b border-slate-200 pb-6 gap-6">
          <div className="flex items-center gap-3">
            <Rocket className="text-blue-600" size={36} />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">SolMate</h1>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Planetary Analog Pipeline</p>
            </div>
          </div>
          
          <form onSubmit={handleMainSearch} className="relative w-full xl:w-[400px]">
            <input type="text" placeholder="Search targets (e.g., Gale, Artemis)..." value={mainSearch} onChange={(e) => setMainSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-full border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          </form>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 font-mono text-xs text-blue-700 bg-blue-50 px-4 py-2.5 rounded-full border border-blue-200 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div> API: {telemetry}
            </div>
            
            {/* Team Northern Lights Button */}
            <a href="https://www.spaceappschallenge.org/2026/find-a-team/northern-lights3/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md">
              <Users size={14} /> Team Northern Lights
            </a>
          </div>
        </header>

        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2"><Target className="text-blue-600" size={20}/> Target & Analog Overlays</h2>
                <span className="font-mono text-xs text-orange-600 font-bold bg-orange-50 px-3 py-1 rounded-full uppercase">Target: {activeTarget}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-100 border border-slate-200 group">
                    <div className="absolute top-3 left-3 z-10"><span className="bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-mono rounded shadow-sm text-slate-700">NASA PDS / JAXA DARTS</span></div>
                    {marsImage && <img src={marsImage} alt="Space Target" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
                    <span className="absolute bottom-3 right-3 bg-slate-900/80 px-3 py-1 rounded-full text-white font-mono text-xs z-10 shadow-lg">Target Feed</span>
                 </div>
                 <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-100 border border-slate-200 group">
                    <div className="absolute top-3 left-3 z-10"><span className="bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-mono rounded shadow-sm text-slate-700">ESA Copernicus / ISRO</span></div>
                    {earthImage && <img src={earthImage} alt="Earth Analog" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
                    <span className="absolute bottom-3 right-3 bg-blue-600/90 px-3 py-1 rounded-full text-white font-mono text-xs z-10 shadow-lg">Earth Analog</span>
                 </div>
              </div>
            </motion.div>

            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
               <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Database size={18} className="text-blue-600" /> Discovered Analogs & Data Metrics</h3>
               
               {/* Card-Based Visual Dashboard for Analogs */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {analogs.map((analog) => (
                   <motion.div key={analog.site_id} whileHover={{ y: -2 }} className="border border-slate-200 rounded-xl p-5 shadow-sm bg-slate-50/50">
                     <div className="flex justify-between items-start mb-3">
                       <div>
                         <h4 className="font-bold text-slate-800 text-lg">{analog.name}</h4>
                         <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{analog.agency}</p>
                       </div>
                       <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-extrabold font-mono shadow-md">
                         {(analog.match_score * 100).toFixed(1)}%
                       </div>
                     </div>
                     <p className="text-xs text-slate-600 mb-5 italic">{analog.environment}</p>
                     
                     {/* The Visual Bar Charts */}
                     <div className="pt-4 border-t border-slate-200">
                       <MetricBar label="Spectral Fit" value={analog.spectral} color="bg-blue-500" />
                       <MetricBar label="Topography Profile" value={analog.topography} color="bg-teal-500" />
                       <MetricBar label="Radiation Shielding" value={analog.radiation} color="bg-purple-500" />
                       <MetricBar label="Thermal Fidelity" value={analog.thermal} color="bg-orange-500" />
                     </div>
                   </motion.div>
                 ))}
                 {analogs.length === 0 && <div className="col-span-2 py-8 text-center text-slate-500 font-mono">Awaiting target selection...</div>}
               </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-500 font-mono uppercase tracking-widest flex items-center gap-2"><Globe2 size={16}/> Quick Targets</h3>
              </div>
              
              {/* Local Search within Quick Targets */}
              <div className="relative mb-4">
                <input type="text" placeholder="Filter list..." value={quickTargetSearch} onChange={(e) => setQuickTargetSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-blue-400 font-mono text-xs" />
                <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
              </div>

              {/* Scrollable Target List */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {filteredQuickTargets.map((t) => (
                  <button key={t.id} onClick={() => setActiveTarget(t.id)} className={`w-full p-3 rounded-xl border text-left flex justify-between items-center transition-all ${activeTarget === t.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{t.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">{t.type}</div>
                    </div>
                    <ChevronRight size={16} className={activeTarget === t.id ? 'text-blue-600' : 'text-slate-300'} />
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><SlidersHorizontal size={18} className="text-blue-600" /> POMDP Planner</h3>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <div className="flex justify-between text-xs mb-2 font-mono text-slate-600"><span className="flex items-center gap-1"><Database size={12}/> Geology</span><span className="font-bold">{geoWeight}</span></div>
                  <input type="range" min="0" max="100" value={geoWeight} onChange={(e) => setGeoWeight(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2 font-mono text-slate-600"><span className="flex items-center gap-1"><Thermometer size={12}/> Temp</span><span className="font-bold">{tempWeight}</span></div>
                  <input type="range" min="0" max="100" value={tempWeight} onChange={(e) => setTempWeight(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2 font-mono text-slate-600"><span className="flex items-center gap-1"><Wind size={12}/> Wind</span><span className="font-bold">{windWeight}</span></div>
                  <input type="range" min="0" max="100" value={windWeight} onChange={(e) => setWindWeight(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2 font-mono text-slate-600"><span className="flex items-center gap-1"><Droplets size={12}/> Humid</span><span className="font-bold">{humidWeight}</span></div>
                  <input type="range" min="0" max="100" value={humidWeight} onChange={(e) => setHumidWeight(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-400" />
                </div>
                <div className="col-span-2">
                  <div className="flex justify-between text-xs mb-2 font-mono text-slate-600"><span className="flex items-center gap-1"><Sun size={12}/> UV Radiation Profile</span><span className="font-bold">{radWeight}</span></div>
                  <input type="range" min="0" max="100" value={radWeight} onChange={(e) => setRadWeight(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500" />
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