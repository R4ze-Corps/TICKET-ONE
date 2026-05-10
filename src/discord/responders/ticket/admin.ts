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

// Função compartilhada para finalização (V4 - ULTRA RESILIENTE)
async function processCloseSubmission(interaction: any) {
  const { channel, user, fields, guild } = interaction;
  if (!channel?.isTextBased()) return;

  console.log(`[Ticket] >>> FINALIZANDO CANAL: ${channel.name}`);

  // 1. RESPOSTA IMEDIATA (Essencial para o modal fechar sem erro)
  try {
    if (interaction.isFromMessage()) {
      await interaction
        .update({
          content:
            "<:action_check:1502789797821939752> Finalizando atendimento...",
          components: [],
        })
        .catch(() => {});
    } else {
      await interaction
        .reply({
          content:
            "<:action_check:1502789797821939752> Finalizando atendimento...",
          flags: ["Ephemeral"],
        })
        .catch(() => {});
    }
  } catch (e) {
    console.error("[Ticket] Erro ao responder interação inicial:", e);
  }

  try {
    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) return;

    const data = modalFieldsToRecord(fields);
    const transcriptChoiceRaw = data.transcript_choice;
    const wantTranscript =
      (Array.isArray(transcriptChoiceRaw)
        ? transcriptChoiceRaw[0]
        : transcriptChoiceRaw) === "yes";
    const considerations =
      (data.considerations as string) || "Atendimento concluído.";

    // 2. Atualizar Banco
    ticket.closed = true;
    ticket.closedBy = user.id;
    ticket.closedAt = new Date();
    await (ticket as any).save();

    // 3. Transcript (Opcional)
    let transcriptUrl = "";
    if (wantTranscript) {
      transcriptUrl = await generateTranscript(
        channel as any,
        ticket,
        user,
      ).catch(() => "");
    }

    // 4. LOG PARA STAFF (Sempre envia, mas muda o conteúdo se tiver transcript)
    const guildData = await db.guilds.get(guild.id);
    const logChannelId = guildData.channels?.tickets;

    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel?.isTextBased()) {
        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        const embed = createEmbed({
          title: "📄 Log de Encerramento",
          description: `O ticket \`${ticket.ticketId}\` foi finalizado.`,
          color: constants.colors.danger,
          thumbnail: owner?.displayAvatarURL() || undefined,
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
            {
              name: "Transcript",
              value: wantTranscript ? "✅ Gerado" : "❌ Não solicitado",
              inline: true,
            },
            { name: "Considerações", value: considerations },
          ],
          timestamp: new Date(),
        });

        const components = [];
        if (wantTranscript && transcriptUrl) {
          components.push(
            createRow(
              new ButtonBuilder({
                label: "Ver Transcript Online",
                style: ButtonStyle.Link,
                url: transcriptUrl,
              }),
            ),
          );
        }

        await (logChannel as any)
          .send({ embeds: [embed], components })
          .catch((err: any) =>
            console.error("[Ticket] Falha ao enviar log staff:", err),
          );
      }
    }

    // 5. ENVIAR DM PARA O USUÁRIO
    const ownerMember = await guild.members
      .fetch(ticket.ownerId)
      .catch(() => null);
    if (ownerMember) {
      const openTime = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
      const closeTime = Math.floor(Date.now() / 1000);

      const dmContainer = createContainer(
        constants.colors.danger,
        createSection({
          content: `### Atendimento Encerrado\nOlá ${ownerMember}, seu atendimento foi encerrado por ${user}.`,
          thumbnail: user.displayAvatarURL() as any,
        }),
        Separator.Default,
        `<:calendar:1502789854486986752> **Aberto em:** <t:${openTime}:f>`,
        `<:calendar_check:1502789850649071740> **Encerrado em:** <t:${closeTime}:f>`,
        Separator.Default,
        `**Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``,
        wantTranscript && transcriptUrl
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

    // 6. Deletar canal após tempo de segurança
    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 3000);
  } catch (err) {
    console.error("[Ticket] Erro no processo final:", err);
  }
}

// Responder que recebe as considerações finais
createResponder({
  customId: "ticket/manage/close_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processCloseSubmission(interaction);
  },
});

// Backup para o ID de título do modal
createResponder({
  customId: "Finalizar Atendimento",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processCloseSubmission(interaction);
  },
});
