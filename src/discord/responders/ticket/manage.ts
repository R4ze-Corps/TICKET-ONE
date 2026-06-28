import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createSection,
  createEmbed,
  Separator,
  createRow,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  LabelBuilder,
  TextChannel,
  PermissionFlagsBits,
  RadioGroupBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { db } from "#database";
import { env } from "#env";

function getTicketOpenedAt(ticket: any) {
  const openedAt = ticket.openedAt ? new Date(ticket.openedAt) : new Date();
  return Number.isNaN(openedAt.getTime()) ? new Date() : openedAt;
}

function formatTranscriptDuration(start: Date, end: Date) {
  const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}min`
    : `${hours}h`;
}

function formatTranscriptTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function getTranscriptContent(message: any) {
  const parts = [message.content || ""];

  for (const attachment of message.attachments.values()) {
    parts.push(`[Anexo: ${attachment.name || "arquivo"}] ${attachment.url}`);
  }

  for (const embed of message.embeds) {
    if (embed.title) parts.push(`[Embed] ${embed.title}`);
    if (embed.description) parts.push(embed.description);
  }

  return parts.filter(Boolean).join("\n") || "[Mensagem sem texto]";
}

function resolveTranscriptUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.WEB_URL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

async function sendTranscriptToSite(payload: Record<string, any>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (env.BOT_API_SECRET) {
    headers.Authorization = `Bearer ${env.BOT_API_SECRET}`;
  }

  const response = await fetch(`${env.WEB_URL.replace(/\/$/, "")}/api/transcripts`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, any>;

  if (!response.ok) {
    throw new Error(
      `API de transcripts respondeu ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  const code = String(data.code || data.id || "");
  const url = String(data.url || "");

  if (!code || !url) {
    throw new Error("API de transcripts nao retornou code/url.");
  }

  return {
    id: code,
    url: resolveTranscriptUrl(url),
  };
}

async function saveTranscriptToSharedDatabase(_transcriptData: Record<string, any>) {
  return;
}

const DEFAULT_TICKET_STATUS_TITLE = "ATIVO";
const DEFAULT_TICKET_STATUS_DESCRIPTION =
  "O player está ativo.";
const DEFAULT_TICKET_STATUS_EMOJI = "🟢";
const TICKET_STATUS_OPTIONS = [
  {
    value: "ativo",
    label: "Ativo",
    emoji: "🟢",
    title: "ATIVO",
    description: DEFAULT_TICKET_STATUS_DESCRIPTION,
  },
  {
    value: "ausencia",
    label: "Ausência",
    emoji: "🟡",
    title: "AUSÊNCIA",
    description: "O player está em ausência.",
  },
  {
    value: "aguardando_justificativa",
    label: "Aguardando Justificativa",
    emoji: "🟠",
    title: "AGUARDANDO JUSTIFICATIVA",
    description: "O player está aguardando justificativa.",
  },
  {
    value: "pendente_recadastramento",
    label: "Pendente Recadastramento",
    emoji: "🔵",
    title: "PENDENTE RECADASTRAMENTO",
    description: "O player está pendente de recadastramento.",
  },
  {
    value: "em_analise",
    label: "Em Análise",
    emoji: "🟣",
    title: "EM ANÁLISE",
    description: "O status do player está em análise.",
  },
  {
    value: "aguardando_ajustes",
    label: "Aguardando Ajustes",
    emoji: "🔴",
    title: "AGUARDANDO AJUSTES",
    description: "O player está aguardando ajustes.",
  },
];

function getGuildImage(guild: any) {
  return (
    guild?.iconURL?.({ size: 1024 }) ||
    guild?.bannerURL?.({ size: 1024 }) ||
    "https://cdn.discordapp.com/embed/avatars/0.png"
  );
}

function getClientName(owner: any) {
  return owner?.displayName || owner?.user?.globalName || owner?.user?.username || "Cliente";
}

