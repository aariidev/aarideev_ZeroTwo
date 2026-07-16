import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Activity, Users, Server, Terminal, 
  Settings, Database, Command, Clock,
  Zap, Bell
} from 'lucide-react';

const STATS = { 
  guildCount: 12, 
  userCount: 1247, 
  commandsExecuted: 8432, 
  uptime: 3661000, 
  ping: 21, 
  botName: "Zero Two", 
  botTag: "02#1325" 
};

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

function formatUptime(ms: number) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) => {
  const isPink = color === '#ff2d6b';
  // Generamos alturas fijas pero aleatorias para el sparkline
  const heights = useMemo(() => Array.from({length: 6}, () => Math.floor(Math.random() * 60 + 40)), []);
  
  return (
    <div className="relative group rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent hover:from-white/20 transition-all duration-500">
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${isPink ? 'from-[#ff2d6b]/20' : 'from-[#00f5d4]/20'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl -z-10`} />
      
      <div className="bg-[#050810]/80 backdrop-blur-xl rounded-3xl p-6 h-full relative z-10 border border-white/5 flex flex-col justify-between shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-sm text-white/50 font-medium tracking-wide">{title}</h3>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 backdrop-blur-md">
            <Icon size={18} color={color} />
          </div>
        </div>
        
        <div>
          <div className="text-4xl font-display font-bold tracking-wider text-white">
            {value}
          </div>
          
          <div className="flex items-end gap-1.5 h-8 mt-6 w-full opacity-50 group-hover:opacity-100 transition-opacity duration-500">
            {heights.map((h, i) => (
              <div 
                key={i} 
                className="flex-1 rounded-t-sm transition-all duration-500 hover:opacity-80" 
                style={{ height: `${h}%`, backgroundColor: color }} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export function Phantom() {
  return (
    <div className="min-h-screen bg-[#050810] text-white font-sans relative overflow-hidden flex selection:bg-[#ff2d6b]/30">
      {/* Halo rosa atmosférico */}
      <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#ff2d6b] opacity-[0.08] blur-[150px] rounded-full pointer-events-none" />
      
      {/* Halo cian sutil en la esquina inferior */}
      <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[500px] bg-[#00f5d4] opacity-[0.04] blur-[150px] rounded-full pointer-events-none" />
      
      {/* Grid de puntos cristalinos */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-40" 
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Sidebar de Cristal */}
      <aside className="w-20 lg:w-24 border-r border-white/5 bg-[#050810]/40 backdrop-blur-3xl z-20 flex flex-col items-center py-8 gap-10">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff2d6b] to-[#00f5d4] p-[2px] shadow-[0_0_20px_rgba(255,45,107,0.3)]">
          <div className="w-full h-full bg-[#050810] rounded-full flex items-center justify-center">
            <Zap size={20} className="text-[#00f5d4]" />
          </div>
        </div>
        
        <nav className="flex flex-col gap-4 w-full px-3">
          {[
            { icon: Activity, label: "Dash", active: true },
            { icon: Command, label: "Cmds", active: false },
            { icon: Database, label: "Data", active: false },
            { icon: Settings, label: "Conf", active: false },
          ].map((item, i) => (
            <button 
              key={i} 
              className={`flex flex-col items-center justify-center gap-1.5 w-full aspect-square rounded-2xl transition-all duration-300 relative group
                ${item.active ? 'text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}
              `}
            >
              {item.active && (
                <div className="absolute inset-0 bg-gradient-to-b from-[#ff2d6b]/20 to-[#00f5d4]/20 rounded-2xl border border-white/10 shadow-[0_0_15px_rgba(0,245,212,0.15)]" />
              )}
              <item.icon size={22} className="relative z-10" />
              <span className="text-[10px] font-mono uppercase tracking-widest relative z-10 mt-1">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 p-8 lg:p-12 z-10 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <header className="flex items-center justify-between mb-12 relative">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#ff2d6b] to-[#00f5d4] p-[2px] animate-pulse" style={{ animationDuration: '4s' }}>
                  <div className="w-full h-full bg-[#050810] rounded-full" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#050810] rounded-full flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-[#00f5d4] rounded-full shadow-[0_0_10px_#00f5d4]" />
                </div>
              </div>
              
              <div>
                <h1 className="text-3xl lg:text-4xl font-display font-bold tracking-wider">{STATS.botName}</h1>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-sm font-mono text-white/50">{STATS.botTag}</span>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="flex items-center gap-2 bg-[#00f5d4]/10 border border-[#00f5d4]/20 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(0,245,212,0.1)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-pulse" />
                    <span className="text-[10px] text-[#00f5d4] font-medium uppercase tracking-widest">Systems Online</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
                  <span className="text-xs text-white/40 font-mono hidden sm:flex items-center gap-1.5">
                    <Clock size={12} />
                    {formatUptime(STATS.uptime)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md shadow-lg hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <Bell size={20} />
              </button>
            </div>
          </header>

          {/* Grid de Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard title="Conected Servers" value={STATS.guildCount} icon={Server} color="#00f5d4" />
            <StatCard title="Monitored Users" value={STATS.userCount} icon={Users} color="#ff2d6b" />
            <StatCard title="Executed Commands" value={STATS.commandsExecuted} icon={Terminal} color="#00f5d4" />
            <StatCard title="WebSocket Ping" value={`${STATS.ping}ms`} icon={Zap} color="#ff2d6b" />
          </div>

          {/* Layout Inferior */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Top Commands */}
            <div className="lg:col-span-5 relative group rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent">
              <div className="bg-[#050810]/70 backdrop-blur-2xl rounded-3xl p-7 h-full relative z-10 border border-white/5 shadow-2xl">
                <h2 className="text-xl font-display font-bold text-white mb-8 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#00f5d4]/10">
                    <Command size={18} className="text-[#00f5d4]" />
                  </div>
                  Command Frequency
                </h2>
                
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={TOP_COMMANDS} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 10 }}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#ff2d6b" />
                          <stop offset="100%" stopColor="#00f5d4" />
                        </linearGradient>
                      </defs>
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="command" 
                        type="category" 
                        width={90} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'JetBrains Mono' }} 
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                        contentStyle={{ 
                          backgroundColor: 'rgba(5,8,16,0.95)', 
                          backdropFilter: 'blur(16px)', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '16px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                        }}
                        itemStyle={{ color: '#00f5d4', fontFamily: 'JetBrains Mono' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', fontSize: '12px' }}
                      />
                      <Bar dataKey="count" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="lg:col-span-7 relative group rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent">
              <div className="bg-[#050810]/70 backdrop-blur-2xl rounded-3xl p-7 h-full relative z-10 border border-white/5 shadow-2xl flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-display font-bold text-white flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#ff2d6b]/10">
                      <Activity size={18} className="text-[#ff2d6b]" />
                    </div>
                    Live Telemetry
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff2d6b] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff2d6b]"></span>
                    </span>
                    <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Real-time</span>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col gap-3">
                  {ACTIVITY.map((item, i) => {
                    const isWin = item.result === 'win';
                    const isBan = item.action === 'ban';
                    const isLose = item.result === 'lose';
                    
                    let dotColor = 'bg-[#00f5d4] shadow-[0_0_10px_rgba(0,245,212,0.4)]';
                    let badgeStyle = 'text-[#00f5d4] border-[#00f5d4]/20 bg-[#00f5d4]/10';
                    
                    if (isWin) {
                      dotColor = 'bg-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.4)]';
                      badgeStyle = 'text-[#00ff88] border-[#00ff88]/20 bg-[#00ff88]/10';
                    } else if (isBan || isLose) {
                      dotColor = 'bg-[#ff2d6b] shadow-[0_0_10px_rgba(255,45,107,0.4)]';
                      badgeStyle = 'text-[#ff2d6b] border-[#ff2d6b]/20 bg-[#ff2d6b]/10';
                    }

                    return (
                      <div key={i} className="group/row flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-300">
                        <div className="flex items-center gap-4 mb-2 sm:mb-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white/90 group-hover/row:text-white transition-colors">{item.user}</span>
                            <span className="text-xs text-white/40 font-mono">{item.guild}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 ml-6 sm:ml-0">
                          <div className={`px-2.5 py-1 rounded-lg border ${badgeStyle} text-[10px] font-mono uppercase tracking-widest`}>
                            /{item.action}
                          </div>
                          <span className="text-xs text-white/30 font-mono tabular-nums">{item.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
