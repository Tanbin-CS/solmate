"use client";
import { useState, useEffect } from 'react';
import { Database, SlidersHorizontal, Rocket, Search, Globe, Target, Wind, Thermometer, Droplets, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MissionControl() {
  // Expanded Environmental States
  const [geoWeight, setGeoWeight] = useState(80);
  const [tempWeight, setTempWeight] = useState(50);
  const [windWeight, setWindWeight] = useState(30);
  const [humidWeight, setHumidWeight] = useState(10);
  const [radWeight, setRadWeight] = useState(75);
  
  const [searchInput, setSearchInput] = useState("");
  const [activeTarget, setActiveTarget] = useState("jezero");
  
  const [analogs, setAnalogs] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<string>("Connecting...");
  const [marsImage, setMarsImage] = useState<string>("");
  const [earthImage, setEarthImage] = useState<string>("");

  // Re-fetches data whenever the target OR a slider changes
  useEffect(() => {
    const fetchAnalogData = async () => {
      try {
        // Appending the slider values as query parameters to trigger the backend math
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
    
    // Add a small debounce so dragging a slider doesn't crash the API with 100 requests per second
    const delayDebounceFn = setTimeout(() => { fetchAnalogData(); }, 300);
    return () => clearTimeout(delayDebounceFn);
    
  }, [activeTarget, tempWeight, windWeight, radWeight, geoWeight]); 

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) setActiveTarget(searchInput.trim().toLowerCase());
  };
  
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <main className="max-w-7xl mx-auto w-full p-4 md:p-8">
        
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-slate-200 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <Rocket className="text-blue-600" size={36} />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">SolMate</h1>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Global Planetary Analog Pipeline</p>
            </div>
          </div>
          
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <input type="text" placeholder="Search targets (e.g., Gale, Malapert)..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-full border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          </form>

          <div className="flex items-center gap-2 font-mono text-xs text-blue-700 bg-blue-50 px-4 py-2 rounded-full border border-blue-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div> API: {telemetry}
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
               <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Database size={18} className="text-blue-600" /> Discovered Analogs</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-slate-500 font-mono text-xs uppercase">
                        <th className="pb-3 px-2">Candidate Site</th>
                        <th className="pb-3 px-2">Data Source</th>
                        <th className="pb-3 px-2">Match Score</th>
                        <th className="pb-3 px-2">Environment Profile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analogs.map((analog) => (
                        <motion.tr key={analog.site_id} whileHover={{ backgroundColor: "#f8fafc" }} className="border-b border-slate-100 transition-colors">
                          <td className="py-4 px-2 font-bold text-slate-800">{analog.name}</td>
                          <td className="py-4 px-2 text-xs font-mono text-slate-500">{analog.agency}</td>
                          <td className="py-4 px-2"><span className="text-blue-600 font-mono font-extrabold bg-blue-50 px-2 py-1 rounded">{(analog.match_score * 100).toFixed(1)}%</span></td>
                          <td className="py-4 px-2 text-slate-600 text-xs">{analog.environment}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 mb-4 font-mono uppercase tracking-widest flex items-center gap-2"><Globe size={16}/> Quick Targets</h3>
              <div className="flex gap-2">
                <button onClick={() => setActiveTarget('jezero')} className="flex-1 p-2 text-xs rounded-lg border font-bold text-slate-700 hover:bg-slate-50 border-slate-200">Jezero</button>
                <button onClick={() => setActiveTarget('gale')} className="flex-1 p-2 text-xs rounded-lg border font-bold text-slate-700 hover:bg-slate-50 border-slate-200">Gale</button>
                <button onClick={() => setActiveTarget('malapert')} className="flex-1 p-2 text-xs rounded-lg border font-bold text-slate-700 hover:bg-slate-50 border-slate-200">Malapert</button>
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

            <motion.div variants={item} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
               <h3 className="text-xs font-bold text-slate-400 mb-4 font-mono uppercase tracking-widest">Global Agency Telemetry</h3>
               <div className="space-y-3 font-mono text-[10px] text-slate-300">
                 <div className="border-l-2 border-blue-500 pl-2"><span className="text-blue-400">OK</span> Connected: NASA PDS Search API</div>
                 <div className="border-l-2 border-blue-500 pl-2"><span className="text-blue-400">OK</span> Fetching: ESA Sentinel-2 Surface Reflectance</div>
                 <div className="border-l-2 border-purple-500 pl-2"><span className="text-purple-400">SYNC</span> Integrating: CONAE (Argentina) Atacama Sensors</div>
                 <div className="border-l-2 border-yellow-500 pl-2"><span className="text-yellow-400">WARN</span> JAXA DARTS Lunar Regolith data sparse</div>
                 <div className="border-l-2 border-green-500 pl-2"><span className="text-green-400">SYNC</span> Aligning: CSA (Canada) Devon Island Topography</div>
               </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}