const categoryMeta: Record<string, { label: string; emoji: string }> = {
  suporte: { label: "Suporte", emoji: "1502789958430232688" },
  bot: { label: "Bot", emoji: "1502789931808981012" },
  roupas: { label: "Roupas", emoji: "1502789953334280345" },
  parceria: { label: "Parceria", emoji: "1502789875928400103" },
};
const HIDDEN_CATEGORIES = new Set(["compras", "exclusivo", "pronta_entrega"]);

function formatCategoryLabel(category: string) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getConfiguredTicketCategoryOptions(configured: Record<string, string | undefined>) {
  return Object.keys(configured)
    .filter((key) => configured[key] && !HIDDEN_CATEGORIES.has(key))
    .slice(0, 25)
    .map((key) => ({
      label: categoryMeta[key]?.label || formatCategoryLabel(key),
      value: key,
      emoji: categoryMeta[key]?.emoji || "1502789959378145300",
    }));
}

function getTicketStatus(ticket: any) {
  if (!ticket.statusTitle && !ticket.statusDescription) {
    return null;
  }

  return {
    title: ticket.statusTitle || DEFAULT_TICKET_STATUS_TITLE,
    description: ticket.statusDescription || DEFAULT_TICKET_STATUS_DESCRIPTION,
    emoji: ticket.statusEmoji || DEFAULT_TICKET_STATUS_EMOJI,
  };
}

function getTicketStatusOption(value: string) {
  return TICKET_STATUS_OPTIONS.find((status) => status.value === value);
}

function getAdminStatusText(ticket: any) {
  const status = getTicketStatus(ticket);
  if (!status) {
    return "● **Status do Player**\nNesta opção você pode atualizar o status do player";
  }

  return `${status.emoji} **Status do Player**\n**Status atual:** \`${status.title}\`\n> ${status.description}`;
}

function hasTicketClaimer(ticket: any) {
  return typeof ticket.claimedBy === "string" && ticket.claimedBy.length > 0;
}

async function replyTicketNeedsClaimer(interaction: any) {
  const response = {
    content:
      "<:action_warning:1502789801949265990> Este ticket precisa ser assumido antes de ser finalizado.",
    flags: ["Ephemeral"],
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(response).catch(() => {});
    return;
  }

  await interaction.reply(response).catch(() => {});
}

async function updateMainTicketMessage(channel: any, ticket: any, guild: any) {
  if (!ticket.messageId || !channel?.isTextBased()) return;

  const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
  const mainMessage = await channel.messages.fetch(ticket.messageId).catch(() => null);
  if (!mainMessage) return;

  const container = createMainPanel(ticket, owner, guild);
  await mainMessage.edit({ components: [container] }).catch(() => {});
}

// Função para gerar o painel principal (Assumir ou Painel Admin)
function createMainPanel(ticket: any, owner: any, guild?: any) {
  const isClaimed = !!ticket.claimedBy;
  const ownerDisplay = owner || "Usuário";
  const clientName = getClientName(owner);
  const status = getTicketStatus(ticket);
  const assignedLine = isClaimed
    ? `\n\n> <:user_check:1502789974276178121> **Assumido por:** <@${ticket.claimedBy}>`
    : "";
  const statusBlocks = status
    ? [
        Separator.Default,
        `${status.emoji} **Status do Player:** \`${status.title}\`\n> ${status.description}`,
      ]
    : [];

  return createContainer(
    constants.colors.white,
    createSection({
      content:
        `# <:other_ticket:1502789959378145300> Ticket ${clientName}\n${ownerDisplay} Seja bem-vindo(a) ao seu ticket! Através deste canal, a equipe irá realizar seu atendimento e esclarecer suas dúvidas.` +
        assignedLine,
      thumbnail: getGuildImage(guild) as any,
    }),
    ...statusBlocks,
    Separator.Default,
    `<:folder_open:1502789875928400103> **Categoria do atendimento:**\n\`\`\`\n${ticket.category.toUpperCase()}\n\`\`\``,
    `<:action_info:1502789798983766016> **Motivo do contato:**\n\`\`\`\n${ticket.description}\n\`\`\``,
    Separator.Default,
    createRow(
      ...(isClaimed
        ? []
        : [
            new ButtonBuilder({
              customId: "ticket/manage/claim",
              label: "Assumir Ticket",
              style: ButtonStyle.Secondary,
              emoji: "1502789940612698192",
            }),
          ]),
      new ButtonBuilder({
        customId: "ticket/manage/admin",
        label: "Painel Admin",
        style: ButtonStyle.Secondary,
        emoji: "1502789931808981012",
      }),
      new ButtonBuilder({
        customId: "ticket/manage/close_modal",
        label: "Finalizar Ticket",
        style: ButtonStyle.Secondary,
        emoji: "1502789802918150206",
      }),
    ),
  );
}

