import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createSection,
  modalFieldsToRecord,
  Separator,
  createRow,
  createEmbed,
} from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "#database";
import { generateTranscript } from "./manage.js";

// Função compartilhada para renomear
async function processRename(interaction: any) {
  const { channel, fields } = interaction;
  if (!channel?.isTextBased()) return;

  try {
    const data = modalFieldsToRecord(fields);
    const newName = data.new_name as string;

    if (!newName) {
      await interaction.reply({
        content: "Nome inválido.",
        flags: ["Ephemeral"],
      });
      return;
    }

    await interaction.deferReply({ flags: ["Ephemeral"] });

    const toolEmoji = "🔨";
    const formattedName = `${toolEmoji}・${newName.replace(/\s+/g, "-").toLowerCase()}`;

    await (channel as any).setName(formattedName).catch((err: any) => {
      console.error("Erro ao renomear canal:", err);
    });

    await interaction.editReply({
      content: `<:action_check:1502789797821939752> Canal renomeado para: \`${formattedName}\``,
    });
  } catch (error) {
    console.error("[Renomear] Erro ao processar:", error);
  }
}

// Responder Original
createResponder({
  customId: "ticket/manage/rename_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processRename(interaction);
  },
});

// Responder de Backup
createResponder({
  customId: "Renomear Ticket",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processRename(interaction);
  },
});

// Responder que recebe a finalização unificada via Modal V2
createResponder({
  customId: "ticket/manage/close_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction: any) {
    const { channel, user, fields, guild } = interaction;
    if (!channel?.isTextBased()) return;

    console.log(">>> [Ticket] FINALIZANDO TUDO (MODAL V2)...");

    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) {
      await interaction.reply({
        content: "Erro: Ticket não encontrado no banco.",
        flags: ["Ephemeral"],
      });
      return;
    }

    // 1. Acknowledge imediato
    if (typeof interaction.update === "function") {
      await interaction
        .update({
          content: "Finalizando ticket e processando dados...",
          components: [],
        })
        .catch(() => {});
    } else {
      await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});
    }

    const data = modalFieldsToRecord(fields);

    // Extrair escolha do transcript (RadioGroup)
    const transcriptChoiceRaw = data.transcript_choice;
    const wantTranscript =
      (Array.isArray(transcriptChoiceRaw)
        ? transcriptChoiceRaw[0]
        : transcriptChoiceRaw) === "yes";

    // Extrair considerações finais
    const considerations =
      (data.considerations as string) || "Atendimento concluído.";

    // 2. Lógica de Fechamento no Banco
    ticket.closed = true;
    ticket.closedBy = user.id;
    ticket.closedAt = new Date();
    await (ticket as any).save();

    let transcriptUrl = "";
    if (wantTranscript) {
      transcriptUrl = await generateTranscript(channel as any, ticket, user);
    }

    // 3. Enviar Log para o Canal de Staff (se quis transcript)
    if (wantTranscript) {
      const guildData = await db.guilds.get(guild.id);
      const logChannelId = guildData.channels?.tickets;
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel?.isTextBased()) {
          const owner = await guild.members
            .fetch(ticket.ownerId)
            .catch(() => null);
          const embed = createEmbed({
            title: "Log de Ticket Finalizado",
            color: constants.colors.danger,
            thumbnail: owner?.displayAvatarURL(),
            fields: [
              {
                name: "Dono",
                value: `${owner || "Desconhecido"} (\`${ticket.ownerId}\`)`,
                inline: true,
              },
              {
                name: "Finalizado por",
                value: `${user} (\`${user.id}\`)`,
                inline: true,
              },
              { name: "Categoria", value: ticket.category, inline: true },
            ],
            footer: { text: `ID: ${ticket.ticketId}` },
            timestamp: new Date(),
          });

          const row = createRow(
            new ButtonBuilder({
              label: "Ver Transcript Online",
              style: ButtonStyle.Link,
              url: transcriptUrl,
            }),
          );

          await logChannel
            .send({ embeds: [embed], components: [row] })
            .catch(() => {});
        }
      }
    }

    // 4. Enviar DM para o usuário
    const ownerMember = await guild.members
      .fetch(ticket.ownerId)
      .catch(() => null);
    if (ownerMember) {
      const openTime = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
      const closeTime = Math.floor(Date.now() / 1000);

      const dmContainer = createContainer(
        constants.colors.danger,
        createSection({
          content: `### Atendimento Encerrado\nOlá ${ownerMember}, seu atendimento na categoria \`${ticket.category.toUpperCase()}\` foi encerrado por ${user}. Abaixo você pode ver as considerações finais do seu atendimento.`,
          thumbnail: user.displayAvatarURL() as any,
        }),
        Separator.Default,
        `<:calendar:1502789854486986752> **Aberto em:** <t:${openTime}:f>`,
        `<:calendar_check:1502789850649071740> **Encerrado em:** <t:${closeTime}:f>`,
        Separator.Default,
        `**Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``,
        wantTranscript
          ? createRow(
              new ButtonBuilder({
                label: "Acessar Transcript",
                style: ButtonStyle.Link,
                url: transcriptUrl,
              }),
            )
          : [],
      );

      await ownerMember
        .send({
          components: [dmContainer],
          flags: ["IsComponentsV2"],
        })
        .catch(() => {});
    }

    // 5. Deletar o canal
    setTimeout(() => channel.delete().catch(() => {}), 3000);
  },
});

// Backup para o ID de título
createResponder({
  customId: "Finalizar Atendimento",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    // Redireciona para o responder oficial de submissão
    const mainResponder = (this as any).handlers
      ?.get(
        interaction.isFromMessage()
          ? ResponderType.ModalComponent
          : ResponderType.Modal,
      )
      ?.get("ticket/manage/close_submit");
    if (mainResponder) return mainResponder.run(interaction);
  },
});
