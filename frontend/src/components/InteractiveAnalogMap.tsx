"use client";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Moon, Globe, Target } from 'lucide-react';

// Mock data mapping off-world targets to Earth analogs with CSS coordinates for the map overlay
const targetingData = {
  jezero: {
    id: 'jezero',
    name: 'Jezero Crater',
    body: 'Mars',
    analog: 'Lake Salda, Turkey',
    coordinates: { x: '58%', y: '35%' },
    match: '89.4%',
    desc: 'Hydromagnesite microbialites and carbonate mineralogy perfectly mirror Martian deltaic deposits.'
  },
  malapert: {
    id: 'malapert',
    name: 'Malapert Massif',
    body: 'Moon',
    analog: 'Concordia, Antarctica',
    coordinates: { x: '55%', y: '85%' },
    match: '74.5%',
    desc: 'Extreme thermal gradients (-80°C), isolation, and polar topography mimic Lunar South Pole.'
  },
  gale: {
    id: 'gale',
    name: 'Gale Crater',
    body: 'Mars',
    analog: 'Atacama Desert, Chile',
    coordinates: { x: '25%', y: '70%' },
    match: '86.1%',
    desc: 'Hyper-arid environment with desiccated sulfates and chloride surface composition.'
  }
};

type TargetKey = keyof typeof targetingData;

export default function InteractiveAnalogMap() {
  const [activeTarget, setActiveTarget] = useState<TargetKey>('jezero');
  const activeData = targetingData[activeTarget];

  return (
    <div className="bg-space-800 border border-space-700 rounded-lg p-6 mt-6 shadow-lg">
      <div className="flex items-center justify-between mb-6 border-b border-space-700 pb-4">
        <h3 className="text-xl font-bold flex items-center gap-2 text-white">
          <Target className="text-accent-cyan" /> Planetary Analog Targeting System
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input 
            type="text" 
            placeholder="Search lunar/martian zones..." 
            className="bg-space-900 border border-space-700 text-xs rounded-full pl-9 pr-4 py-2 focus:outline-none focus:border-accent-cyan text-gray-300 w-64"
            disabled
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Target Selection */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">Select Target Zone</h4>
          {(Object.keys(targetingData) as TargetKey[]).map((key) => {
            const data = targetingData[key];
            const isActive = activeTarget === key;
            return (
              <motion.div 
                key={key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTarget(key)}
                className={`p-4 rounded border cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-space-700/50 border-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.1)]' 
                    : 'bg-space-900 border-space-700 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-gray-200">{data.name}</span>
                  {data.body === 'Mars' ? <Globe size={14} className="text-accent-mars" /> : <Moon size={14} className="text-gray-400" />}
                </div>
                <div className="text-xs text-gray-500 font-mono">Analog: {data.analog}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Right: Earth Radar Map */}
        <div className="lg:col-span-2 relative bg-space-900 border border-space-700 rounded overflow-hidden min-h-[300px] flex items-center justify-center">
          {/* Stylized Grid Background simulating a digital Earth Map */}
          <div className="absolute inset-0 opacity-20" 
               style={{ backgroundImage: 'linear-gradient(#00F0FF 1px, transparent 1px), linear-gradient(90deg, #00F0FF 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-space-900/50 to-space-900"></div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeData.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              {/* The Blinking Analog Marker */}
              <div 
                className="absolute flex flex-col items-center translate-x-[-50%] translate-y-[-100%]"
                style={{ left: activeData.coordinates.x, top: activeData.coordinates.y }}
              >
                <div className="relative">
                  <MapPin size={32} className="text-accent-cyan z-10 relative drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                  {/* Radar Pulse Animation */}
                  <motion.div 
                    animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-accent-cyan rounded-full"
                  />
                </div>
                
                {/* Tooltip */}
                <div className="mt-2 bg-black/90 border border-space-700 p-3 rounded w-48 shadow-xl backdrop-blur-sm">
                  <div className="text-accent-cyan font-mono text-[10px] mb-1">MATCH SCORE: {activeData.match}</div>
                  <div className="text-white text-sm font-bold mb-1">{activeData.analog}</div>
                  <div className="text-gray-400 text-[10px] leading-tight">{activeData.desc}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}