createResponder({
  customId: "ticket/manage/:action",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction, { action }) {
    const { channel, user, guild } = interaction;

    if (!channel?.isTextBased()) return;

    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) {
      await interaction.reply({
        content:
          "Este canal não é um ticket válido ou não está no banco de dados.",
        flags: ["Ephemeral"],
      });
      return;
    }

    switch (action) {
      case "claim": {
        if (ticket.claimedBy) {
          await interaction.reply({
            content: `Este ticket já foi assumido por <@${ticket.claimedBy}>!`,
            flags: ["Ephemeral"],
          });
          return;
        }

        ticket.claimedBy = user.id;
        await (ticket as any).save();

        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        const container = createMainPanel(ticket, owner, guild);

        await interaction.update({
          components: [container],
        });

        // Notificação Automática por DM
        if (owner) {
          const dmContainer = createContainer(
            constants.colors.white,
            createSection({
              content: `### Notificação de Atendimento\nOlá ${owner}, seu ticket na categoria \`${ticket.category.toUpperCase()}\` foi assumido por ${user}. Ele agora é o responsável pelo seu atendimento. Vá até o ticket para dar continuidade ao seu atendimento.`,
              thumbnail: getGuildImage(guild) as any,
            }),
            createRow(
              new ButtonBuilder({
                label: "Ir para o atendimento",
                style: ButtonStyle.Link,
                url: `https://discord.com/channels/${guild.id}/${channel.id}`,
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
        break;
      }

      case "admin": {
        const isTheClaimer = ticket.claimedBy === user.id;

        const container = createContainer(
          "#00FFD4",
          createSection({
            content: `## <:shield:1502789938532450304> Painel Administrativo ${ticket.ticketId}\nSeja muito bem-vindo(a) ao Painel Administrativo! Este é o seu ambiente de controle, onde você pode gerenciar o atendimento atual. Caso tenha alguma dúvida sobre o funcionamento, entre em contato com a equipe responsável.`,
            thumbnail: getGuildImage(guild) as any,
          }),
          Separator.Default,
          createSection({
            content: `● **Gerenciar usuário**\nNesta opção você pode adicionar/remover usuários do atendimento.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/members_modal",
              label: "Gerenciar",
              style: ButtonStyle.Secondary,
              emoji: "1502789976327327801",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Renomar**\nNesta opção você pode alterar o nome do atendimento para ter melhor controle.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/rename_modal",
              label: "Renomear",
              style: ButtonStyle.Secondary,
              emoji: "1502789881250709675",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Notificar**\nNesta opção será enviada uma mensagem no privado do autor do atendimento.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/notify",
              label: "Notificar",
              style: ButtonStyle.Secondary,
              emoji: "1502789798983766016",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Transferir Atendimento**\nNesta opção você pode alterar a categoria do atendimento.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/transfer",
              label: "Transferir",
              style: ButtonStyle.Secondary,
              emoji: "1502789875928400103",
            }),
          }),
          Separator.Default,
          createSection({
            content: getAdminStatusText(ticket),
            button: new ButtonBuilder({
              customId: "ticket/manage/status_modal",
              label: "Mudar Status",
              style: ButtonStyle.Secondary,
              emoji: "1502789850649071740",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Largar Atendimento**\nNesta opção você pode deixar de ser o responsável pelo atendimento.`,
            button: isTheClaimer
              ? new ButtonBuilder({
                  customId: "ticket/manage/unclaim",
                  label: "Largar",
                  style: ButtonStyle.Secondary,
                  emoji: "1502789878339862660",
                })
              : new ButtonBuilder({
                  customId: "disabled",
                  label: "Largar",
                  style: ButtonStyle.Secondary,
                  emoji: "1502789878339862660",
                  disabled: true,
                }),
          }),
        );

        await interaction.reply({
          components: [container],
          flags: ["Ephemeral", "IsComponentsV2"],
        });
        break;
      }

      case "transfer": {
        const guildData = await db.guilds.get(guild.id);
        const options = getConfiguredTicketCategoryOptions(
          guildData.channels?.categories || {},
        );

        if (options.length === 0) {
          await interaction.reply({
            content: `<:action_warning:1502789801949265990> Nenhuma categoria foi configurada ainda. Use \`/configurar\`.`,
            flags: ["Ephemeral"],
          });
          return;
        }

        const container = createContainer(
          constants.colors.primary,
          createSection({
            content:
              "### <:arrow_right:1502789809142239243> Transferir Ticket\nSelecione a nova categoria para este atendimento abaixo.",
            thumbnail: getGuildImage(guild) as any,
          }),
          createRow(
            new StringSelectMenuBuilder({
              customId: "ticket/manage/transfer_select",
              placeholder: "Escolha uma categoria...",
              options,
            }),
          ),
        );

        await interaction.reply({
          components: [container],
          flags: ["Ephemeral", "IsComponentsV2"],
        });
        break;
      }

      case "status_modal": {
        const container = createContainer(
          constants.colors.white,
          createSection({
            content: `# <:clock:1502789859960422502> Mudar Status do Player\nSelecione abaixo o novo status que será exibido no painel do atendimento.`,
            thumbnail: getGuildImage(guild) as any,
          }),
          createRow(
            new StringSelectMenuBuilder({
              customId: "ticket/manage/status_select",
              placeholder: "Escolha o novo status...",
              options: TICKET_STATUS_OPTIONS.map((status) => ({
                label: status.label,
                value: status.value,
                emoji: status.emoji,
              })),
            }),
          ),
        );

        await interaction.reply({
          components: [container],
          flags: ["Ephemeral", "IsComponentsV2"],
        });
        break;
      }
      case "unclaim": {
        if (ticket.claimedBy !== user.id) {
          await interaction.reply({
            content: "Apenas quem assumiu o ticket pode largá-lo.",
            flags: ["Ephemeral"],
          });
          return;
        }

        ticket.claimedBy = undefined;
        await (ticket as any).save();

        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        const container = createMainPanel(ticket, owner, guild);

        if (ticket.messageId) {
          const mainMessage = await channel.messages
            .fetch(ticket.messageId)
            .catch(() => null);
          if (mainMessage) {
            await mainMessage.edit({ components: [container] }).catch(() => {});
          }
        }

        await interaction.reply({
          content: `<:action_check:1502789974276178121> Você largou o atendimento deste ticket.`,
          flags: ["Ephemeral"],
        });
        break;
      }

      case "notify": {
        await interaction.deferReply({ flags: ["Ephemeral"] });

        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        if (!owner) {
          await interaction.editReply({
            content: "Não foi possível encontrar o dono do ticket.",
          });
          return;
        }

        const embed = createEmbed({
          title: `<:bell:1502789830155702333> Notificação de Ticket`,
          description: `Olá ${owner}, um membro da nossa equipe está chamando você em seu ticket!`,
          fields: [
            { name: "Ticket", value: `${channel}`, inline: true },
            { name: "Servidor", value: `${guild.name}`, inline: true },
          ],
          color: constants.colors.white,
          timestamp: new Date(),
          footer: { text: "Por favor, responda assim que possível." },
        });

        const success = await owner.send({ embeds: [embed] }).catch(() => null);

        if (success) {
          await interaction.editReply({
            content: `<:action_check:1502789797821939752> O dono do ticket foi notificado com sucesso via DM!`,
          });
        } else {
          await interaction.editReply({
            content: `❌ Não foi possível enviar a DM (Usuário com DMs fechadas). Mencione-o aqui no canal: ${owner}`,
          });
        }
        break;
      }

      case "close_confirm":
      case "close_modal": {
        if (!hasTicketClaimer(ticket)) {
          await replyTicketNeedsClaimer(interaction);
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId("ticket/manage/close_submit")
          .setTitle("Finalizar Atendimento");

        const transcriptLabel = new LabelBuilder()
          .setLabel("Transcript:")
          .setDescription("Deseja salvar o histórico deste atendimento?")
          .setRadioGroupComponent(
            new RadioGroupBuilder().setCustomId("transcript_choice").setOptions(
              {
                label: "Salvar Transcript",
                value: "yes",
                description: "O log será gerado e enviado para a Staff.",
              },
              {
                label: "Não Salvar Transcript",
                value: "no",
                description: "O ticket será fechado sem gerar log público.",
              },
            ),
          );

        const considerationsLabel = new LabelBuilder()
          .setLabel("Considerações Finais:")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("considerations")
              .setPlaceholder("Escreva aqui as considerações finais...")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true),
          );

        modal.addComponents(transcriptLabel, considerationsLabel);
        await interaction.showModal(modal);
        break;
      }

      case "members":
      case "members_modal": {
        const modal = new ModalBuilder()
          .setCustomId("ticket/manage/members/submit")
          .setTitle("Gerenciar Membros");

        const label = new LabelBuilder()
          .setLabel("Adicionar/Remover Membro")
          .setDescription(
            "Selecione o usuário que deseja adicionar ou remover.",
          )
          .setUserSelectMenuComponent(
            new UserSelectMenuBuilder()
              .setCustomId("member")
              .setPlaceholder("Selecione um usuário..."),
          );

        modal.addComponents(label);
        await interaction.showModal(modal).catch((e) => console.error(e));
        break;
      }

      case "rename_modal": {
        const modal = new ModalBuilder()
          .setCustomId("ticket/manage/rename_submit")
          .setTitle("Renomear Ticket");

        const label = new LabelBuilder()
          .setLabel("Novo Nome")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("new_name")
              .setPlaceholder("ex: suporte-urgente")
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          );

        modal.addComponents(label);
        await interaction.showModal(modal).catch((e) => console.error(e));
        break;
      }

      case "close": {
        if (ticket.closed) {
          await interaction.reply({
            content: "Este ticket jÃ¡ estÃ¡ fechado!",
            flags: ["Ephemeral"],
          });
          return;
        }

        if (!hasTicketClaimer(ticket)) {
          await replyTicketNeedsClaimer(interaction);
          return;
        }

        await interaction.reply({
          content:
            "Por favor, use o botÃ£o de finalizar para abrir o formulÃ¡rio.",
          flags: ["Ephemeral"],
        });
        break;
      }
      case "delete": {
        if (!hasTicketClaimer(ticket)) {
          await replyTicketNeedsClaimer(interaction);
          return;
        }

        await interaction.reply({
          content: "Gerando transcript e deletando o canal...",
          flags: ["Ephemeral"],
        });

        ticket.closed = true;
        await (ticket as any).save();

        const guildData = await db.guilds.get(guild.id);
        const logChannelId = guildData.channels?.tickets;

        const transcript = await generateTranscript(
          channel as any,
          ticket,
          user,
        );
        const transcriptUrl = transcript.url;

        if (logChannelId) {
          const logChannel = guild.channels.cache.get(logChannelId);
          if (logChannel?.isTextBased()) {
            const owner = await guild.members
              .fetch(ticket.ownerId)
              .catch(() => null);

            const claimer = ticket.claimedBy
              ? await guild.members.fetch(ticket.claimedBy).catch(() => null)
              : null;
            const openedAtTimestamp = Math.floor(
              getTicketOpenedAt(ticket).getTime() / 1000,
            );
            const closedAtTimestamp = Math.floor(Date.now() / 1000);

            const logContainer = createContainer(
              "#00FFD4",
              createSection({
                content: `## <:folder:1502789880214720533> Atendimento Deletado: ${ticket.ticketId}\nO atendimento \`${ticket.ticketId}\` foi deletado por ${user}. O histórico de mensagens foi salvo e pode ser acessado abaixo.\n\n**Codigo do transcript:** \`${transcript.id}\``,
                thumbnail: getGuildImage(guild) as any,
              }),
              Separator.Default,
              `**Identificação**\n` +
                [
                  `<:user:1502789979229913268> **Aberto por:** ${owner || "Desconhecido"} (\`${ticket.ownerId}\`)`,
                  `<:action_remove:1502789800967536741> **Deletado por:** ${user} (\`${user.id}\`)`,
                  `<:user_check:1502789974276178121> **Assumido por:** ${claimer || "Ninguém"} (\`${ticket.claimedBy || "0"}\`)`,
                ].join("\n"),
              Separator.Default,
              `**Cronologia**\n` +
                [
                  `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f> (<t:${openedAtTimestamp}:R>)`,
                  `<:clock:1502789859960422502> **Encerrado em:** <t:${closedAtTimestamp}:f> (<t:${closedAtTimestamp}:R>)`,
                ].join("\n"),
              Separator.Default,
              `**Detalhes do Ticket**\n` +
                [
                  `<:folder_open:1502789875928400103> **Categoria:** \`${ticket.category}\``,
                  `<:action_info:1502789798983766016> **Motivo:** \`${ticket.description || "Não informado."}\``,
                ].join("\n"),
              createRow(
                new ButtonBuilder({
                  label: "Acessar Transcript",
                  style: ButtonStyle.Link,
                  emoji: "1502789882916110407",
                  url: transcriptUrl,
                }),
              ),
            );

            await logChannel.send({
              components: [logContainer],
              flags: ["IsComponentsV2"],
            });
          }
        }

        setTimeout(() => channel.delete().catch(() => {}), 5000);
        break;
      }

      case "reopen": {
        await interaction.deferReply();

        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        if (owner) {
          await (channel as any).permissionOverwrites.edit(owner.id, {
            SendMessages: true,
            ViewChannel: true,
          });
        }

        ticket.closed = false;
        ticket.closedBy = undefined;
        ticket.closedAt = undefined;
        await (ticket as any).save();

        await interaction.editReply({
          content: "🔓 Ticket reaberto com sucesso!",
        });
        break;
      }
      case "transcript": {
        await interaction.deferReply({ flags: ["Ephemeral"] });
        const transcript = await generateTranscript(
          channel as any,
          ticket,
          user,
        );
        const transcriptUrl = transcript.url;

        const container = createContainer(
          constants.colors.secondary,
          createSection({
            content: `### Transcript Gerado\nO histórico de mensagens deste ticket foi processado com sucesso e está disponível online.\n\n**Codigo:** \`${transcript.id}\``,
            thumbnail: emojis.static.file_files as any,
          }),
          createRow(
            new ButtonBuilder({
              label: "Abrir Transcript Online",
              style: ButtonStyle.Link,
              url: transcriptUrl,
            }),
          ),
        );

        await interaction.editReply({
          components: [container],
          flags: ["IsComponentsV2"],
        });
        break;
      }

      default: {
        await interaction.reply({
          content: `Ação "${action}" ainda não implementada.`,
          flags: ["Ephemeral"],
        });
      }
    }
  },
});

createResponder({
  customId: "ticket/manage/transfer_select",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const { guild, channel, values } = interaction;
    if (!channel?.isTextBased()) return;

    await interaction.deferReply({ flags: ["Ephemeral"] });

    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) {
      await interaction.editReply({ content: "Ticket não encontrado." });
      return;
    }

    const newCategory = values[0];
    const guildData = await db.guilds.get(guild.id);
    const categories = guildData.channels?.categories;

    let parentId = undefined;
    if (categories) {
      parentId = (categories as any)[newCategory];
    }

    if (!parentId) {
      await interaction.editReply({
        content: `A categoria "${newCategory.toUpperCase()}" não está configurada no bot. Use \`/configurar\`.`,
      });
      return;
    }

    try {
      // 1. Atualizar canal no Discord
      await (channel as any).setParent(parentId, { lockPermissions: false });

      // 2. Atualizar banco de dados
      ticket.category = newCategory;
      await (ticket as any).save();

      // 3. Feedback
      await interaction.editReply({
        content: `<:action_check:1502789974276178121> Ticket transferido para a categoria **${newCategory.toUpperCase()}** com sucesso!`,
      });
    } catch (error) {
      console.error("[Ticket] Erro ao transferir ticket:", error);
      await interaction.editReply({
        content:
          "Ocorreu um erro ao tentar mover o canal para a nova categoria.",
      });
    }
  },
});

