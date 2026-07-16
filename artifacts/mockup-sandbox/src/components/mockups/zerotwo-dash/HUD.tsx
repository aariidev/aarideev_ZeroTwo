import React, { useState, useEffect } from "react";
import { Terminal, Crosshair, Zap, Server, Users, Radio, AlertTriangle, ShieldAlert } from "lucide-react";

// Data
const STATS = { guildCount: 12, userCount: 1247, commandsExecuted: 8432, uptime: 3661000, ping: 21, botName: "Zero Two", botTag: "02#1325" };
const TOP_COMMANDS = [
  { command: "blackjack", count: 1240 },
  { command: "help", count: 980 },
  { command: "slots", count: 870 },
  { command: "8ball", count: 654 },
  { command: "wallet", count: 521 },
];
const ACTIVITY = [
  { time: "20:49:12", user: "aariidev", guild: "The Garden", action: "blackjack", result: "win" },
  { time: "20:49:08", user: "Darling02", guild: "Zero Squad", action: "slots", result: "lose" },
  { time: "20:48:55", user: "ParasiteX", guild: "The Garden", action: "ban", result: "ok" },
  { time: "20:48:41", user: "Hiro_016", guild: "Plantation", action: "help", result: "ok" },
  { time: "20:48:30", user: "Kokoro", guild: "Zero Squad", action: "wallet", result: "ok" },
  { time: "20:48:18", user: "Mitsuru", guild: "Plantation", action: "warn", result: "ok" },
  { time: "20:47:59", user: "Ichigo", guild: "The Garden", action: "mute", result: "ok" },
  { time: "20:47:44", user: "aariidev", guild: "The Garden", action: "blackjack", result: "win" },
];

