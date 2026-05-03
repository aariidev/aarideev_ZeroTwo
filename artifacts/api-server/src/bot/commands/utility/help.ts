import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { BotClient, Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📋 Muestra todos los comandos disponibles")
    .addStringOption((opt) =>
      opt.setName("comando").setDescription("Comando específico")
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const botClient = client as BotClient;
    const commandName = interaction.options.getString("comando");

    if (commandName) {
      const cmd = botClient.commands.get(commandName);
      if (!cmd) {
        return interaction.reply({ content: `No encontré el comando \`${commandName}\`.`, ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📋 /${cmd.data.name}`)
        .setDescription(cmd.data.description)
        .addFields({ name: "Cooldown", value: `${cmd.cooldown ?? 3}s`, inline: true })
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });
      return interaction.reply({ embeds: [embed] });
    }

    const categories: Record<string, string[]> = {
      "🛠️ Utilidad": [],
      "🛡️ Moderación": [],
      "🎮 Diversión": [],
    };

    for (const [, cmd] of botClient.commands) {
      const name = `\`/${cmd.data.name}\``;
      if (["ping", "avatar", "serverinfo", "userinfo", "help"].includes(cmd.data.name)) {
        categories["🛠️ Utilidad"].push(name);
      } else if ([
        "ban", "kick", "mute", "unmute", "warn", "warns", "clearwarns", "purge",
        "timeout", "untimeout", "unban", "slowmode", "lock", "unlock", "logs"
      ].includes(cmd.data.name)) {
        categories["🛡️ Moderación"].push(name);
      } else {
        categories["🎮 Diversión"].push(name);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📋 Comandos de ZeroTwo v2.0")
      .setDescription("Usa `/help <comando>` para ver más detalles de un comando.")
      .setThumbnail(client.user?.displayAvatarURL() ?? null)
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    for (const [cat, cmds] of Object.entries(categories)) {
      if (cmds.length > 0) {
        embed.addFields({ name: cat, value: cmds.join("  "), inline: false });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
