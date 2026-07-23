import { SlashCommandBuilder, ChatInputCommandInteraction, Client, Collection } from "discord.js";

export interface Command {
  data: any;
  cooldown?: number;
  execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void>;
}

export interface BotClient extends Client {
  commands: Collection<string, Command>;
  cooldowns: Collection<string, Collection<string, number>>;
}
