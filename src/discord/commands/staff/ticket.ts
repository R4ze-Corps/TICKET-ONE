import { createCommand } from "#base";
import { createContainer, createSection } from "@magicyan/discord";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { db } from "#database";

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
      options: [
        {
          name: "canal",
          description: "Canal onde o painel será enviado",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
      ],
    },
    {
      name: "configurar",
      description: "Configurar canais de logs e categorias de roteamento",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "logs",
          description: "Canal onde os logs de tickets serão enviados",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "cat_suporte",
          description: "Categoria para Suporte Geral",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "cat_denuncia",
          description: "Categoria para Denúncias",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "cat_financeiro",
          description: "Categoria para Financeiro",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "cat_bugs",
          description: "Categoria para Bugs",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
      ],
    },
  ],
  async run(interaction) {
    const { options, guildId } = interaction;
    const subcommand = options.getSubcommand();

    if (subcommand === "painel") {
      const channel = options.getChannel("canal", true);
      if (!channel.isTextBased()) {
        await interaction.reply({
          content: "O canal precisa ser de texto!",
          flags: ["Ephemeral"],
        });
        return;
      }

      const container = createContainer(
        "Blue",
        createSection({
          content: `## Central de Atendimento\nClique no botão abaixo para abrir um ticket e entrar em contato com a nossa equipe.`,
          thumbnail: emojis.static.other_ticket,
        }),
        createSection({
          content: "Horário de atendimento: **09:00 às 18:00**",
          button: new ButtonBuilder({
            customId: "ticket/form/open",
            label: "Abrir Ticket",
            style: ButtonStyle.Primary,
            emoji: "1502789959378145300",
          }),
        }),
      );

      await (channel as any).send({
        components: [container],
        flags: ["IsComponentsV2"],
      });

      await interaction.reply({
        content: "Painel de tickets enviado com sucesso!",
        flags: ["Ephemeral"],
      });
    }

    if (subcommand === "configurar") {
      const logsChannel = options.getChannel("logs", true);
      const catSuporte = options.getChannel("cat_suporte", true);
      const catDenuncia = options.getChannel("cat_denuncia", true);
      const catFinanceiro = options.getChannel("cat_financeiro", true);
      const catBugs = options.getChannel("cat_bugs", true);

      await interaction.deferReply({ flags: ["Ephemeral"] });

      try {
        const guildData = await db.guilds.get(guildId!);
        guildData.channels = {
          ...guildData.channels,
          tickets: logsChannel.id,
          categories: {
            suporte: catSuporte.id,
            denuncia: catDenuncia.id,
            financeiro: catFinanceiro.id,
            bugs: catBugs.id,
          },
        };
        await (guildData as any).save();

        await interaction.editReply({
          content:
            "✅ Sistema de tickets configurado! Logs e Categorias salvos com sucesso.",
        });
      } catch (error) {
        console.error("Erro na configuração:", error);
        await interaction.editReply({
          content: "Ocorreu um erro ao salvar a configuração.",
        });
      }
    }
  },
});
