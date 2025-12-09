import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ConnectionState, LogEntry, SystemStatus } from './types';
import { LiveClient, systemTools } from './services/liveClient';
import ArcReactor from './components/ArcReactor';
import InfoPanel from './components/InfoPanel';

// Safe ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

// Configuration constant for Themes to ensure Tailwind classes are fully scannable
const THEME_CONFIG = {
  cyan: {
    color: 'text-cyan-500',
    border: 'border-cyan-500',
    borderFocus: 'focus:border-cyan-400',
    shadow: 'shadow-cyan-500/50',
    bg: 'bg-cyan-500',
    bgLight: 'bg-cyan-900/20',
    gradient: 'from-cyan-900/10',
    borderRight: 'border-cyan-500/50',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.4)]',
    pulse: 'input-pulse-cyan'
  },
  red: {
    color: 'text-red-500',
    border: 'border-red-500',
    borderFocus: 'focus:border-red-400',
    shadow: 'shadow-red-500/50',
    bg: 'bg-red-500',
    bgLight: 'bg-red-900/20',
    gradient: 'from-red-900/10',
    borderRight: 'border-red-500/50',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',
    pulse: 'input-pulse-red'
  },
  gold: {
    color: 'text-yellow-500',
    border: 'border-yellow-500',
    borderFocus: 'focus:border-yellow-400',
    shadow: 'shadow-yellow-500/50',
    bg: 'bg-yellow-500',
    bgLight: 'bg-yellow-900/20',
    gradient: 'from-yellow-900/10',
    borderRight: 'border-yellow-500/50',
    glow: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]',
    pulse: 'input-pulse-gold'
  }
};

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [audioVolume, setAudioVolume] = useState(0);
  const [theme, setTheme] = useState<'cyan' | 'red' | 'gold'>('cyan');
  const [voiceName, setVoiceName] = useState('Kore');
  const [textCommand, setTextCommand] = useState('');
  const [processingCommand, setProcessingCommand] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [powerState, setPowerState] = useState<'ONLINE' | 'OFFLINE' | 'REBOOTING'>('ONLINE');
  
  const liveClientRef = useRef<LiveClient | null>(null);
  
  // Simulated System Status
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    cpu: 12,
    memory: 45,
    network: 'ONLINE',
    integrity: 100,
    volume: 50
  });

  // Safe API Key access
  const getApiKey = () => {
      return (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';
  };

  // Initial greeting log
  useEffect(() => {
    if (powerState === 'ONLINE') {
        addLog({
        id: 'init',
        timestamp: new Date().toLocaleTimeString(),
        source: 'SYSTEM',
        message: 'Hi boss, how are you? J.A.R.V.I.S. Interface Loaded.',
        type: 'success'
        });
    }
  }, [powerState]);

  // Status simulation effect
  useEffect(() => {
    if (powerState !== 'ONLINE') return;
    const interval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() * 10 - 5))),
        memory: Math.max(10, Math.min(90, prev.memory + (Math.random() * 4 - 2))),
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [powerState]);

  const addLog = (log: LogEntry) => {
    setLogs(prev => [log, ...prev].slice(0, 50));
  };

  const handleError = (msg: string) => {
      setError(msg);
      if (!msg.includes("Aborted") && !msg.includes("Failed")) {
          setTimeout(() => setError(null), 5000);
      }
  };

  const connectToGemini = async (overrideVoice?: string) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert("API_KEY not found in environment.");
      return;
    }
    
    setError(null);
    const vName = overrideVoice || voiceName;
    
    const client = new LiveClient({
      apiKey: apiKey,
      voiceName: vName,
      onStatusChange: (status) => setConnectionState(status as ConnectionState),
      onAudioData: (vol) => setAudioVolume(vol),
      onLog: addLog,
      onError: handleError,
      onSystemAction: handleSystemAction
    });
    
    client.setMute(isMuted);
    liveClientRef.current = client;
    await client.connect();
  };

  const disconnectFromGemini = async () => {
    if (liveClientRef.current) {
      await liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }
    setConnectionState(ConnectionState.DISCONNECTED);
    setAudioVolume(0);
    setError(null);
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (liveClientRef.current) {
      liveClientRef.current.setMute(newState);
    }
    addLog({ 
        id: generateId(), 
        timestamp: new Date().toLocaleTimeString(), 
        source: 'SYSTEM', 
        message: `Audio Input Sensors ${newState ? 'DISABLED' : 'ENABLED'}`, 
        type: newState ? 'warning' : 'success' 
    });
  };

  const handleVoiceChange = async (newVoice: string) => {
      if (newVoice === voiceName) return;
      setVoiceName(newVoice);
      
      if (connectionState === ConnectionState.CONNECTED) {
          addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `Reconfiguring vocal synthesis to ${newVoice.toUpperCase()}...`, type: 'warning' });
          await disconnectFromGemini();
          await connectToGemini(newVoice);
      } else {
          addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `Vocal identity set to ${newVoice.toUpperCase()}`, type: 'success' });
      }
  };

  // --- POWER MANAGEMENT ---
  
  const handleShutdown = async () => {
      addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: 'Shutdown sequence initiated...', type: 'warning' });
      await disconnectFromGemini();
      // Visual delay before "power off"
      setTimeout(() => {
          setPowerState('OFFLINE');
          setSystemStatus(prev => ({...prev, network: 'OFFLINE', cpu: 0, memory: 0}));
      }, 1500);
  };

  const handleReboot = async () => {
      addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: 'Reboot command received. Cycling power...', type: 'warning' });
      await disconnectFromGemini();
      setPowerState('REBOOTING');
      
      // Simulate Boot Process
      setTimeout(() => {
          setLogs([]); // Clear logs
          setSystemStatus({ cpu: 0, memory: 0, network: 'OFFLINE', integrity: 100, volume: 0 });
          
          setTimeout(() => {
               setPowerState('ONLINE');
               // Status returns to normal in the useEffect init
               setSystemStatus(prev => ({ ...prev, network: 'ONLINE', volume: 50 }));
          }, 4000); // 4 seconds boot screen
      }, 1000);
  };

  const handlePowerOn = () => {
      setPowerState('ONLINE');
      setSystemStatus(prev => ({ ...prev, network: 'ONLINE', volume: 50 }));
  };

  const handleSystemAction = async (action: string, args: any): Promise<any> => {
    switch (action) {
      case 'scanSystem':
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: 'Initiating full system diagnostic scan...', type: 'info' });
        await new Promise(r => setTimeout(r, 800));
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: 'Scanning File System... OK', type: 'info' });
        await new Promise(r => setTimeout(r, 600));
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: 'Checking Network Protocols... OK', type: 'info' });
        await new Promise(r => setTimeout(r, 400));
        return { 
          status: 'OPTIMAL', 
          issues_found: 0, 
          details: 'All systems functioning within normal parameters.' 
        };
        
      case 'checkIntegrity':
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: 'Running system integrity verification...', type: 'info' });
        await new Promise(r => setTimeout(r, 2000)); // fake delay
        const newIntegrity = Math.floor(Math.random() * 15) + 85; // Random between 85 and 100
        setSystemStatus(prev => ({ ...prev, integrity: newIntegrity }));
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `Integrity verification complete: ${newIntegrity}%`, type: 'success' });
        return { integrity: newIntegrity, status: 'STABLE' };
      
      case 'openWebsite':
        const site = args.siteName?.toLowerCase();
        let url = '';
        if (site.includes('youtube')) url = 'https://www.youtube.com';
        else if (site.includes('google')) url = 'https://www.google.com';
        else if (site.includes('netflix')) url = 'https://www.netflix.com';
        else if (site.includes('spotify')) url = 'https://open.spotify.com';
        else url = site.startsWith('http') ? site : `https://${site}`;
        
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `Opening external protocol: ${site}`, type: 'success' });
        window.open(url, '_blank');
        return { success: true, message: `Opened ${site}` };

      case 'openFile':
        const fileName = args.fileName;
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `Searching file system for: ${fileName}`, type: 'info' });
        await new Promise(r => setTimeout(r, 1000));
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `File located. Executing ${fileName}...`, type: 'success' });
        return { success: true, message: `Opened ${fileName}` };

      case 'manageSystemPower':
        const pAction = args.action?.toUpperCase();
        if (pAction === 'ON') {
             if (powerState === 'OFFLINE') {
                handlePowerOn();
                return { success: true, status: 'ONLINE' };
             }
             addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: 'Power check: Systems are already online.', type: 'info' });
             return { success: true, status: 'ONLINE', message: 'System is already running' };
        } else if (pAction === 'OFF') {
             handleShutdown();
             return { success: true, status: 'STANDBY' };
        } else if (pAction === 'RESTART') {
             handleReboot();
             return { success: true, status: 'REBOOTING' };
        }
        return { success: true, message: 'Power command acknowledged.' };

      case 'adjustVolume':
        const vol = args.level ?? 50;
        setSystemStatus(prev => ({ ...prev, volume: vol }));
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `Adjusting master volume to ${vol}%`, type: 'success' });
        return { success: true, new_level: vol };
      
      case 'changeTheme':
        const newTheme = args.theme?.toLowerCase();
        if (['red', 'gold', 'blue', 'cyan'].includes(newTheme)) {
           setTheme(newTheme === 'blue' ? 'cyan' : newTheme);
           return { success: true };
        }
        return { success: false, message: 'Theme not available' };

      case 'changeVoice':
        const newVoice = args.voiceName;
        const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
        if (validVoices.includes(newVoice)) {
            setVoiceName(newVoice);
            addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `Reinitializing audio synthesis protocol: ${newVoice}`, type: 'warning' });
            
            // Reconnect logic with delay
            setTimeout(async () => {
                await disconnectFromGemini();
                await connectToGemini(newVoice);
            }, 500);
            
            return { success: true, message: 'Voice protocol updated. Rebooting interface...' };
        }
        return { success: false, message: 'Voice identity not recognized.' };
      
      default:
        throw new Error(`Unknown protocol action: ${action}`);
    }
  };

  const executeTextCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textCommand.trim() || processingCommand) return;
    const apiKey = getApiKey();
    if (!apiKey) {
        handleError("API Key missing. Cannot execute command.");
        return;
    }

    const command = textCommand;
    setTextCommand('');
    setProcessingCommand(true);
    addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'USER', message: command, type: 'info' });

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: command,
            config: {
                tools: [{ functionDeclarations: systemTools }],
                systemInstruction: "You are JARVIS. If the user asks to perform a system action, call the appropriate tool. If they just want to chat, reply briefly and wittily. The user's name is Taibe, address him as 'Taibe sir'."
            }
        });

        // Check for tool calls
        const candidates = response.candidates;
        if (candidates && candidates[0]) {
             const parts = candidates[0].content.parts;
             let toolCalled = false;
             
             for (const part of parts) {
                 if (part.functionCall) {
                     toolCalled = true;
                     const fc = part.functionCall;
                     addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'JARVIS', message: `Executing ${fc.name}...`, type: 'info' });
                     const result = await handleSystemAction(fc.name, fc.args);
                 }
                 if (part.text) {
                     addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'JARVIS', message: part.text, type: 'success' });
                 }
             }

             if (!toolCalled && !parts.some(p => p.text)) {
                 addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'JARVIS', message: "Processing complete.", type: 'info' });
             }
        }
    } catch (err: any) {
        const msg = err.message || "Unknown error occurred";
        addLog({ id: generateId(), timestamp: new Date().toLocaleTimeString(), source: 'SYSTEM', message: `Command failed: ${msg}`, type: 'error' });
        handleError(`Command Execution Failed: ${msg}`);
    } finally {
        setProcessingCommand(false);
    }
  };

  const toggleConnection = async () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      await disconnectFromGemini();
    } else {
      await connectToGemini();
    }
  };

  // --- STYLING HELPERS ---
  const currentTheme = THEME_CONFIG[theme];

  const getInputClass = () => {
      // Base classes
      let classes = `w-full bg-black/40 backdrop-blur-md border p-4 font-mono text-sm outline-none transition-all placeholder:animate-pulse `;
      classes += `${currentTheme.color} ${currentTheme.border} ${currentTheme.borderFocus} `;
      
      if (!processingCommand && textCommand === '') {
          classes += `${currentTheme.pulse} `;
      } else {
          classes += `${currentTheme.glow} `;
      }
      return classes;
  };

  const getButtonClass = () => {
     const base = "px-8 py-3 font-tech text-lg font-bold tracking-widest border-2 transition-all duration-300 uppercase clip-path-polygon";
     if (connectionState === ConnectionState.CONNECTED) {
       // Connected state is always Red/Alert style or maybe active style? 
       // Keeping original logic: Red bg when connected to indicate "Stop" capability usually?
       // Let's use current theme active state instead to match user preference.
       return `${base} ${currentTheme.bgLight} ${currentTheme.border} ${currentTheme.color} hover:${currentTheme.bg} hover:text-black shadow-[0_0_20px_rgba(239,68,68,0.5)]`;
     }
     
     // Default State
     return `${base} ${currentTheme.bgLight} ${currentTheme.border} ${currentTheme.color} hover:${currentTheme.bg} hover:text-black ${currentTheme.shadow}`;
  };

  // --- RENDER HELPERS ---
  const renderOfflineOverlay = () => (
      <div className="absolute inset-0 z-50 bg-[#020202] flex flex-col items-center justify-center animate-fade-in">
          <div className="text-gray-800 font-tech text-6xl tracking-widest opacity-20 select-none">OFFLINE</div>
          <button 
             onClick={handlePowerOn}
             className="mt-8 border border-gray-800 text-gray-600 px-8 py-2 rounded-full hover:border-cyan-500 hover:text-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all duration-500 group"
          >
              <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-900 group-hover:bg-cyan-400 animate-pulse"></div>
                  <span className="font-mono text-sm tracking-[0.2em]">INITIALIZE SYSTEM</span>
              </div>
          </button>
          <div className="absolute bottom-10 font-mono text-xs text-gray-800">STANDBY MODE ACTIVE</div>
      </div>
  );

  const renderRebootOverlay = () => (
      <div className="absolute inset-0 z-50 bg-black flex flex-col items-start justify-start p-10 font-mono text-xs text-blue-400 leading-relaxed overflow-hidden">
          <div className="flex flex-col gap-1 w-full max-w-2xl">
              <span className="text-white mb-4">STARK INDUSTRIES BIOS v42.0.1</span>
              <span>CHECKING MEMORY MODULES... OK</span>
              <span>LOADING KERNEL... OK</span>
              <span>VERIFYING ENCRYPTION KEYS... OK</span>
              <span className="text-yellow-500">WARNING: UNREGULATED ENERGY SIGNATURE DETECTED</span>
              <span>RECALIBRATING SENSORS...</span>
              <div className="my-4 w-64 h-2 bg-gray-900 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 animate-loading-bar"></div>
              </div>
              <span className="animate-pulse">BOOTING INTERFACE...</span>
          </div>
      </div>
  );

  return (
    <div className="relative w-screen h-screen bg-[#050505] text-white overflow-hidden flex flex-col md:flex-row">
      
      {/* POWER OVERLAYS */}
      {powerState === 'OFFLINE' && renderOfflineOverlay()}
      {powerState === 'REBOOTING' && renderRebootOverlay()}

      {/* Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
           style={{ 
             backgroundImage: `linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)`,
             backgroundSize: '40px 40px'
           }}>
      </div>
      
      {/* Radial Gradient */}
      <div className={`absolute inset-0 z-0 bg-radial-gradient ${currentTheme.gradient} to-transparent pointer-events-none`}></div>

      {/* LEFT PANEL (Logs & Info) */}
      <div className={`z-10 w-full md:w-1/3 h-[45%] md:h-full p-4 md:p-8 order-2 md:order-1 flex flex-col transition-opacity duration-1000 ${powerState === 'ONLINE' ? 'opacity-100' : 'opacity-0'}`}>
        <InfoPanel logs={logs} systemStatus={systemStatus} themeColor={theme} />
        
        {/* Command Input Area */}
        <div className="mt-4 relative">
             <form onSubmit={executeTextCommand} className="relative">
                <div className={`absolute -top-3 left-4 bg-black px-2 ${currentTheme.color} text-xs font-bold tracking-widest`}>MANUAL OVERRIDE</div>
                <input 
                    type="text" 
                    value={textCommand}
                    onChange={(e) => setTextCommand(e.target.value)}
                    placeholder={processingCommand ? "PROCESSING..." : "ENTER COMMAND..."}
                    disabled={processingCommand}
                    className={getInputClass()}
                    autoComplete="off"
                />
                <button 
                    type="submit" 
                    className={`absolute right-2 top-1/2 -translate-y-1/2 ${currentTheme.color} opacity-50 hover:opacity-100 uppercase text-xs font-bold tracking-wider`}
                    disabled={processingCommand}
                >
                    EXECUTE
                </button>
             </form>
        </div>
      </div>

      {/* CENTER PANEL (Reactor & Controls) */}
      <div className={`z-10 w-full md:w-1/3 h-[55%] md:h-full flex flex-col items-center justify-center relative order-1 md:order-2 transition-all duration-1000 ${powerState === 'ONLINE' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
         
         <div className="absolute top-4 md:top-10 font-tech text-center opacity-80">
            <h1 className={`text-4xl font-black tracking-[0.2em] ${currentTheme.color}`}>J.A.R.V.I.S.</h1>
            <p className="text-xs tracking-[0.5em] text-gray-500 mt-2">JUST A RATHER VERY INTELLIGENT SYSTEM</p>
         </div>
        
         {/* System Error Alert */}
         {error && (
             <div className="absolute top-24 w-4/5 md:w-2/3 bg-black/80 border border-red-500 p-3 z-50 animate-pulse flex flex-col items-center text-center shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                <span className="text-red-500 font-bold tracking-widest text-xs mb-1">CRITICAL ERROR DETECTED</span>
                <span className="text-red-300 font-mono text-sm">{error}</span>
             </div>
         )}

         <div className="mt-4 mb-4 md:mt-10 md:mb-10 transform scale-75 md:scale-100">
           <ArcReactor 
             active={connectionState === ConnectionState.CONNECTED} 
             volume={audioVolume} 
             themeColor={theme} 
             systemStatus={systemStatus}
           />
         </div>

         <button 
           onClick={toggleConnection}
           className={getButtonClass()}
           disabled={connectionState === ConnectionState.CONNECTING}
         >
            {connectionState === ConnectionState.CONNECTING ? 'INITIALIZING...' : 
             connectionState === ConnectionState.CONNECTED ? 'DISENGAGE' : 'INITIALIZE'}
         </button>
         
         {/* Mute Button */}
         {connectionState === ConnectionState.CONNECTED && (
             <button 
                onClick={toggleMute}
                className={`mt-4 px-4 py-2 text-xs font-mono border ${isMuted ? 'border-red-500 text-red-500' : 'border-gray-500 text-gray-500'} hover:bg-white/5 transition-colors uppercase tracking-widest`}
             >
                MIC: {isMuted ? 'OFFLINE' : 'ONLINE'}
             </button>
         )}
         
         {connectionState === ConnectionState.ERROR && !error && (
           <p className="text-red-500 mt-4 font-mono animate-pulse">CONNECTION FAILURE</p>
         )}

         <div className="absolute bottom-4 md:bottom-10 flex gap-4 text-xs font-mono text-gray-600">
            <span>SECURE CONNECTION: {connectionState === ConnectionState.CONNECTED ? 'ESTABLISHED' : 'OFFLINE'}</span>
            <span>|</span>
            <span>LATENCY: {connectionState === ConnectionState.CONNECTED ? '12ms' : '--'}</span>
         </div>
      </div>

      {/* RIGHT PANEL (Decorative Data & Settings) */}
      <div className={`z-10 hidden md:flex w-1/3 h-full p-8 flex-col justify-center items-end order-3 transition-opacity duration-1000 ${powerState === 'ONLINE' ? 'opacity-100' : 'opacity-0'}`}>
         
         {/* Power Controls */}
         <div className={`mb-4 flex flex-col items-end gap-2 border-r-2 ${currentTheme.borderRight} pr-4 p-4 bg-black/20 backdrop-blur-sm`}>
            <span className={`font-tech text-xs tracking-[0.2em] ${currentTheme.color} font-bold`}>POWER PROTOCOLS</span>
            <div className="flex gap-2">
               <button 
                 onClick={handleReboot}
                 className={`px-3 py-1 border border-gray-600 hover:border-white text-xs font-mono text-gray-400 hover:text-white transition-all`}
               >
                  REBOOT
               </button>
               <button 
                 onClick={handleShutdown}
                 className={`px-3 py-1 border border-red-900 hover:border-red-500 text-xs font-mono text-red-900 hover:text-red-500 transition-all`}
               >
                  SHUTDOWN
               </button>
            </div>
         </div>

         {/* Voice Selector */}
         <div className={`mb-4 flex flex-col items-end gap-2 border-r-2 ${currentTheme.borderRight} pr-4 p-4 bg-black/20 backdrop-blur-sm`}>
            <span className={`font-tech text-xs tracking-[0.2em] ${currentTheme.color} font-bold`}>VOICE IDENTITY</span>
            <div className="flex gap-2 flex-wrap justify-end max-w-[200px]">
               {['Puck', 'Zephyr', 'Kore', 'Fenrir', 'Charon'].map(v => (
                   <button 
                     key={v}
                     onClick={() => handleVoiceChange(v)}
                     className={`px-2 py-1 text-[10px] font-mono border ${voiceName === v ? currentTheme.border + ' ' + currentTheme.color + ' bg-white/10' : 'border-gray-800 text-gray-600 hover:border-gray-500'} transition-all uppercase`}
                   >
                     {v}
                   </button>
               ))}
            </div>
         </div>

         {/* Theme Selector */}
         <div className={`mb-8 flex flex-col items-end gap-2 border-r-2 ${currentTheme.borderRight} pr-4 p-4 bg-black/20 backdrop-blur-sm`}>
            <span className={`font-tech text-xs tracking-[0.2em] ${currentTheme.color} font-bold`}>INTERFACE THEME</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setTheme('cyan')}
                title="Cyan"
                className={`w-6 h-6 border border-cyan-500 bg-cyan-900/20 ${theme === 'cyan' ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'hover:bg-cyan-500/50'} transition-all`}
              />
              <button 
                onClick={() => setTheme('red')}
                title="Red"
                className={`w-6 h-6 border border-red-500 bg-red-900/20 ${theme === 'red' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'hover:bg-red-500/50'} transition-all`}
              />
              <button 
                onClick={() => setTheme('gold')}
                title="Gold"
                className={`w-6 h-6 border border-yellow-500 bg-yellow-900/20 ${theme === 'gold' ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'hover:bg-yellow-500/50'} transition-all`}
              />
            </div>
         </div>

         <div className={`w-64 h-96 border-r-2 ${currentTheme.borderRight} flex flex-col gap-2 items-end pr-4 opacity-60`}>
            {Array.from({length: 12}).map((_, i) => (
               <div key={i} className={`h-1 ${currentTheme.bg}`} style={{ width: `${Math.random() * 100}%`, opacity: Math.random() }}></div>
            ))}
            <div className="flex-1"></div>
            <div className={`text-right font-tech text-4xl ${currentTheme.color} opacity-50`}>MK-{Math.floor(Math.random() * 85)}</div>
         </div>
      </div>

    </div>
  );
};

export default App;