import { createCommand } from "#base";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  PermissionFlagsBits,
} from "discord.js";

createCommand({
  name: "limpar",
  description: "Limpar mensagens de um canal",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
  options: [
    {
      name: "quantidade",
      description: "Quantidade de mensagens para apagar (1 a 100)",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 1,
      maxValue: 100,
    },
  ],
  async run(interaction) {
    await interaction.deferReply({ flags: ["Ephemeral"] });

    const amount = interaction.options.getInteger("quantidade", true);
    const channel = interaction.channel;

    if (!channel || !channel.isTextBased() || !("bulkDelete" in channel)) {
      await interaction.editReply({
        content: "Esse canal nao permite limpeza de mensagens.",
      });
      return;
    }

    try {
      const deletedMessages = await channel.bulkDelete(amount, true);
      const skippedMessages = amount - deletedMessages.size;

      await interaction.editReply({
        content:
          skippedMessages > 0
            ? `<:check:1520842193257103532> ${deletedMessages.size} mensagem(ns) apagada(s). ${skippedMessages} nao puderam ser apagada(s), geralmente por terem mais de 14 dias.`
            : `<:check:1520842193257103532> ${deletedMessages.size} mensagem(ns) apagada(s) com sucesso!`,
      });
    } catch (error) {
      console.error("Erro ao limpar mensagens:", error);
      await interaction.editReply({
        content: "Ocorreu um erro ao limpar as mensagens. Verifique se o bot tem permissao para gerenciar mensagens nesse canal.",
      });
    }
  },
});
