"use client";
import { useState, useEffect } from 'react';
import { Database, SlidersHorizontal, Rocket, Search, Target, Wind, Thermometer, Droplets, Sun, Globe2, ChevronRight, Users, PlaySquare, Newspaper, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans w-full overflow-x-hidden">
      
      {/* 
        MAIN DASHBOARD WRAPPER 
        Replaced max-w-7xl with w-full and dynamic padding for full-width scaling 
      */}
      <main className="w-full px-4 md:px-8 xl:px-12 2xl:px-24 pt-8">
        
        <header className="flex flex-col xl:flex-row justify-between items-center mb-8 border-b border-slate-200 pb-6 gap-6">
          <div className="flex items-center gap-3 w-full xl:w-auto justify-center xl:justify-start">
            <Rocket className="text-blue-600" size={36} />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">SolMate</h1>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Planetary Analog Pipeline</p>
            </div>
          </div>
          
          <form onSubmit={handleMainSearch} className="relative w-full xl:flex-1 max-w-2xl mx-auto">
            <input type="text" placeholder="Search targets (e.g., Gale, Artemis)..." value={mainSearch} onChange={(e) => setMainSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-full border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          </form>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto justify-center xl:justify-end">
            <div className="flex items-center gap-2 font-mono text-xs text-blue-700 bg-blue-50 px-4 py-2.5 rounded-full border border-blue-200 shadow-sm whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div> API: {telemetry}
            </div>
            <a href="https://www.spaceappschallenge.org/2026/find-a-team/northern-lights3/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md whitespace-nowrap">
              <Users size={14} /> Team Northern Lights
            </a>
          </div>
        </header>

        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Data & Overlays (Takes up 8 of 12 columns on large screens) */}
          <div className="lg:col-span-8 space-y-8">
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2"><Target className="text-blue-600" size={20}/> Target & Analog Overlays</h2>
                <span className="font-mono text-xs text-orange-600 font-bold bg-orange-50 px-3 py-1 rounded-full uppercase shadow-inner">Target: {activeTarget}</span>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
               
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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

          {/* RIGHT COLUMN: Planners (Takes up 4 of 12 columns) */}
          <div className="lg:col-span-4 space-y-8">
            <motion.div variants={item} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-500 font-mono uppercase tracking-widest flex items-center gap-2"><Globe2 size={16}/> Quick Targets</h3>
              </div>
              
              <div className="relative mb-4">
                <input type="text" placeholder="Filter list..." value={quickTargetSearch} onChange={(e) => setQuickTargetSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-blue-400 font-mono text-xs" />
                <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
              </div>

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

      {/* 
        NEW MEDIA SECTION
        Expands the home page downwards with News and YouTube embeds 
      */}
      <section className="w-full bg-slate-900 text-white mt-16 py-20 px-4 md:px-8 xl:px-12 2xl:px-24">
        <div className="mb-12 border-b border-slate-700 pb-6 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3"><Newspaper className="text-blue-400"/> Mission Briefings & Global Telemetry</h2>
            <p className="text-slate-400 mt-2 font-mono text-sm">Latest agency updates on planetary analogs and human spaceflight preparation.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          
          {/* Media Card 1: YouTube Embed (NASA Artemis) */}
          <div className="xl:col-span-2 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-slate-500 transition-colors group">
            <iframe 
              className="w-full aspect-video" 
              src="https://www.youtube.com/embed/N0f-QkEVU7U?si=U4HnQ2pXFkR0nOQ_&autoplay=1&mute=1" 
              title="6 NASA Technologies to Get Humans to Mars" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
            <div className="p-6">
              <span className="text-xs font-mono font-bold text-blue-400 mb-2 block uppercase tracking-widest flex items-center gap-2"><PlaySquare size={14}/> Featured Video</span>
              <h3 className="text-xl font-bold mb-2 group-hover:text-blue-300 transition-colors">6 NASA Technologies to Get Humans to Mars</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                NASA is advancing many technologies to send astronauts to Mars as early as the 2030s. Here are six things we are working on right now to make future human missions to the Red Planet possible.
              </p>
            </div>
          </div>

          {/* Media Card 2: News Image (Perseverance) */}
          <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-slate-500 transition-colors group flex flex-col">
            <div className="h-48 w-full overflow-hidden">
              <img src="https://i0.wp.com/spacenews.com/wp-content/uploads/2015/10/Martian_surface_NASA1.jpg?fit=879%2C485&ssl=1" alt="Mars Surface SRC: NASA" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-orange-400 mb-2 block uppercase tracking-widest">Research Update</span>
                <h3 className="text-lg font-bold mb-2 group-hover:text-orange-300 transition-colors">Perseverance Scans Jezero Delta</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Fluvial deposits in Mars' Jezero Crater show striking mineralogical similarities to Lake Salda in Turkey, reinforcing the necessity of matching spectral data with Earth-based carbonates.
                </p>
              </div>
              <button className="mt-4 flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 w-fit">Read Report <ArrowRight size={14}/></button>
            </div>
          </div>

          {/* Media Card 3: News Image (Atacama Testing) */}
          <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-slate-500 transition-colors group flex flex-col">
            <div className="h-48 w-full overflow-hidden">
              <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia26/pia26701/figures/PIA26701_figD.JPG?w=8064&h=6048&fit=clip&crop=faces%2Cfocalpoint" alt="Desert Rover Src: Nasa" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-purple-400 mb-2 block uppercase tracking-widest">Field Testing</span>
                <h3 className="text-lg font-bold mb-2 group-hover:text-purple-300 transition-colors">Robotic Validation in the Atacama</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Before autonomous agents roam the Red Planet, international space agencies traverse the hyper-arid Atacama Desert to validate UV radiation shielding and dust mitigation.
                </p>
              </div>
              <button className="mt-4 flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 w-fit">View Gallery <ArrowRight size={14}/></button>
            </div>
          </div>

        </div>
      </section>

      <footer className="w-full border-t border-slate-200 bg-white py-12 px-4 md:px-8 xl:px-12 2xl:px-24">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-80">
            <Rocket className="text-slate-400" size={20} />
            <span className="text-slate-600 font-bold text-sm tracking-widest">SOLMATE</span>
          </div>
          <p className="text-xs text-slate-500 font-mono text-center">Built for the <span className="text-blue-600 font-bold">NASA Space Apps Challenge 2026</span>.</p>
        </div>
      </footer>
    </div>
  );
}