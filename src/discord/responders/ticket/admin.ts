import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createSection,
  modalFieldsToRecord,
  Separator,
  createRow,
} from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "#database";
import { generateTranscript } from "./manage.js";

// Responder que recebe as considerações finais e finaliza o ticket
createResponder({
  customId: "ticket/manage/close_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    const { channel, user, fields, guild } = interaction;
    if (!channel?.isTextBased()) return;

    console.log(">>> [Ticket] FINALIZANDO COM CONSIDERAÇÕES...");

    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) {
      await interaction.reply({
        content: "Erro: Ticket não encontrado no banco.",
        flags: ["Ephemeral"],
      });
      return;
    }

    // 1. Acknowledge imediato (modal de dentro do painel admin costuma ser ModalComponent)
    await interaction
      .update({
        content: "Encerrando ticket e enviando considerações...",
        components: [],
      })
      .catch(() => {});

    const data = modalFieldsToRecord(fields);
    const considerations =
      (data.considerations as string) || "Atendimento concluído.";

    // 2. Lógica de Fechamento (Cópia da lógica do manage.ts adaptada)
    const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
    if (owner) {
      await (channel as any).permissionOverwrites.edit(owner.id, {
        SendMessages: false,
        ViewChannel: true,
      });
    }

    ticket.closed = true;
    ticket.closedBy = user.id;
    ticket.closedAt = new Date();
    await (ticket as any).save();

    const transcriptUrl = await generateTranscript(
      channel as any,
      ticket,
      user,
    );
    const closeTime = Math.floor(Date.now() / 1000);
    const openTime = Math.floor(new Date(ticket.openedAt).getTime() / 1000);

    // 3. Painel de Canal Encerrado
    const channelContainer = createContainer(
      constants.colors.danger,
      createSection({
        content: `### Ticket Encerrado\nEste atendimento foi finalizado por ${user}.\nAs considerações finais foram enviadas ao usuário.`,
        thumbnail: user.displayAvatarURL() as any,
      }),
      Separator.Default,
      `**Resumo do Encerramento**\n> **Fechado em:** <t:${closeTime}:F>\n> **Status:** \`FECHADO / ARQUIVADO\``,
      Separator.Default,
      createRow(
        new ButtonBuilder({
          customId: "ticket/manage/delete",
          label: "Excluir Canal",
          style: ButtonStyle.Secondary,
          emoji: "1502789802918150206",
        }),
        new ButtonBuilder({
          customId: "ticket/manage/reopen",
          label: "Reabrir Ticket",
          style: ButtonStyle.Secondary,
          emoji: "1502789944408674304",
        }),
      ),
    );

    await channel.send({
      components: [channelContainer],
      flags: ["IsComponentsV2"],
    });

    // 4. Enviar DM Premium com as considerações digitadas
    if (owner) {
      const dmContainer = createContainer(
        constants.colors.danger,
        createSection({
          content: `### Atendimento Encerrado\nOlá ${owner}, seu atendimento na categoria \`${ticket.category.toUpperCase()}\` foi encerrado por ${user}. Abaixo você pode ver as considerações finais do seu atendimento.`,
          thumbnail: user.displayAvatarURL() as any,
        }),
        Separator.Default,
        `<:calendar:1502789854486986752> **Aberto em:** <t:${openTime}:f>`,
        `<:calendar_check:1502789850649071740> **Encerrado em:** <t:${closeTime}:f>`,
        Separator.Default,
        `**Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``,
        createRow(
          new ButtonBuilder({
            label: "Acessar Transcript",
            style: ButtonStyle.Link,
            url: transcriptUrl,
          }),
        ),
      );

      await owner
        .send({
          components: [dmContainer],
          flags: ["IsComponentsV2"],
        })
        .catch(() => {});
    }
  },
});
