import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createSection,
  modalFieldsToRecord,
  Separator,
  createRow,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputStyle,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
} from "discord.js";
import { db } from "#database";

console.log(
  "[Ticket] Sistema de Tickets (V15 - Multi-Category Routing) carregado!",
);

function getGuildImage(guild: any) {
  return (
    guild?.iconURL?.({ size: 1024 }) ||
    guild?.bannerURL?.({ size: 1024 }) ||
    "https://cdn.discordapp.com/embed/avatars/0.png"
  );
}

function getClientName(user: any, member?: any) {
  return member?.displayName || user?.globalName || user?.username || "Cliente";
}

// Função compartilhada para criar o ticket
function createTicketButtons(
  closeStyle: ButtonStyle.Secondary | ButtonStyle.Danger = ButtonStyle.Secondary,
) {
  return createRow(
    new ButtonBuilder({
      customId: "ticket/manage/claim",
      label: "Assumir Ticket",
      style: ButtonStyle.Secondary,
      emoji: "1502789940612698192",
    }),
    new ButtonBuilder({
      customId: "ticket/manage/admin",
      label: "Painel Admin",
      style: ButtonStyle.Secondary,
      emoji: "1502789931808981012",
    }),
    new ButtonBuilder({
      customId: "ticket/manage/close_confirm",
      label: "Finalizar Ticket",
      style: closeStyle,
      emoji: "1502789802918150206",
    }),
  );
}

function createTicketContainer(
  guild: any,
  user: any,
  member: any,
  category: string,
  description: string,
) {
  const clientName = getClientName(user, member);

  return createContainer(
    constants.colors.white,
    createSection({
      content: `# <:Folderopen:1520849868820578385> Ticket ${clientName}\n${user} Seja bem-vindo(a) ao seu ticket! Através deste canal, a equipe irá realizar seu atendimento e esclarecer suas dúvidas.`,
      thumbnail: getGuildImage(guild) as any,
    }),
    Separator.Default,
    `<:foldersearch:1520843134521577615> **Categoria do atendimento:**\n\`\`\`\n${category.toUpperCase()}\n\`\`\``,
    `<:bagdinfo:1520843355108544683> **Motivo do contato:**\n\`\`\`\n${description}\n\`\`\``,
    Separator.Default,
    createTicketButtons(category === "bot" ? ButtonStyle.Danger : ButtonStyle.Secondary),
  );
}

async function processTicketSubmission(interaction: any, selectedCategory?: string) {
  console.log(">>> [Ticket] PROCESSANDO CRIAÇÃO DO TICKET...");

  await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});

  const { guild, user, member, fields } = interaction;

  try {
    const data = modalFieldsToRecord(fields);
    const categoryRaw = data.category;
    const category =
      selectedCategory ||
      ((Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw) as string) ||
      "suporte";
    const description = (data.description as string) || "Nenhuma descrição.";

    const ticketId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const openedAtDate = new Date();
    const openedAt = openedAtDate.toLocaleString("pt-BR");

    // 1. Buscar as configurações de categorias no banco
    const guildData = await db.guilds.get(guild.id);
    const categories = guildData.channels?.categories;

    // Pega o ID da categoria baseado no assunto escolhido
    let parentId = undefined;
    if (categories) {
      parentId = (categories as any)[category];
    }

    console.log(
      `[Ticket] Roteando assunto "${category}" para categoria ID: ${parentId || "Padrão"}`,
    );

    // Emojis customizados para o tópico
    const eTicket = "<:Folderopen:1520849868820578385>";
    const eUser = "<:Fileup:1520841650652450877>";
    const eCalendar = "<:calendar:1502789854486986752>";
    const eFolder = "<:fileclock:1520839663068119061>";

    // 2. Criar o canal na categoria correta
    const channel = await guild.channels.create({
      name: `🎫・${ticketId}`,
      type: ChannelType.GuildText,
      parent: parentId || undefined,
      topic: `${eTicket}・${ticketId} | ${eUser} Aberto Por: ${user.tag} | ${eCalendar} Aberto em: ${openedAt} | ${eFolder} Categoria: ${category.toUpperCase()}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });

    // 3. Preparar Interface
    const container = createTicketContainer(guild, user, member, category, description);

    const mainMessage = await channel.send({
      components: [container],
      flags: ["IsComponentsV2"],
    });

    // 4. Salvar no banco
    await db.tickets.create({
      guildId: guild.id,
      ownerId: user.id,
      channelId: channel.id,
      messageId: mainMessage.id,
      ticketId,
      category,
      description,
      openedAt: openedAtDate,
    });

    await interaction.editReply({
      content: `Seu ticket foi aberto com sucesso em ${channel}!`,
    });
  } catch (error: any) {
    console.error("[Ticket] ERRO NA CRIAÇÃO:", error);
    await interaction
      .editReply({
        content: `❌ Erro ao criar ticket: \`${error.message}\``,
      })
      .catch(() => {});
  }
}

