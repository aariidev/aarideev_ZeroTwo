import React from "react";
import { 
  Terminal, 
  Activity, 
  Users, 
  Settings, 
  Database, 
  LayoutDashboard,
  Server,
  Zap,
  ShieldAlert,
  Clock,
  Command,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

// --- Mock Data ---
const STATS = { 
  guildCount: 12, 
  userCount: 1247, 
  commandsExecuted: 8432, 
  uptime: "10h 10m 10s", 
  ping: 21, 
  botName: "Zero Two", 
  botTag: "02#1325",
  warningsTotal: 34,
  commandsToday: 127
};

const STATS_CARDS = [
  { label: "CONNECTED GUILDS", value: STATS.guildCount, delta: "+1 this week", trend: "up", icon: Server },
  { label: "TOTAL USERS", value: STATS.userCount.toLocaleString(), delta: "+15 today", trend: "up", icon: Users },
  { label: "COMMANDS RUN", value: STATS.commandsExecuted.toLocaleString(), delta: "+324 this week", trend: "up", icon: Command },
  { label: "COMMANDS TODAY", value: STATS.commandsToday, delta: "+12 vs yesterday", trend: "up", icon: Zap },
  { label: "WARNINGS ISSUED", value: STATS.warningsTotal, delta: "-2 this week", trend: "down", icon: ShieldAlert },
  { label: "SYSTEM UPTIME", value: STATS.uptime, delta: "99.9% stable", trend: "neutral", icon: Clock },
];

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

const ACTIVE_SERVERS = [
  { name: "The Garden", members: 450, health: "healthy", region: "us-east" },
  { name: "Zero Squad", members: 120, health: "healthy", region: "eu-west" },
  { name: "Plantation", members: 677, health: "warning", region: "asia" },
];

// --- Utilities ---
const getAvatarColor = (name: string) => {
  const colors = [
    "bg-[#ff2d6b]/20 text-[#ff2d6b]", 
    "bg-[#00f5d4]/20 text-[#00f5d4]", 
    "bg-[#f5c518]/20 text-[#f5c518]", 
    "bg-purple-500/20 text-purple-400",
    "bg-blue-500/20 text-blue-400"
  ];
  return colors[name.length % colors.length];
};

// --- Components ---
const SidebarItem = ({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) => (
  <div className="group relative flex items-center justify-center w-12 h-12 rounded-xl mb-2 cursor-pointer transition-all duration-300">
    <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${active ? 'bg-[#ff2d6b]/10 border border-[#ff2d6b]/30 shadow-[0_0_15px_rgba(255,45,107,0.15)]' : 'group-hover:bg-white/5 border border-transparent'}`} />
    <Icon className={`relative z-10 w-5 h-5 transition-colors duration-300 ${active ? 'text-[#ff2d6b]' : 'text-slate-400 group-hover:text-slate-200'}`} />
    
    {/* Tooltip */}
    <div className="absolute left-16 px-2 py-1 bg-[#0a0f1a] border border-[#ff2d6b]/20 text-slate-200 text-xs font-medium rounded opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap z-50">
      {label}
    </div>
  </div>
);

export function Sakura() {
  return (
    <div className="min-h-screen bg-[#050810] text-slate-200 font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[72px] bg-[#03050a] border-r border-[#ff2d6b]/20 flex flex-col items-center py-6 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)] flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff2d6b] to-[#00f5d4] p-[2px] mb-8 shadow-[0_0_20px_rgba(255,45,107,0.3)]">
          <div className="w-full h-full bg-[#050810] rounded-full flex items-center justify-center">
            <span className="font-bold text-xs text-white">02</span>
          </div>
        </div>
        
        <nav className="flex-1 w-full flex flex-col items-center">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
          <SidebarItem icon={Activity} label="Activity Log" />
          <SidebarItem icon={Server} label="Guilds" />
          <SidebarItem icon={Users} label="Users" />
          <SidebarItem icon={Database} label="Database" />
        </nav>
        
        <SidebarItem icon={Settings} label="Settings" />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Band */}
        <header className="h-16 flex items-center px-6 bg-gradient-to-r from-[#ff2d6b]/10 via-[#ff2d6b]/5 to-transparent border-b border-[#ff2d6b]/10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="text-[#ff2d6b]">/</span> {STATS.botName}
              <span className="text-xs font-mono font-normal text-slate-500 ml-2 px-2 py-0.5 rounded-full bg-black/40 border border-white/5">
                {STATS.botTag}
              </span>
            </h1>
            
            <div className="h-4 w-px bg-slate-800 mx-2" />
            
            <div className="flex items-center gap-2 px-3 py-1 bg-[#00f5d4]/10 border border-[#00f5d4]/20 rounded-full">
              <div className="w-2 h-2 rounded-full bg-[#00f5d4] animate-pulse shadow-[0_0_8px_#00f5d4]" />
              <span className="text-[10px] font-bold tracking-wider text-[#00f5d4] uppercase">System Active</span>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-black/20 border border-white/5 rounded-full ml-2">
              <Activity className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-mono text-slate-300">{STATS.ping}ms</span>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* Stat Cards (Row) */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {STATS_CARDS.map((stat, i) => (
              <div key={i} className="bg-[#0a0f1a] border border-slate-800/60 rounded-xl p-4 flex flex-col relative overflow-hidden group hover:border-[#ff2d6b]/30 transition-colors">
                {/* Glow effect */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff2d6b]/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none group-hover:bg-[#ff2d6b]/10 transition-colors" />
                
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                  <stat.icon className="w-4 h-4 text-slate-600 group-hover:text-[#ff2d6b]/70 transition-colors" />
                </div>
                
                <div className="text-2xl font-bold font-mono text-white mb-1">
                  {stat.value}
                </div>
                
                <div className="flex items-center gap-1 mt-auto">
                  <span className={`text-xs font-mono font-medium ${
                    stat.trend === 'up' ? 'text-[#22c55e]' : 
                    stat.trend === 'down' ? 'text-[#00f5d4]' : 
                    'text-slate-400'
                  }`}>
                    {stat.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Lower Section Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[400px]">
            
            {/* Col 1: Activity Feed (40%) */}
            <div className="lg:col-span-5 flex flex-col bg-[#0a0f1a] border border-slate-800/60 rounded-xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ff2d6b] to-transparent opacity-50" />
              
              <div className="p-4 border-b border-slate-800/60 flex items-center justify-between bg-black/20">
                <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#ff2d6b]" />
                  LIVE ACTIVITY
                </h2>
                <span className="text-[10px] font-mono text-[#00f5d4] border border-[#00f5d4]/20 bg-[#00f5d4]/10 px-2 py-0.5 rounded">Streaming</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
                {ACTIVITY.map((act, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 hover:bg-white/[0.03] rounded-lg transition-colors group">
                    <span className="text-xs font-mono text-slate-500 w-16 shrink-0">{act.time}</span>
                    
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono ${getAvatarColor(act.user)} shrink-0 border border-current opacity-80 group-hover:opacity-100`}>
                      {act.user.substring(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200 truncate">{act.user}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#050810] border border-slate-800 text-slate-300">
                          /{act.action}
                        </span>
                        
                        {act.result === 'win' || act.result === 'ok' ? (
                          <CheckCircle2 className="w-3 h-3 text-[#22c55e] ml-auto shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-[#f5c518] ml-auto shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 truncate mt-0.5">via {act.guild}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Col 2: Top Commands (35%) */}
            <div className="lg:col-span-4 flex flex-col bg-[#0a0f1a] border border-slate-800/60 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800/60 bg-black/20 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  <Command className="w-4 h-4 text-[#00f5d4]" />
                  COMMAND FREQUENCY
                </h2>
              </div>
              
              <div className="flex-1 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={TOP_COMMANDS}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ff2d6b" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#00f5d4" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" opacity={0.5} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="command" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'JetBrains Mono' }} 
                      width={80}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                      contentStyle={{ backgroundColor: '#0a0f1a', borderColor: '#334155', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                      itemStyle={{ color: '#00f5d4' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                      {TOP_COMMANDS.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="url(#barGrad)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Col 3: Active Nodes (25%) */}
            <div className="lg:col-span-3 flex flex-col bg-[#0a0f1a] border border-slate-800/60 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800/60 bg-black/20">
                <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#f5c518]" />
                  ACTIVE NODES
                </h2>
              </div>
              
              <div className="flex flex-col gap-3 p-4">
                {ACTIVE_SERVERS.map((server, i) => (
                  <div key={i} className="flex flex-col p-3 rounded-lg bg-[#050810] border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
                    
                    <div className="flex items-center justify-between mb-2 relative z-10">
                      <span className="text-sm font-bold text-slate-200">{server.name}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${server.health === 'healthy' ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]' : 'bg-[#f5c518] shadow-[0_0_8px_#f5c518] animate-pulse'}`} />
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${server.health === 'healthy' ? 'text-[#22c55e]' : 'text-[#f5c518]'}`}>
                          {server.health}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 relative z-10">
                      <span>{server.members} members</span>
                      <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                        {server.region}
                      </span>
                    </div>

                    {/* Subtle background glow */}
                    <div className={`absolute bottom-0 right-0 w-16 h-16 rounded-full blur-xl -mr-8 -mb-8 pointer-events-none opacity-20 transition-opacity group-hover:opacity-30 ${server.health === 'healthy' ? 'bg-[#22c55e]' : 'bg-[#f5c518]'}`} />
                  </div>
                ))}

                <button className="mt-2 w-full py-2.5 rounded-lg border border-dashed border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-widest hover:border-[#ff2d6b]/50 hover:text-[#ff2d6b] transition-colors flex items-center justify-center gap-2">
                  View All Nodes
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Global Styles for Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 4px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
