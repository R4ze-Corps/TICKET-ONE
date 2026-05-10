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

// Função compartilhada para finalização (MELHORADA COM LOGS)
async function processCloseSubmission(interaction: any) {
  const { channel, user, fields, guild } = interaction;
  if (!channel?.isTextBased()) return;

  console.log(
    `[Ticket] >>> INICIANDO FINALIZAÇÃO TOTAL NO CANAL: ${channel.name}`,
  );

  // 1. Acknowledge IMEDIATO para o Discord não dar erro
  try {
    if (interaction.isFromMessage()) {
      await interaction.deferUpdate().catch(() => {});
    } else {
      await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});
    }
    console.log("[Ticket] 1. Discord Acknowledged");
  } catch (e) {
    console.error("[Ticket] Erro no Acknowledge:", e);
  }

  try {
    // 2. Buscar dados do ticket
    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) {
      console.error("[Ticket] 2. Erro: Ticket não encontrado no banco.");
      return;
    }
    console.log("[Ticket] 2. Dados do ticket recuperados");

    // 3. Extrair dados do modal de forma segura
    const data = modalFieldsToRecord(fields);
    console.log("[Ticket] 3. Dados brutos extraídos:", JSON.stringify(data));

    const transcriptChoiceRaw = data.transcript_choice;
    const wantTranscript =
      (Array.isArray(transcriptChoiceRaw)
        ? transcriptChoiceRaw[0]
        : transcriptChoiceRaw) === "yes";
    const considerations =
      (data.considerations as string) || "Atendimento concluído.";

    console.log(
      `[Ticket] 3. Escolha: ${wantTranscript ? "Sim" : "Não"}, Notas: ${considerations}`,
    );

    // 4. Marcar como fechado no banco
    ticket.closed = true;
    ticket.closedBy = user.id;
    ticket.closedAt = new Date();
    await (ticket as any).save();
    console.log("[Ticket] 4. Status atualizado no banco");

    let transcriptUrl = "";
    if (wantTranscript) {
      console.log("[Ticket] 5. Gerando Transcript...");
      transcriptUrl = await generateTranscript(
        channel as any,
        ticket,
        user,
      ).catch((err) => {
        console.error("[Ticket] Erro ao gerar transcript:", err);
        return "";
      });
      console.log("[Ticket] 5. Transcript gerado:", transcriptUrl);
    }

    // 6. Enviar Log Staff
    if (wantTranscript && transcriptUrl) {
      console.log("[Ticket] 6. Tentando enviar Log Staff...");
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

          await (logChannel as any)
            .send({ embeds: [embed], components: [row] })
            .catch((err: any) =>
              console.error("[Ticket] Erro ao enviar para canal de log:", err),
            );
          console.log("[Ticket] 6. Log Staff enviado");
        } else {
          console.warn(
            "[Ticket] 6. Canal de log não encontrado ou não é de texto",
          );
        }
      }
    }

    // 7. Enviar DM Usuário
    const ownerMember = await guild.members
      .fetch(ticket.ownerId)
      .catch(() => null);
    if (ownerMember) {
      console.log("[Ticket] 7. Tentando enviar DM para o usuário...");
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
        .catch(() =>
          console.log(`[Ticket] 7. DM Bloqueada para ${ownerMember.user.tag}`),
        );
      console.log("[Ticket] 7. DM processada");
    }

    // 8. Deletar Canal
    console.log("[Ticket] 8. Agendando deleção do canal...");
    setTimeout(() => {
      channel
        .delete()
        .catch((err) => console.error("[Ticket] Erro ao deletar canal:", err));
      console.log("[Ticket] >>> CANAL DELETADO. PROCESSO CONCLUÍDO.");
    }, 3000);
  } catch (err) {
    console.error("[Ticket] !!! ERRO CRÍTICO NO PROCESSO DE FECHAMENTO:", err);
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
    console.log(">>> [Ticket] Finalização capturada pelo backup de título!");
    await processCloseSubmission(interaction);
  },
});
