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
    // Acknowledge rápido
    await (
      interaction.isFromMessage()
        ? interaction.deferUpdate()
        : interaction.deferReply({ ephemeral: true })
    ).catch(() => {});

    const data = modalFieldsToRecord(fields);
    const newName = data.new_name as string;

    if (!newName) {
      await interaction
        .editReply({ content: "Nome inválido." })
        .catch(() => {});
      return;
    }

    const toolEmoji = "🔨";
    const formattedName = `${toolEmoji}・${newName.replace(/\s+/g, "-").toLowerCase()}`;

    await (channel as any).setName(formattedName).catch((err: any) => {
      console.error("Erro ao renomear canal:", err);
    });

    await interaction
      .editReply({
        content: `<:action_check:1502789797821939752> Canal renomeado para: \`${formattedName}\``,
      })
      .catch(() => {});
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

// Backup para Renomear
createResponder({
  customId: "Renomear Ticket",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processRename(interaction);
  },
});

// Função compartilhada para finalização (V5 - LOGS OBRIGATÓRIOS + FIX MODAL)
async function processCloseSubmission(interaction: any) {
  const { channel, user, fields, guild } = interaction;
  if (!channel?.isTextBased()) return;

  console.log(`[Ticket] >>> FINALIZANDO CANAL: ${channel.name}`);

  // 1. Resposta Imediata e Robusta
  try {
    if (interaction.isFromMessage()) {
      // Se veio de um botão (ModalComponent), damos update para "limpar" o painel e fechar o modal
      await interaction
        .update({
          content:
            "<:action_check:1502789797821939752> Atendimento finalizado com sucesso. O canal será deletado em instantes.",
          components: [],
        })
        .catch(() => {});
    } else {
      await interaction
        .reply({
          content:
            "<:action_check:1502789797821939752> Atendimento finalizado.",
          flags: ["Ephemeral"],
        })
        .catch(() => {});
    }
    console.log("[Ticket] 1. Discord Respondido");
  } catch (e) {
    console.error("[Ticket] Erro na resposta inicial:", e);
  }

  try {
    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) return;

    const data = modalFieldsToRecord(fields);
    const transcriptChoiceRaw = data.transcript_choice;
    const wantTranscriptUser =
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
    console.log("[Ticket] 2. Banco Atualizado");

    // 3. Transcript OBRIGATÓRIO (Independente da escolha do Staff)
    console.log("[Ticket] 3. Gerando Transcript (Obrigatório para Staff)...");
    const transcriptUrl = await generateTranscript(
      channel as any,
      ticket,
      user,
    ).catch((err) => {
      console.error("[Ticket] Erro ao gerar transcript:", err);
      return "";
    });

    // 4. LOG PARA STAFF (Sempre envia com o link se gerado)
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
          description: `O ticket \`${ticket.ticketId}\` foi finalizado por ${user}.`,
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
              name: "Escolha do Staff",
              value: wantTranscriptUser ? "✅ Salvar" : "❌ Não Salvar",
              inline: true,
            },
            { name: "Considerações", value: considerations },
          ],
          timestamp: new Date(),
        });

        const components = [];
        if (transcriptUrl) {
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
          .catch(() => {});
        console.log("[Ticket] 4. Log enviado para Staff");
      }
    }

    // 5. ENVIAR DM PARA O USUÁRIO (Apenas se ele quiser o link)
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
        wantTranscriptUser && transcriptUrl
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
      console.log("[Ticket] 5. DM de encerramento enviada");
    }

    // 6. Deletar canal
    console.log("[Ticket] 6. Deletando canal em 3 segundos...");
    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 3000);
  } catch (err) {
    console.error("[Ticket] Erro no encerramento:", err);
  }
}

// Responder Principal do Submit
createResponder({
  customId: "ticket/manage/close_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processCloseSubmission(interaction);
  },
});

// Backup para o ID de título
createResponder({
  customId: "Finalizar Atendimento",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    console.log(">>> [Ticket] Finalização capturada pelo backup!");
    await processCloseSubmission(interaction);
  },
});