const categoryMeta: Record<string, { label: string; emoji: string }> = {
  peds: { label: "Peds", emoji: "1520826742972088371" },
  denuncias: { label: "Denuncias", emoji: "1520829698261778544" },
  kids: { label: "Kids", emoji: "1520826742972088371" },
  responsavel: { label: "Responsável", emoji: "1520828253940486206" },
  suporte: { label: "Suporte", emoji: "1502789958430232688" },
  bot: { label: "Bot", emoji: "1502789931808981012" },
  roupas: { label: "Roupas", emoji: "1502789953334280345" },
  parceria: { label: "Parceria", emoji: "1502789875928400103" },
};
const HIDDEN_CATEGORIES = new Set(["compras", "exclusivo", "pronta_entrega"]);
const RESET_TICKET_CATEGORY_VALUE = "__reset_ticket_category__";

function formatCategoryLabel(category: string) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function createTicketDescriptionModal(category: string, titleCategory?: string) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket/form/submit/${category}`)
    .setTitle(`Ticket - ${titleCategory || formatCategoryLabel(category)}`);

  const descriptionLabel = new LabelBuilder()
    .setLabel("Descricao do Problema")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("description")
        .setPlaceholder("Descreva detalhadamente o motivo do seu contato...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true),
    );

  modal.addComponents(descriptionLabel);
  return modal;
}

createResponder({
  customId: "ticket/form/category",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const category = interaction.values[0];

    if (category === RESET_TICKET_CATEGORY_VALUE) {
      await interaction.update({
        components: interaction.message.components as any,
      });
      return;
    }

    const guildData = await db.guilds.get(interaction.guildId!);
    const configured = guildData.channels?.categories || {};

    if (!configured[category] || HIDDEN_CATEGORIES.has(category)) {
      await interaction.reply({
        content: `<:action_warning:1502789801949265990> Essa categoria nao esta configurada no momento.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const label = categoryMeta[category]?.label || formatCategoryLabel(category);
    await interaction.showModal(createTicketDescriptionModal(category, label)).catch((e) => console.error(e));
  },
});

// 1. Responder que abre o Modal
createResponder({
  customId: "ticket/form/open",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const guildData = await db.guilds.get(interaction.guildId!);
    const configured = guildData.channels?.categories || {};

    const options = Object.keys(configured)
      .filter((key) => configured[key] && !HIDDEN_CATEGORIES.has(key))
      .map((key) => ({
        label: categoryMeta[key]?.label || formatCategoryLabel(key),
        value: key,
        emoji: categoryMeta[key]?.emoji || "1520849868820578385",
      }));

    if (options.length === 0) {
      await interaction.reply({
        content: `<:action_warning:1502789801949265990> Nenhuma categoria foi configurada ainda. Peça para um administrador configurar usando \`/configurar\`.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("ticket/form/submit")
      .setTitle("Abertura de Ticket");

    const categoryLabel = new LabelBuilder()
      .setLabel("Selecione a categoria")
      .setDescription("Escolha o assunto que melhor descreve seu problema")
      .setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId("category")
          .setPlaceholder("Selecione uma categoria...")
          .setOptions(options),
      );

    const descriptionLabel = new LabelBuilder()
      .setLabel("Descrição do Problema")
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("description")
          .setPlaceholder("Descreva detalhadamente o motivo do seu contato...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true),
      );

    modal.addComponents(categoryLabel, descriptionLabel);
    await interaction.showModal(modal).catch((e) => console.error(e));
  },
});

// 2. Responder que recebe a submissão
createResponder({
  customId: "ticket/form/submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processTicketSubmission(interaction);
  },
});

createResponder({
  customId: "ticket/form/submit/:category",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction, { category }) {
    await processTicketSubmission(interaction, category);
  },
});

// 3. Responder de backup
createResponder({
  customId: "Abertura de Ticket",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processTicketSubmission(interaction);
  },
});
