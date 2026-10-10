import { AlertTriangle, Rocket, ShieldCheck } from 'lucide-react';

export default function StoryBanner() {
  return (
    <div className="bg-space-800 border border-space-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white tracking-wide">
          SolMate: <span className="text-accent-cyan">Digital Discovery Engine</span>
        </h2>
        <div className="flex gap-2">
          <span className="px-3 py-1 text-xs font-mono bg-accent-amber/10 text-accent-amber border border-accent-amber/20 rounded">Artemis 2028</span>
          <span className="px-3 py-1 text-xs font-mono bg-accent-mars/10 text-accent-mars border border-accent-mars/20 rounded">Mars 2030</span>
        </div>
      </div>
      <p className="text-gray-400 max-w-4xl text-sm leading-relaxed mb-6">
        Ever imagined an El Clásico on Mars or a concert on the Moon? To live safely off-world, we must validate our life support systems here on Earth. Relying only on known sites like Death Valley isn't enough. Without exact environmental matches, we risk massive blunders.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-space-900 border border-red-900/50 p-4 rounded text-sm">
          <div className="flex items-center gap-2 text-accent-mars mb-2">
            <AlertTriangle size={16} /> <span className="font-semibold">Apollo Dust Hazard</span>
          </div>
          <p className="text-gray-500 text-xs">Sharp lunar dust shredded Apollo spacesuits. Unanticipated abrasive topography.</p>
        </div>
        <div className="bg-space-900 border border-red-900/50 p-4 rounded text-sm">
          <div className="flex items-center gap-2 text-accent-mars mb-2">
            <AlertTriangle size={16} /> <span className="font-semibold">InSight "Mole" Failure</span>
          </div>
          <p className="text-gray-500 text-xs">Mars InSight drill permanently stuck in unexpected duricrust.</p>
        </div>
        <div className="bg-space-900 border border-accent-cyan/30 p-4 rounded text-sm">
          <div className="flex items-center gap-2 text-accent-cyan mb-2">
            <ShieldCheck size={16} /> <span className="font-semibold">SolMate Validation</span>
          </div>
          <p className="text-gray-500 text-xs">Autonomous agents simulate traversals, replacing blind, multi-million-dollar indoor test facilities.</p>
        </div>
      </div>
    </div>
  );
}