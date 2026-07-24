/**
 * /beta — programa de beta testers de Zero Two.
 *
 * Subcomandos:
 *  info     — público
 *  status   — público (tu estado)
 *  features — solo beta / owner
 *  feedback — solo beta / owner
 *  manage   — solo owner (add | remove | list)
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import {
  isBetaTester,
  getAllBetatesters,
  addBetaTester,
  removeBetaTester,
  listBetaFeatures,
} from "../../lib/betatesters.js";
import { ownerUserIds } from "../../lib/specialUser.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const PURPLE = 0x9d4edd;
const GREEN = 0x00ff9f;

function isOwner(userId: string): boolean {
  return ownerUserIds().includes(userId);
}

function ephemeralReply(
  interaction: ChatInputCommandInteraction,
  embed: EmbedBuilder,
) {
  return interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("beta")
    .setDescription("🧪 Programa beta — features de lab, status y feedback")
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("ℹ️ Qué es el programa beta de Zero Two"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("🪪 Tu estado — ¿eres beta o dev?"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("features")
        .setDescription("🎯 Features experimentales del lab (beta)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("feedback")
        .setDescription("💬 Cómo reportar bugs o ideas al lab"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("manage")
        .setDescription("👥 Gestionar testers (solo owner)")
        .addStringOption((o) =>
          o
            .setName("action")
            .setDescription("⚡ Acción a realizar")
            .setRequired(true)
            .addChoices(
              { name: "➕ Añadir", value: "add" },
              { name: "➖ Quitar", value: "remove" },
              { name: "📋 Listar", value: "list" },
            ),
        )
        .addUserOption((o) =>
          o
            .setName("usuario")
            .setDescription("👤 Usuario (add / remove)")
            .setRequired(false),
        ),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
  ): Promise<void> {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const botIcon = client.user?.displayAvatarURL();

    // ── info ────────────────────────────────────────────────────────────────
    if (sub === "info") {
      const beta = isBetaTester(userId);
      const embed = new EmbedBuilder()
        .setColor(PURPLE)
        .setAuthor({
          name: `Zero Two · Beta ${BOT_VERSION}`,
          iconURL: botIcon,
        })
        .setTitle("🧪 Programa de Beta Testers")
        .setDescription(
          "Probad features nuevas antes que el resto del nexo y ayudadme a pulirlas, Darling.",
        )
        .addFields(
          {
            name: "¿Qué ganas?",
            value: [
              "• Acceso durante **mantenimiento**",
              "• **Sin cooldowns** de comandos",
              "• Features experimentales (`/beta features`)",
              "• Canal directo de feedback con la dev",
            ].join("\n"),
          },
          {
            name: "Tu estado",
            value: beta
              ? "✅ **Eres beta tester** (o owner) — acceso completo"
              : "❌ Aún no estás en la lista. Pídele acceso a la dueña del bot.",
          },
          {
            name: "Comandos",
            value:
              "`/beta status` · `/beta features` · `/beta feedback` · `/beta manage` (owner)",
          },
        )
        .setFooter({ text: "Config: BETA_TESTER_IDS en .env + data/beta-testers.json" })
        .setTimestamp();

      await ephemeralReply(interaction, embed);
      return;
    }

    // ── status ──────────────────────────────────────────────────────────────
    if (sub === "status") {
      const beta = isBetaTester(userId);
      const owner = isOwner(userId);
      const total = getAllBetatesters().length;

      const embed = new EmbedBuilder()
        .setColor(beta ? GREEN : PINK)
        .setAuthor({
          name: `Beta status · ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle(beta ? "🪪 Acceso beta activo" : "🪪 Sin acceso beta")
        .addFields(
          {
            name: "Rol",
            value: owner
              ? "👑 Owner (beta implícito)"
              : beta
                ? "🧪 Beta tester"
                : "👤 Usuario estándar",
            inline: true,
          },
          {
            name: "Testers en lista",
            value: `\`${total}\``,
            inline: true,
          },
          {
            name: "Privilegios",
            value: beta
              ? "Mantenimiento · sin cooldown · features beta"
              : "Ninguno especial",
          },
        )
        .setFooter({ text: `ID: ${userId}` })
        .setTimestamp();

      await ephemeralReply(interaction, embed);
      return;
    }

    // ── features ────────────────────────────────────────────────────────────
    if (sub === "features") {
      if (!isBetaTester(userId)) {
        await ephemeralReply(
          interaction,
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle("🚫 Solo beta testers")
            .setDescription(
              "Esta lista es para quienes ya están en el programa.\nUsa `/beta info` o habla con la dev.",
            ),
        );
        return;
      }

      const features = listBetaFeatures();
      const embed = new EmbedBuilder()
        .setColor(GREEN)
        .setAuthor({
          name: `Features beta · ${BOT_VERSION}`,
          iconURL: botIcon,
        })
        .setTitle("🎯 Laboratorio experimental")
        .setDescription(
          "Cosas que estás ayudando a probar. Si algo se rompe… es parte del plan, Darling.",
        )
        .addFields(
          features.map((f) => ({
            name: `${f.enabled ? "✅" : "⏳"} ${f.name}`,
            value: f.description,
            inline: false,
          })),
        )
        .setFooter({ text: `${features.length} features · /beta feedback` })
        .setTimestamp();

      await ephemeralReply(interaction, embed);
      return;
    }

    // ── feedback ────────────────────────────────────────────────────────────
    if (sub === "feedback") {
      if (!isBetaTester(userId)) {
        await ephemeralReply(
          interaction,
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle("🚫 Solo beta testers")
            .setDescription("Necesitas acceso beta para mandar feedback por este canal."),
        );
        return;
      }

      const dash = process.env.DASHBOARD_URL ?? "http://localhost:5173";
      const embed = new EmbedBuilder()
        .setColor(PURPLE)
        .setTitle("💬 Feedback & bugs")
        .setDescription(
          "Cuéntame qué falló o qué te enamoró. Cuanto más concreto, más rápido lo arreglo.",
        )
        .addFields(
          {
            name: "Cómo reportar",
            value: [
              "1. Reproduce el bug si puedes",
              "2. Copia comando, guild y hora",
              "3. Escribe a la dev o abre un ticket de soporte",
              `4. Dashboard: ${dash}`,
            ].join("\n"),
          },
          {
            name: "Plantilla rápida",
            value:
              "```\nComando:\nEsperado:\nObtenido:\nGuild ID:\nExtra:\n```",
          },
        )
        .setFooter({ text: "Gracias por romper cosas con estilo 💜" })
        .setTimestamp();

      await ephemeralReply(interaction, embed);
      return;
    }

    // ── manage ──────────────────────────────────────────────────────────────
    if (sub === "manage") {
      if (!isOwner(userId)) {
        await ephemeralReply(
          interaction,
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle("🚫 Solo owners")
            .setDescription(
              "Gestionar la lista beta es exclusivo de `OWNER_IDS`.",
            )
            .setFooter({ text: `Tu ID: ${userId}` }),
        );
        return;
      }

      const action = interaction.options.getString("action", true);
      const target = interaction.options.getUser("usuario");

      if (action === "list") {
        const testers = getAllBetatesters();
        const embed = new EmbedBuilder()
          .setColor(GREEN)
          .setAuthor({ name: "Beta manage · list", iconURL: botIcon })
          .setTitle("👥 Beta testers")
          .setDescription(
            testers.length
              ? testers.map((id, i) => `${i + 1}. <@${id}> \`${id}\``).join("\n")
              : "_Lista vacía — usa add o `BETA_TESTER_IDS` en .env_",
          )
          .setFooter({
            text: `${testers.length} en lista (env + data/beta-testers.json)`,
          })
          .setTimestamp();

        await ephemeralReply(interaction, embed);
        return;
      }

      if (!target) {
        await ephemeralReply(
          interaction,
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle("❌ Falta usuario")
            .setDescription(
              `Para **${action}** necesitas la opción \`usuario\`.`,
            ),
        );
        return;
      }

      if (action === "add") {
        const { already } = addBetaTester(target.id);
        await ephemeralReply(
          interaction,
          new EmbedBuilder()
            .setColor(GREEN)
            .setTitle(already ? "ℹ️ Ya estaba en la lista" : "✅ Beta tester añadido")
            .setDescription(
              already
                ? `${target} ya tenía acceso beta.`
                : `${target} ahora es **beta tester**.\nPersistido en \`data/beta-testers.json\`.`,
            )
            .addFields({
              name: "Tip",
              value:
                "Para dejarlo también en el `.env`: añade su ID a `BETA_TESTER_IDS`.",
            })
            .setTimestamp(),
        );
        return;
      }

      if (action === "remove") {
        const { wasPresent, onlyEnv } = removeBetaTester(target.id);
        await ephemeralReply(
          interaction,
          new EmbedBuilder()
            .setColor(wasPresent ? PINK : 0x888888)
            .setTitle(
              wasPresent ? "✅ Beta tester eliminado" : "ℹ️ No estaba en la lista",
            )
            .setDescription(
              wasPresent
                ? `${target} ya no tiene acceso beta en esta instancia.`
                : `${target} no figuraba como beta tester.`,
            )
            .addFields(
              onlyEnv
                ? {
                    name: "Nota .env",
                    value:
                      "Seguía en `BETA_TESTER_IDS`. Lo excluimos en runtime; quítalo del `.env` para un corte permanente al reiniciar.",
                  }
                : {
                    name: "Persistencia",
                    value: "Actualizado en `data/beta-testers.json`.",
                  },
            )
            .setTimestamp(),
        );
        return;
      }
    }

    await ephemeralReply(
      interaction,
      new EmbedBuilder()
        .setColor(PINK)
        .setTitle("❌ Subcomando desconocido")
        .setDescription("Usa `/beta info` para ver las opciones."),
    );
  },
};

export default command;