createResponder({
  customId: "ticket/manage/status_select",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const { channel, guild } = interaction;
    if (!channel?.isTextBased()) return;

    await interaction.deferUpdate();

    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) {
      await interaction.editReply({
        components: [
          createContainer(
            constants.colors.danger,
            "<:action_warning:1502789801949265990> Ticket não encontrado.",
          ),
        ],
      });
      return;
    }

    const selectedStatus = getTicketStatusOption(interaction.values[0]);
    if (!selectedStatus) {
      await interaction.editReply({
        components: [
          createContainer(
            constants.colors.danger,
            "<:action_warning:1502789801949265990> Status inválido.",
          ),
        ],
      });
      return;
    }

    ticket.statusTitle = selectedStatus.title;
    ticket.statusDescription = selectedStatus.description;
    ticket.statusEmoji = selectedStatus.emoji;
    await (ticket as any).save();

    await updateMainTicketMessage(channel, ticket, guild);

    await interaction.editReply({
      components: [
        createContainer(
          constants.colors.white,
          `<:action_check:1502789797821939752> Status do player atualizado para **${selectedStatus.label}**.`,
        ),
      ],
    });
  },
});


export async function generateTranscript(
  channel: TextChannel,
  ticket: any,
  closer: any,
) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sortedMessages = [...messages.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp,
  ).filter((msg) => !msg.author.bot);

  const openedAt = getTicketOpenedAt(ticket);
  const closedAt = new Date();
  const fallbackCode =
    ticket.ticketId || Math.random().toString(36).substring(2, 9).toUpperCase();
  const claimer = ticket.claimedBy
    ? await channel.guild.members.fetch(ticket.claimedBy).catch(() => null)
    : null;
  const agentName =
    claimer?.displayName ||
    closer.displayName ||
    closer.globalName ||
    closer.username ||
    "Equipe";

  const transcriptPayload = {
    serverName: channel.guild.name,
    serverIcon:
      channel.guild.iconURL({ size: 1024 }) ||
      "https://cdn.discordapp.com/embed/avatars/0.png",
    title: "Atendimento localizado",
    agent: agentName,
    duration: formatTranscriptDuration(openedAt, closedAt),
    messages: sortedMessages.map((msg) => {
      const isAgent =
        msg.member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
        msg.author.bot ||
        false;

      return {
        author: msg.member?.displayName || msg.author.globalName || msg.author.username,
        role: isAgent ? "agent" : "member",
        avatar: msg.member?.displayAvatarURL() || msg.author.displayAvatarURL(),
        time: formatTranscriptTime(msg.createdAt),
        content: getTranscriptContent(msg),
      };
    }),
  };

  const localTranscript = {
    id: fallbackCode,
    code: fallbackCode,
    ...transcriptPayload,
    ticketId: ticket.ticketId,
    guildId: channel.guild.id,
    channelId: channel.id,
    channelName: channel.name,
    category: ticket.category || "Suporte",
    description: ticket.description || "Nao informado.",
    createdAt: openedAt.toISOString(),
    closedAt: closedAt.toISOString(),
  };

  await db.transcripts.updateOne(
    { id: fallbackCode },
    { $set: localTranscript },
    { upsert: true },
  );

  try {
    const transcript = await sendTranscriptToSite(transcriptPayload);
    await db.transcripts.updateOne(
      { id: transcript.id },
      {
        $set: {
          ...localTranscript,
          id: transcript.id,
          code: transcript.id,
          url: transcript.url,
        },
      },
      { upsert: true },
    );
    return transcript;
  } catch (error) {
    console.error(
      "[Transcript] Nao foi possivel enviar para a API do site. O transcript ficou salvo localmente:",
      error,
    );

    return {
      id: fallbackCode,
      url: `${env.WEB_URL.replace(/\/$/, "")}/transcript/${fallbackCode}`,
    };
  }

  const ownerMember = await channel.guild.members
    .fetch(ticket.ownerId)
    .catch(() => null);

  const transcriptId =
    ticket.ticketId || Math.random().toString(36).substring(2, 9).toUpperCase();

  const transcriptData = {
    id: transcriptId,
    guildId: channel.guild.id,
    guildName: channel.guild.name,
    channelId: channel.id,
    channelName: channel.name,
    category: ticket.category || "Suporte",
    description: ticket.description || "Não informado.",
    createdAt: ticket.openedAt
      ? new Date(ticket.openedAt).toISOString()
      : new Date().toISOString(),
    closedAt: new Date().toISOString(),
    openedBy: {
      id: ticket.ownerId,
      username: ownerMember?.user.username || "Desconhecido",
      avatar:
        ownerMember?.displayAvatarURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png",
    },
    closedBy: {
      id: closer.id,
      username: closer.username,
      avatar: closer.displayAvatarURL(),
    },
    messageCount: sortedMessages.length,
    messages: sortedMessages.map((msg, index) => ({
      id: `${transcriptId}-${index}`,
      messageId: msg.id,
      authorId: msg.author.id,
      authorUsername: msg.author.username,
      authorAvatar: msg.author.displayAvatarURL(),
      authorBot: msg.author.bot,
      isStaff:
        msg.member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
        false,
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
      attachments: msg.attachments.map((att) => ({
        url: att.url,
        filename: att.name,
        contentType: att.contentType,
      })),
      embeds: msg.embeds.map((emb) => ({
        title: emb.title || undefined,
        description: emb.description || undefined,
        color: emb.color || undefined,
      })),
    })),
  };

  // Salvar no Banco de Dados (Sincronizado com o Web App)
  await db.transcripts.updateOne(
    { id: transcriptId },
    { $set: transcriptData },
    { upsert: true },
  );

  await saveTranscriptToSharedDatabase(transcriptData).catch((error) => {
    console.error(
      "[Transcript] Nao foi possivel salvar no MongoDB compartilhado. O transcript ficou salvo localmente:",
      error,
    );
  });

  return {
    id: transcriptId,
    url: `${env.WEB_URL}/transcripts/${transcriptId}`,
  };
}
