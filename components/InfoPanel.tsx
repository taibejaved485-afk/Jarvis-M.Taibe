import React, { useEffect, useRef } from 'react';
import { LogEntry, SystemStatus } from '../types';

interface InfoPanelProps {
  logs: LogEntry[];
  systemStatus: SystemStatus;
  themeColor: string;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ logs, systemStatus, themeColor }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const getBorderColor = () => {
    if (themeColor === 'red') return 'border-red-500';
    if (themeColor === 'gold') return 'border-yellow-500';
    return 'border-cyan-500';
  };

  const getTextColor = () => {
    if (themeColor === 'red') return 'text-red-400';
    if (themeColor === 'gold') return 'text-yellow-400';
    return 'text-cyan-400';
  };

  const getBgColor = () => {
     if (themeColor === 'red') return 'bg-red-500';
     if (themeColor === 'gold') return 'bg-yellow-500';
     return 'bg-cyan-500';
  };

  // Generate simulated core loads based on the main CPU value
  const coreLoads = [
      Math.min(100, Math.max(0, systemStatus.cpu + 5)),
      Math.min(100, Math.max(0, systemStatus.cpu - 8)),
      Math.min(100, Math.max(0, systemStatus.cpu + 12)),
      Math.min(100, Math.max(0, systemStatus.cpu - 2))
  ];

  return (
    <div className="flex flex-col gap-4 w-full h-full max-w-md p-4 font-mono text-xs md:text-sm">
      
      {/* System Status Box */}
      <div className={`relative border ${getBorderColor()} bg-black/40 backdrop-blur-md p-4 rounded-sm`}>
        <div className={`absolute -top-3 left-4 bg-black px-2 ${getTextColor()} font-bold tracking-widest`}>SYSTEM DIAGNOSTIC</div>
        
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-2">
          
          {/* CPU Column */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
                <span className="text-gray-500 text-[10px]">CPU ARRAY</span>
                <span className={`${getTextColor()}`}>{Math.round(systemStatus.cpu)}%</span>
            </div>
            <div className="flex flex-col gap-1">
                {coreLoads.map((load, i) => (
                    <div key={i} className="flex items-center gap-1 h-1.5">
                        <div className="w-4 text-[8px] text-gray-600 leading-none">C{i}</div>
                        <div className="flex-1 bg-gray-900 h-full rounded-sm overflow-hidden">
                            <div 
                                className={`h-full ${getBgColor()} transition-all duration-500`} 
                                style={{ width: `${load}%`, opacity: 0.7 + (i * 0.1) }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
          </div>
          
          {/* Memory Column */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
                <span className="text-gray-500 text-[10px]">MEMORY BANKS</span>
                <span className={`${getTextColor()}`}>{Math.round(systemStatus.memory)}%</span>
            </div>
             <div className="flex flex-col gap-1 h-full justify-between">
                {/* Visualizing Stack vs Heap vs Cache */}
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-gray-600">HEAP</span>
                    <div className="w-full bg-gray-900 h-1.5 rounded-sm overflow-hidden">
                        <div className={`h-full ${getBgColor()} transition-all duration-500`} style={{ width: `${systemStatus.memory * 0.6}%` }}></div>
                    </div>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-gray-600">STACK</span>
                     <div className="w-full bg-gray-900 h-1.5 rounded-sm overflow-hidden">
                        <div className={`h-full ${getBgColor()} transition-all duration-500`} style={{ width: `${systemStatus.memory * 0.3}%`, opacity: 0.8 }}></div>
                    </div>
                </div>
                 <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-gray-600">CACHE</span>
                     <div className="w-full bg-gray-900 h-1.5 rounded-sm overflow-hidden">
                        <div className={`h-full ${getBgColor()} transition-all duration-500`} style={{ width: `${Math.min(100, systemStatus.memory * 1.2)}%`, opacity: 0.5 }}></div>
                    </div>
                </div>
            </div>
          </div>

          {/* Volume Row */}
          <div className="flex flex-col gap-1 col-span-2 mt-1">
            <div className="flex justify-between">
                <span className="text-gray-500 text-[10px]">OUTPUT GAIN</span>
                <span className={`${getTextColor()} text-[10px]`}>{systemStatus.volume} dB</span>
            </div>
             <div className="h-3 w-full bg-gray-900/50 rounded-sm overflow-hidden flex gap-0.5 p-0.5 border border-gray-800">
               {Array.from({length: 30}).map((_, i) => (
                 <div 
                    key={i} 
                    className={`h-full flex-1 rounded-[1px] ${i < (systemStatus.volume / 3.33) ? getBgColor() : 'bg-gray-800/30'} transition-all duration-100`}
                 ></div>
               ))}
            </div>
          </div>

          {/* Integrity & Net */}
          <div className="flex flex-col gap-1 border-t border-gray-800 pt-2">
            <span className="text-gray-500 text-[10px]">INTEGRITY</span>
            <span className={`${getTextColor()} text-xl font-tech tracking-widest`}>{systemStatus.integrity}%</span>
          </div>

          <div className="flex flex-col gap-1 border-t border-gray-800 pt-2 text-right">
            <span className="text-gray-500 text-[10px]">NETWORK</span>
            <span className={`${getTextColor()} font-tech tracking-widest`}>{systemStatus.network}</span>
          </div>
        </div>
        
        {/* Decorators */}
        <div className={`absolute top-0 right-0 w-2 h-2 ${getBgColor()}`}></div>
        <div className={`absolute bottom-0 left-0 w-2 h-2 ${getBgColor()}`}></div>
        <div className={`absolute bottom-0 right-0 w-16 h-[1px] ${getBgColor()} opacity-50`}></div>
      </div>

      {/* Logs Box */}
      <div className={`relative border ${getBorderColor()} bg-black/40 backdrop-blur-md p-4 rounded-sm flex-1 flex flex-col min-h-0`}>
         <div className={`absolute -top-3 left-4 bg-black px-2 ${getTextColor()} font-bold tracking-widest`}>PROTOCOL LOGS</div>
         
         <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 mt-2">
           {[...logs].reverse().map((log) => (
             <div key={log.id} className="flex gap-2 animate-fade-in break-words border-l border-gray-800 pl-2 shrink-0">
               <span className="text-gray-600 min-w-[50px] text-[10px] pt-0.5">[{log.timestamp}]</span>
               <div className="flex flex-col">
                    <span className={`${log.source === 'JARVIS' ? 'text-white' : 'text-gray-400'} font-bold text-[10px] uppercase tracking-wider`}>{log.source}</span>
                    <span className={`${log.type === 'error' ? 'text-red-500' : log.type === 'warning' ? 'text-yellow-500' : log.type === 'success' ? 'text-green-500' : getTextColor()} leading-tight`}>
                        {log.message}
                    </span>
               </div>
             </div>
           ))}
           <div ref={logsEndRef} />
         </div>
      </div>

    </div>
  );
};

export default InfoPanel;