import { createResponder } from "#base";
import { db } from "#database";
import { ResponderType } from "@constatic/base";
import { createContainer, createRow, modalFieldsToRecord, Separator, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, } from "discord.js";
const ANALYSIS_CHANNEL_ID = "1520219493706629231";
const DEFAULT_INITIAL_ROLE_ID = "1519184755373903912";
const DEFAULT_REGISTER_CATEGORIES = [
    {
        id: "player",
        label: "Kids",
        roleId: "1477306990295257208",
        description: "Registro como player.",
        type: "player",
        emoji: "1520826742972088371",
    },
    {
        id: "responsavel",
        label: "Responsavel",
        roleId: "1477283282616979679",
        description: "Registro como pai, mae ou responsavel.",
        type: "responsavel",
        emoji: "1520828253940486206",
    },
];
const pendingRequests = new Map();
const roleMessagesByUser = new Map();
function createRequestId() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
}
function normalizeCategoryType(value) {
    return value?.toLowerCase().includes("respons") ? "responsavel" : "player";
}
function getRegisterCategoryEmoji(category) {
    const key = `${category?.id || ""} ${category?.label || ""}`.toLowerCase();
    if (key.includes("respons"))
        return "1520828253940486206";
    if (key.includes("kid") || key.includes("player"))
        return "1520826742972088371";
    return category?.emoji ? String(category.emoji) : undefined;
}
function getRegistrationConfig(guildData) {
    const saved = guildData.registration || {};
    const savedCategories = Array.isArray(saved.categories)
        ? saved.categories.filter((category) => category?.id && category?.label && category?.roleId)
        : [];
    return {
        initialRoleId: saved.initialRoleId || DEFAULT_INITIAL_ROLE_ID,
        categories: (savedCategories.length > 0 ? savedCategories : DEFAULT_REGISTER_CATEGORIES).map((category) => ({
            id: String(category.id),
            label: String(category.label),
            roleId: String(category.roleId),
            description: String(category.description || "Categoria de registro."),
            type: normalizeCategoryType(category.type),
            emoji: getRegisterCategoryEmoji(category),
        })),
    };
}
function getSingleField(data, key) {
    const value = data[key];
    return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
}
function createApprovedNickname(request) {
    const nickname = `#${request.playerId} ${request.fullName}`.replace(/\s+/g, " ").trim();
    return nickname.slice(0, 32);
}
function formatUsers(userIds) {
    return userIds.map((id) => `<@${id}>`).join(", ");
}
function getRelatedLabel(request) {
    return request.categoryType === "player"
        ? "Pais responsaveis"
        : "Criancas responsaveis";
}
function formatRequestSummary(request) {
    const lines = [
        `**Tipo selecionado:** <@&${request.roleId}> (${request.roleLabel})`,
        `**Nome Completo:** \`${request.fullName}\``,
        `**ID:** \`${request.playerId}\``,
        `**Telefone:** \`${request.phone}\``,
    ];
    if (request.age) {
        lines.push(`**Idade:** \`${request.age}\``);
    }
    if (request.relatedUserIds.length > 0) {
        lines.push(`**${getRelatedLabel(request)}:** ${formatUsers(request.relatedUserIds)}`);
    }
    return lines.join("\n");
}
async function deleteMessageById(interaction, messageId) {
    if (!messageId || !interaction.channel?.isTextBased())
        return;
    const message = await interaction.channel.messages
        .fetch(messageId)
        .catch(() => null);
    await message?.delete().catch(() => { });
}
async function getCategory(interaction, categoryId) {
    const guildData = await db.guilds.get(interaction.guildId);
    const config = getRegistrationConfig(guildData);
    return config.categories.find((category) => category.id === categoryId);
}
async function createRoleSelectContainer(interaction) {
    const guildData = await db.guilds.get(interaction.guildId);
    const config = getRegistrationConfig(guildData);
    return createContainer(constants.colors.white, "## \u{1F4DD} Formulario de Registro", Separator.Default, "Primeiro, O que voce e?", createRow(new StringSelectMenuBuilder({
        customId: "registro/role",
        placeholder: "Selecione seu tipo de registro...",
        options: config.categories.slice(0, 25).map((category) => ({
            label: category.label.slice(0, 100),
            value: category.id,
            description: category.description.slice(0, 100),
            emoji: category.emoji || undefined,
        })),
    })));
}
function createRegisterModal(category) {
    const modal = new ModalBuilder()
        .setCustomId(`registro/form/${category.id}`)
        .setTitle(`Registro - ${category.label}`.slice(0, 45));
    modal.addComponents(new LabelBuilder()
        .setLabel("Nome Completo:")
        .setTextInputComponent(new TextInputBuilder()
        .setCustomId("fullName")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(120)
        .setRequired(true)), new LabelBuilder()
        .setLabel("ID:")
        .setTextInputComponent(new TextInputBuilder()
        .setCustomId("playerId")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(40)
        .setRequired(true)), new LabelBuilder()
        .setLabel("Telefone:")
        .setTextInputComponent(new TextInputBuilder()
        .setCustomId("phone")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(40)
        .setRequired(true)));
    if (category.type === "player") {
        modal.addComponents(new LabelBuilder()
            .setLabel("Idade:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("age")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(3)
            .setRequired(true)));
    }
    return modal;
}
function createUserSelectContainer(request) {
    const prompt = request.categoryType === "player"
        ? "Selecione quem sao os pais responsaveis."
        : "Selecione por qual crianca os pais sao responsaveis.";
    return createContainer(constants.colors.white, "## \u{1F4DD} Formulario de Registro", Separator.Default, formatRequestSummary(request), Separator.Default, prompt, createRow(new UserSelectMenuBuilder({
        customId: `registro/users/${request.id}`,
        placeholder: "Selecione os usuarios...",
        minValues: 1,
        maxValues: 10,
    })));
}
function createConfirmContainer(request) {
    return createContainer(constants.colors.white, "## \u{1F4DD} Formulario de Registro", Separator.Default, formatRequestSummary(request), Separator.Default, "Confira suas informacoes e escolha uma opcao abaixo.", createRow(new ButtonBuilder({
        customId: `registro/submit/${request.id}`,
        label: "Enviar",
        style: ButtonStyle.Success,
        emoji: "1502789797821939752",
    }), new ButtonBuilder({
        customId: `registro/cancel/${request.id}`,
        label: "Cancelar",
        style: ButtonStyle.Danger,
        emoji: "1502789800967536741",
    })));
}
function createReviewContainer(request, status) {
    const applicantLines = [
        `**Solicitante:** <@${request.applicantId}>`,
        `**ID Discord:** \`${request.applicantId}\``,
        `**Tipo:** <@&${request.roleId}> (${request.roleLabel})`,
    ];
    const dataLines = [
        `**Nome Completo:** \`${request.fullName}\``,
        `**ID:** \`${request.playerId}\``,
        `**Telefone:** \`${request.phone}\``,
    ];
    if (request.age) {
        dataLines.push(`**Idade:** \`${request.age}\``);
    }
    const blocks = [
        `## Solicitacao de Registro ${request.id}`,
        Separator.Default,
        applicantLines.join("\n"),
        Separator.Default,
        dataLines.join("\n"),
        Separator.Default,
        `**${getRelatedLabel(request)}:** ${formatUsers(request.relatedUserIds)}`,
    ];
    if (status) {
        blocks.push(Separator.Default, status);
    }
    else {
        blocks.push(Separator.Default, createRow(new ButtonBuilder({
            customId: `registro/review/approve/${request.id}`,
            label: "Aprovar",
            style: ButtonStyle.Success,
            emoji: "1502789797821939752",
        }), new ButtonBuilder({
            customId: `registro/review/reject/${request.id}`,
            label: "Recusar",
            style: ButtonStyle.Danger,
            emoji: "1502789800967536741",
        })));
    }
    return createContainer(constants.colors.white, ...blocks);
}
createResponder({
    customId: "registro/start",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction.reply({
            components: [await createRoleSelectContainer(interaction)],
            flags: ["IsComponentsV2"],
        });
        const message = await interaction.fetchReply().catch(() => null);
        if (message) {
            roleMessagesByUser.set(interaction.user.id, message.id);
        }
    },
});
createResponder({
    customId: "registro/role",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const category = await getCategory(interaction, interaction.values[0]);
        if (!category) {
            await interaction.reply({
                content: "Tipo de registro invalido.",
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.showModal(createRegisterModal(category)).catch(() => { });
    },
});
createResponder({
    customId: "registro/form/:categoryId",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction, { categoryId }) {
        const category = await getCategory(interaction, categoryId);
        if (!category) {
            await interaction.reply({
                content: "Tipo de registro invalido.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const data = modalFieldsToRecord(interaction.fields);
        const roleMessageId = roleMessagesByUser.get(interaction.user.id);
        const request = {
            id: createRequestId(),
            guildId: interaction.guildId,
            applicantId: interaction.user.id,
            roleMessageId,
            categoryId: category.id,
            categoryType: category.type,
            roleId: category.roleId,
            roleLabel: category.label,
            fullName: getSingleField(data, "fullName"),
            playerId: getSingleField(data, "playerId"),
            phone: getSingleField(data, "phone"),
            age: category.type === "player" ? getSingleField(data, "age") : undefined,
            relatedUserIds: [],
        };
        pendingRequests.set(request.id, request);
        roleMessagesByUser.delete(interaction.user.id);
        await deleteMessageById(interaction, roleMessageId);
        await interaction.reply({
            components: [createUserSelectContainer(request)],
            flags: ["IsComponentsV2"],
        });
        const message = await interaction.fetchReply().catch(() => null);
        if (message) {
            request.formMessageId = message.id;
        }
    },
});
createResponder({
    customId: "registro/users/:requestId",
    types: [ResponderType.UserSelect],
    cache: "cached",
    async run(interaction, { requestId }) {
        const request = pendingRequests.get(requestId);
        if (!request || request.applicantId !== interaction.user.id) {
            await interaction.reply({
                content: "Nao encontrei este registro. Comece novamente pelo botao Registrar.",
                flags: ["Ephemeral"],
            });
            return;
        }
        request.relatedUserIds = interaction.values;
        await interaction.update({
            components: [createConfirmContainer(request)],
        });
    },
});
createResponder({
    customId: "registro/submit/:requestId",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction, { requestId }) {
        const request = pendingRequests.get(requestId);
        if (!request || request.applicantId !== interaction.user.id) {
            await interaction.reply({
                content: "Esta solicitacao nao esta mais disponivel.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const channel = await interaction.guild?.channels
            .fetch(ANALYSIS_CHANNEL_ID)
            .catch(() => null);
        if (!channel?.isTextBased()) {
            await interaction.reply({
                content: "Nao foi possivel encontrar o canal de analise de registros.",
                flags: ["Ephemeral"],
            });
            return;
        }
        await channel.send({
            components: [createReviewContainer(request)],
            flags: ["IsComponentsV2"],
        });
        await interaction.deferUpdate().catch(() => { });
        await deleteMessageById(interaction, request.formMessageId || interaction.message?.id);
    },
});
createResponder({
    customId: "registro/cancel/:requestId",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction, { requestId }) {
        const request = pendingRequests.get(requestId);
        if (!request || request.applicantId !== interaction.user.id) {
            await interaction.reply({
                content: "Esta solicitacao nao esta mais disponivel.",
                flags: ["Ephemeral"],
            });
            return;
        }
        pendingRequests.delete(requestId);
        await interaction.deferUpdate().catch(() => { });
        await deleteMessageById(interaction, request.formMessageId || interaction.message?.id);
    },
});
createResponder({
    customId: "registro/review/:action/:requestId",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction, { action, requestId }) {
        const request = pendingRequests.get(requestId);
        if (!request) {
            await interaction.reply({
                content: "Esta solicitacao nao esta mais disponivel.",
                flags: ["Ephemeral"],
            });
            return;
        }
        if (action === "approve") {
            const guildData = await db.guilds.get(interaction.guildId);
            const config = getRegistrationConfig(guildData);
            const member = await interaction.guild?.members
                .fetch(request.applicantId)
                .catch(() => null);
            if (!member) {
                await interaction.reply({
                    content: "Nao encontrei o usuario para aprovar este registro.",
                    flags: ["Ephemeral"],
                });
                return;
            }
            await member.roles.add(request.roleId).catch(async () => {
                await interaction.reply({
                    content: "Nao consegui adicionar o cargo. Verifique as permissoes e hierarquia do bot.",
                    flags: ["Ephemeral"],
                });
            });
            if (interaction.replied)
                return;
            await member.roles.remove(config.initialRoleId).catch(async () => {
                await interaction.reply({
                    content: "Cargo escolhido adicionado, mas nao consegui remover o cargo inicial. Verifique as permissoes e hierarquia do bot.",
                    flags: ["Ephemeral"],
                });
            });
            if (interaction.replied)
                return;
            const nickname = createApprovedNickname(request);
            await member.setNickname(nickname).catch(async () => {
                await interaction.reply({
                    content: "Cargo adicionado, mas nao consegui alterar o nome do player. Verifique as permissoes e hierarquia do bot.",
                    flags: ["Ephemeral"],
                });
            });
            if (interaction.replied)
                return;
            pendingRequests.delete(requestId);
            await interaction.update({
                components: [
                    createReviewContainer(request, `<:check:1520842193257103532> **Aprovado por:** ${interaction.user}`),
                ],
            });
            return;
        }
        if (action === "reject") {
            pendingRequests.delete(requestId);
            await interaction.update({
                components: [
                    createReviewContainer(request, `<:action_remove:1502789800967536741> **Recusado por:** ${interaction.user}`),
                ],
            });
            return;
        }
        await interaction.reply({
            content: "Acao invalida.",
            flags: ["Ephemeral"],
        });
    },
});