export function HUD() {
  const [time, setTime] = useState("");
  
  useEffect(() => {
    // Set initial time on client to avoid hydration mismatch if SSR (though mostly client-side here)
    setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#050810] text-gray-300 font-sans overflow-hidden relative flex flex-col selection:bg-[#ff2d6b] selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        .font-orbitron { font-family: 'Orbitron', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .scanlines {
          background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2));
          background-size: 100% 4px;
        }
        .bg-grid {
          background-image: 
            linear-gradient(rgba(0, 245, 212, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 245, 212, 0.07) 1px, transparent 1px);
          background-size: 30px 30px;
        }
        .bracket-panel {
          position: relative;
        }
        .bracket-panel::before, .bracket-panel::after {
          content: '';
          position: absolute;
          width: 16px;
          height: 16px;
          pointer-events: none;
          z-index: 10;
        }
        .bracket-panel::before {
          top: -1px; left: -1px;
          border-top: 2px solid #ff2d6b;
          border-left: 2px solid #ff2d6b;
        }
        .bracket-panel::after {
          bottom: -1px; right: -1px;
          border-bottom: 2px solid #00f5d4;
          border-right: 2px solid #00f5d4;
        }
        .chip-clip {
          clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
        }
        .progress-clip {
          clip-path: polygon(0 0, 100% 0, calc(100% - 4px) 100%, 4px 100%);
        }
        .terminal-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .terminal-scroll::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.3);
        }
        .terminal-scroll::-webkit-scrollbar-thumb {
          background: #ff2d6b;
        }
      `}</style>

      {/* FX Background */}
      <div className="absolute inset-0 bg-grid pointer-events-none z-0"></div>
      <div className="absolute inset-0 scanlines pointer-events-none z-50 opacity-40 mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#050810_100%)] pointer-events-none z-0"></div>

      {/* Decorative center target */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none z-0 flex items-center justify-center">
        <div className="w-[100vw] max-w-[1200px] aspect-square rounded-full border-[1px] border-[#ff2d6b] border-dashed animate-[spin_120s_linear_infinite]"></div>
        <div className="w-[80vw] max-w-[800px] aspect-square absolute rounded-full border-[1px] border-[#00f5d4] opacity-50"></div>
        <div className="w-[1px] h-[150vh] absolute bg-white/20"></div>
        <div className="h-[1px] w-[150vw] absolute bg-white/20"></div>
      </div>

      {/* SYSTEM WARNING TOP BAR */}
      <div className="w-full bg-[#ff2d6b] text-black font-orbitron text-[10px] md:text-xs px-4 py-1 flex justify-between items-center tracking-[0.3em] font-bold z-40">
        <span>SYS.MONITOR // ACTIVE</span>
        <span className="flex items-center gap-2 animate-pulse"><AlertTriangle size={12}/> COMBAT MODE ENGAGED</span>
        <span>AUTH: FRANXX_02</span>
      </div>

      {/* HEADER */}
      <header className="relative z-30 flex flex-col md:flex-row items-center justify-between px-6 py-4 border-b border-[#ff2d6b]/30 bg-black/60 backdrop-blur-md gap-4 md:gap-0">
        {/* Logo */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-start">
          <div className="w-12 h-12 bg-[#ff2d6b] flex items-center justify-center font-orbitron font-black text-black text-xl" style={{ clipPath: 'polygon(0 0, 100% 0, 75% 100%, 25% 100%)' }}>
            02
          </div>
          <div className="flex flex-col">
            <div className="font-orbitron font-bold text-2xl text-white tracking-widest uppercase leading-none">
              {STATS.botName}
            </div>
            <div className="text-[#00f5d4] font-mono text-[10px] tracking-widest mt-1">
              ID: {STATS.botTag}
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-10 font-orbitron text-xs tracking-[0.3em] text-gray-500">
          <a href="#" className="text-[#ff2d6b] relative group">
            MONITOR
            <span className="absolute -bottom-2 left-0 w-full h-[2px] bg-[#ff2d6b]"></span>
          </a>
          <a href="#" className="hover:text-[#00f5d4] transition-colors relative group">
            MODULES
            <span className="absolute -bottom-2 left-0 w-full h-[2px] bg-[#00f5d4] scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
          </a>
          <a href="#" className="hover:text-[#00f5d4] transition-colors relative group">
            DATABASE
            <span className="absolute -bottom-2 left-0 w-full h-[2px] bg-[#00f5d4] scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
          </a>
        </nav>

        {/* Stats Chips */}
        <div className="flex flex-wrap justify-center md:justify-end items-center text-[10px] md:text-xs font-mono gap-2 w-full md:w-auto">
          <div className="chip-clip flex items-center gap-2 bg-[#ff2d6b]/10 border border-[#ff2d6b]/50 px-3 py-1 text-[#ff2d6b]">
            <Server size={12}/>
            <span className="opacity-70 hidden xl:inline">GUILDS</span>
            <span className="font-bold text-white">{STATS.guildCount}</span>
          </div>
          <span className="text-[#ff2d6b] opacity-30 italic">/</span>
          <div className="chip-clip flex items-center gap-2 bg-[#00f5d4]/10 border border-[#00f5d4]/50 px-3 py-1 text-[#00f5d4]">
            <Users size={12}/>
            <span className="opacity-70 hidden xl:inline">USERS</span>
            <span className="font-bold text-white">{STATS.userCount}</span>
          </div>
          <span className="text-[#ff2d6b] opacity-30 italic">/</span>
          <div className="chip-clip flex items-center gap-2 bg-white/5 border border-white/20 px-3 py-1 text-white">
            <Zap size={12}/>
            <span className="opacity-70 hidden xl:inline">OPS</span>
            <span className="font-bold">{STATS.commandsExecuted}</span>
          </div>
          <span className="text-[#ff2d6b] opacity-30 italic">/</span>
          <div className="chip-clip flex items-center gap-2 bg-[#00f5d4]/10 border border-[#00f5d4]/50 px-3 py-1 text-[#00f5d4]">
            <Radio size={12}/>
            <span className="opacity-70 hidden xl:inline">PING</span>
            <span className="font-bold text-white">{STATS.ping}ms</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col lg:flex-row relative z-20 p-4 md:p-8 gap-8 overflow-hidden h-full min-h-[500px]">
        
        {/* LEFT PANEL - TERMINAL */}
        <div className="flex-1 bracket-panel bg-black/60 backdrop-blur-md border border-[#ff2d6b]/30 flex flex-col relative h-full">
          <div className="absolute top-0 right-0 bg-[#ff2d6b] text-black font-mono text-[9px] px-2 py-0.5">SEC-01</div>
          
          <div className="p-4 border-b border-[#ff2d6b]/20 flex items-center gap-3 bg-[#ff2d6b]/5">
            <Terminal size={18} className="text-[#ff2d6b]" />
            <h2 className="font-orbitron tracking-widest text-[#ff2d6b] text-sm md:text-base font-bold">LIVE_ACTIVITY // DATA_STREAM</h2>
            <div className="ml-auto flex gap-1">
              <div className="w-2 h-2 rounded-full bg-[#ff2d6b] animate-ping"></div>
              <div className="w-2 h-2 rounded-full bg-[#ff2d6b]"></div>
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto terminal-scroll font-mono text-[10px] md:text-xs leading-relaxed">
            <div className="mb-4 text-gray-500">
              <p>Initialize protocol: DARLING_CONNECT...</p>
              <p>Establishing neural link... <span className="text-[#00f5d4]">[OK]</span></p>
              <p>Sync ratio: 98.4%</p>
              <p className="text-[#ff2d6b]">Awaiting combat data...</p>
              <br/>
            </div>
            
            <div className="space-y-1.5">
              {ACTIVITY.map((act, i) => (
                <div key={i} className="flex flex-wrap md:flex-nowrap gap-2 md:gap-3 hover:bg-white/5 px-2 py-1 transition-colors border-l-2 border-transparent hover:border-[#ff2d6b]">
                  <span className="text-[#00f5d4]/70 shrink-0">[{act.time}]</span>
                  <span className="text-gray-600 hidden sm:inline">ZT@DARLING:~$</span>
                  <span className="text-yellow-400/90 w-20 md:w-28 truncate shrink-0">{act.user}</span>
                  <span className="text-gray-400 w-24 md:w-32 truncate shrink-0 hidden md:block">@{act.guild}</span>
                  <span className="text-[#ff2d6b] w-24 shrink-0">exec {act.action}</span>
                  <span className="flex-1 text-right">
                    {act.result === 'win' || act.result === 'ok' ? 
                      <span className="text-[#00f5d4]">[ OK ]</span> : 
                      <span className="text-red-500">[ ERR ]</span>
                    }
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 px-2 py-1 mt-2">
                <span className="text-[#00f5d4]/70 shrink-0">[{time || "..."}]</span>
                <span className="text-gray-600">ZT@DARLING:~$</span>
                <span className="w-2.5 h-4 bg-[#ff2d6b] animate-pulse"></span>
              </div>
            </div>
          </div>
        </div>

        {/* DIAGONAL DIVIDER (Desktop) */}
        <div className="hidden lg:flex w-8 xl:w-16 items-center justify-center relative">
          <svg className="absolute h-[120%] w-full" style={{ top: '-10%' }} preserveAspectRatio="none" viewBox="0 0 100 100">
            <line x1="100" y1="0" x2="0" y2="100" stroke="#00f5d4" strokeWidth="0.5" strokeDasharray="4 4" className="opacity-40" />
            <line x1="80" y1="0" x2="-20" y2="100" stroke="#ff2d6b" strokeWidth="0.2" className="opacity-20" />
          </svg>
        </div>

        {/* RIGHT PANEL - COMMANDS */}
        <div className="flex-[0.8] xl:flex-[0.6] bracket-panel bg-black/60 backdrop-blur-md border border-[#00f5d4]/30 flex flex-col relative">
          <div className="absolute top-0 right-0 bg-[#00f5d4] text-black font-mono text-[9px] px-2 py-0.5">SEC-02</div>
          
          <div className="p-4 border-b border-[#00f5d4]/20 flex items-center gap-3 bg-[#00f5d4]/5">
            <Crosshair size={18} className="text-[#00f5d4]" />
            <h2 className="font-orbitron tracking-widest text-[#00f5d4] text-sm md:text-base font-bold">WEAPON_SYSTEMS // USAGE</h2>
          </div>
          
          <div className="p-6 flex-1 flex flex-col justify-center">
            
            <div className="space-y-8">
              {TOP_COMMANDS.map((cmd, i) => {
                const maxCount = Math.max(...TOP_COMMANDS.map(c => c.count));
                const percentage = (cmd.count / maxCount) * 100;
                
                return (
                  <div key={i} className="relative group">
                    <div className="flex justify-between font-mono text-xs mb-2">
                      <span className="text-white uppercase tracking-[0.2em] flex items-center gap-2">
                        <span className="text-[#00f5d4] opacity-50">0{i+1}.</span>
                        {cmd.command}
                      </span>
                      <span className="text-[#00f5d4]">{cmd.count} <span className="text-gray-600">OPS</span></span>
                    </div>
                    <div className="h-2 w-full bg-black/80 border border-white/10 relative progress-clip">
                      <div 
                        className="absolute top-0 left-0 h-full transition-all duration-1000 ease-out"
                        style={{ 
                          width: `${percentage}%`,
                          background: `linear-gradient(90deg, #ff2d6b 0%, #00f5d4 100%)`,
                          boxShadow: '0 0 10px rgba(0, 245, 212, 0.3)'
                        }}
                      ></div>
                    </div>
                    {/* Decorative ticks */}
                    <div className="absolute -bottom-3 left-0 w-full flex justify-between px-1 opacity-20">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="w-[1px] h-1 bg-white"></div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="mt-12 p-4 border border-[#ff2d6b]/20 bg-[#ff2d6b]/5 rounded-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#ff2d6b]"></div>
              <div className="flex items-start gap-3">
                <ShieldAlert className="text-[#ff2d6b] shrink-0 mt-0.5" size={16} />
                <div className="font-mono text-[10px] text-gray-400">
                  <span className="text-[#ff2d6b] font-bold block mb-1">SYSTEM NOTIFICATION</span>
                  Energy levels stable. Franxx operating at optimal capacity. Maintain sync ratio above 90% for maximum output.
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </main>

      {/* FOOTER */}
      <footer className="relative z-30 flex flex-col md:flex-row justify-between items-center px-6 py-2 border-t border-[#ff2d6b]/20 bg-black/80 font-mono text-[10px] text-gray-500 tracking-widest gap-2 md:gap-0 mt-auto">
        <div className="flex gap-6">
          <span className="hover:text-[#00f5d4] transition-colors cursor-crosshair">LAT: 35.6895° N, LON: 139.6917° E</span>
          <span className="hidden md:inline">SYS.VER: 2.14.7-FRANXX</span>
        </div>
        
        {/* Center Target Decorative */}
        <div className="hidden lg:flex items-center gap-2">
           <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#ff2d6b]/50"></div>
           <Crosshair size={12} className="text-[#ff2d6b]"/>
           <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#ff2d6b]/50"></div>
        </div>

        <div className="flex items-center gap-3 text-[#00f5d4]">
          <span className="text-[#ff2d6b] animate-pulse">●</span>
          <span>CYCLES COMPLETED: {STATS.commandsExecuted * 12}</span>
        </div>
      </footer>
    </div>
  )
}
