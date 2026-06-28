import { createCommand } from "#base";
import { createContainer, createRow, createSection, Separator, } from "@magicyan/discord";
import { ApplicationCommandType, ButtonBuilder, ButtonStyle } from "discord.js";
createCommand({
    name: "configurar",
    description: "Configurar sistemas do bot",
    type: ApplicationCommandType.ChatInput,
    defaultMemberPermissions: ["Administrator"],
    async run(interaction) {
        const container = createContainer(constants.colors.white, createSection({
            content: "## <:close:1520841892110012536> Configuração Universal\nSelecione qual área deseja configurar.",
            thumbnail: "https://cdn.discordapp.com/emojis/1502789938532450304.png",
        }), Separator.Default, "**Painel Ticket** — Personalizar o painel de abertura de tickets.", Separator.Default, "**Comando Registrar** — Configurar cargo inicial e categorias do registro.", Separator.Default, createRow(new ButtonBuilder({
            customId: "config/painel",
            label: "Painel Ticket",
            style: ButtonStyle.Primary,
            emoji: "1502789875928400103",
        }), new ButtonBuilder({
            customId: "config/registro",
            label: "Comando Registrar",
            style: ButtonStyle.Secondary,
            emoji: "1502789979229913268",
        })));
        await interaction.reply({
            components: [container],
            flags: ["Ephemeral", "IsComponentsV2"],
        });
    },
});
