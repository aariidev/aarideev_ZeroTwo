import { Terminal } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ActivityEntry {
  id: number;
  command: string;
  userId: string;
  username: string;
  guildId: string;
  guildName: string;
  success: boolean;
  executedAt: string;
}

interface TerminalConsoleProps {
  activity: ActivityEntry[];
}

export function TerminalConsole({ activity }: TerminalConsoleProps) {
  return (
    <div className="rounded-none border border-[#00f5d4] bg-[#050505] glow-cyan overflow-hidden flex flex-col h-[400px]">
      <div className="bg-[#00f5d4]/10 border-b border-[#00f5d4]/30 px-3 py-1.5 flex items-center gap-2 text-[#00f5d4] font-mono-custom text-xs">
        <Terminal className="h-3 w-3" />
        <span>ZeroTwo@DARLING:~$ bot-monitor --live</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono-custom text-xs text-[#00f5d4]/80 space-y-1">
        {activity.map((entry, i) => (
          <div key={entry.id} className="flex items-start animate-[fadeIn_0.3s_ease-out_forwards]">
            <span className="text-zinc-500 mr-2 flex-shrink-0">
              [{format(new Date(entry.executedAt), "HH:mm:ss")}]
            </span>
            <span className="mr-2 text-primary">{">"}</span>
            <span className="flex-1 break-all">
              <span className="text-primary font-bold">/{entry.command}</span>{" "}
              <span className="text-zinc-400">@{entry.username}</span>{" "}
              <span className="text-zinc-400">#{entry.guildName}</span>{" "}
              {entry.success ? (
                <span className="text-green-500 ml-2">✓</span>
              ) : (
                <span className="text-destructive ml-2">✗</span>
              )}
            </span>
          </div>
        ))}
        <div className="flex items-start animate-[fadeIn_0.3s_ease-out_forwards] mt-1">
          <span className="text-[#00f5d4] animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
}