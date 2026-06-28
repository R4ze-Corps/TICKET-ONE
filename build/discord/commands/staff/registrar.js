import { createCommand } from "#base";
import { createContainer, createRow, Separator, } from "@magicyan/discord";
import { ApplicationCommandType, ButtonBuilder, ButtonStyle, } from "discord.js";
createCommand({
    name: "registrar",
    description: "Enviar o painel publico de registro",
    type: ApplicationCommandType.ChatInput,
    async run(interaction) {
        const container = createContainer(constants.colors.white, "# Sistema de Registro | VILLA PEDS\nPara fazer sua libera\u00e7\u00e3o, precisamos de algumas informa\u00e7\u00f5es suas.\nPor favor, clique no bot\u00e3o abaixo para abrir o formul\u00e1rio e preencher seus dados.", Separator.Default, createRow(new ButtonBuilder({
            customId: "registro/start",
            label: "Registrar",
            style: ButtonStyle.Primary,
            emoji: "\u{1F4DD}",
        })));
        await interaction.reply({
            components: [container],
            flags: ["IsComponentsV2"],
        });
    },
});
