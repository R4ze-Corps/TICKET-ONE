import { createCommand } from "#base";
import {
  createContainer,
  createRow,
  createSection,
} from "@magicyan/discord";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  StringSelectMenuBuilder,
} from "discord.js";
import { db } from "#database";

const TEXT_DISPLAY_LIMIT = 4000;
const HIDDEN_CATEGORIES = new Set(["compras", "exclusivo", "pronta_entrega"]);
const DEFAULT_PANEL_FOOTER = "Villao 2026 \u00A9 Todos os direitos reservados";
const DEFAULT_PANEL_TITLE = "📁 ATENDIMENTO VILLÃO";
const DEFAULT_PANEL_DESCRIPTION =
  [
    "Seja bem-vindo ao sistema de atendimento Villão. Utilize o menu abaixo para registrar sua solicitação e aguarde o retorno de nossa equipe.",
    "",
    "> - Abra um ticket somente quando houver real necessidade.",
    "> - Evite marcações excessivas à equipe.",
    "> - Para agilizar seu atendimento, forneça todas as informações relevantes de forma clara e completa.",
    "",
    "Equipe Villão conta com sua colaboração para um atendimento eficiente.",
    "",
  ].join("\n");
const LEGACY_DEFAULT_PANEL_TITLES = new Set([
  "Central de Atendimento",
]);
const LEGACY_DEFAULT_PANEL_DESCRIPTIONS = new Set([
  "Selecione a categoria para ser atendido",
  "Selecione a categoria para ser atendido!",
  "Seja bem-vindo(a) ao nosso sistema de atendimento.",
  "Seja bem-vindo(a) ao nosso sistema de atendimento. Através do atendimento, você pode falar diretamente com nossa equipe.",
]);

function limitText(value: string, maxLength = TEXT_DISPLAY_LIMIT) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getPanelTitle(title?: string) {
  if (!title || LEGACY_DEFAULT_PANEL_TITLES.has(title)) {
    return DEFAULT_PANEL_TITLE;
  }
  return title;
}

function getPanelDescription(description?: string) {
  if (!description || LEGACY_DEFAULT_PANEL_DESCRIPTIONS.has(description)) {
    return DEFAULT_PANEL_DESCRIPTION;
  }
  return description;
}

function getPanelFooter(footer?: string) {
  return footer || DEFAULT_PANEL_FOOTER;
}

const categoryMeta: Record<string, { label: string; description: string; emoji: string }> = {
  suporte: {
    label: "Suporte",
    description: "Duvidas, ajuda e atendimento geral.",
    emoji: "1502789958430232688",
  },
  bot: {
    label: "Bot",
    description: "Atendimento relacionado a bots.",
    emoji: "1502789931808981012",
  },
  roupas: {
    label: "Roupas",
    description: "Pedidos e duvidas sobre roupas.",
    emoji: "1502789953334280345",
  },
  parceria: {
    label: "Parceria",
    description: "Propostas e assuntos de parceria.",
    emoji: "1502789875928400103",
  },
};

function formatCategoryLabel(category: string) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

createCommand({
  name: "ticket",
  description: "Comandos do sistema de tickets",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: ["Administrator"],
  options: [
    {
      name: "painel",
      description: "Enviar o painel de abertura de tickets",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  async run(interaction) {
    const { guild, options, guildId } = interaction;
    const subcommand = options.getSubcommand();

    if (subcommand === "painel") {
      const channel = interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: "Use esse comando em um canal de texto para enviar o painel.",
          flags: ["Ephemeral"],
        });
        return;
      }

      const guildData = await db.guilds.get(guildId!);
      const panel = guildData.panel || {};
      const title = limitText(getPanelTitle(panel.title), 120);
      const description = limitText(
        getPanelDescription(panel.description),
        TEXT_DISPLAY_LIMIT - title.length - 45,
      );
      const footer = limitText(getPanelFooter(panel.footer), 300);
      const configuredCategories = guildData.channels?.categories || {};
      const categoryOptions = Object.keys(configuredCategories)
        .filter((category) => configuredCategories[category] && !HIDDEN_CATEGORIES.has(category))
        .map((category) => {
          const meta = categoryMeta[category];
          return {
            label: meta?.label || formatCategoryLabel(category),
            description: meta?.description || "Iniciar atendimento nesta categoria.",
            value: category,
            emoji: meta?.emoji || "1502789959378145300",
          };
        })
        .slice(0, 25);

      if (categoryOptions.length === 0) {
        await interaction.reply({
          content: "Nenhuma categoria foi configurada ainda. Use `/configurar` antes de enviar o painel.",
          flags: ["Ephemeral"],
        });
        return;
      }

      const bannerUrl =
        guild?.bannerURL({ size: 1024 }) ||
        guild?.iconURL({ size: 1024 });

      const panelContent = `# ${title}\n${description}\n\n${footer}`;
      const panelBlocks: any[] = [
        bannerUrl
          ? createSection({
              content: panelContent,
              thumbnail: bannerUrl,
            })
          : panelContent,
      ];

      panelBlocks.push(
        createRow(
          new StringSelectMenuBuilder({
            customId: "ticket/form/category",
            placeholder: "Selecione uma opcao...",
            options: categoryOptions,
          }),
        ),
      );

      const container = createContainer(constants.colors.ticketBanner, ...panelBlocks);

      await (channel as any).send({
        components: [container],
        flags: ["IsComponentsV2"],
      });

      await interaction.reply({
        content: "Painel de tickets enviado com sucesso!",
        flags: ["Ephemeral"],
      });
    }
  },
});
