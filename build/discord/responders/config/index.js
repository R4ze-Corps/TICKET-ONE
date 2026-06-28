import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createRow, modalFieldsToRecord, Separator, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, LabelBuilder, ModalBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
import { db } from "#database";
function limitInputValue(value, maxLength) {
    if (value.length <= maxLength)
        return value;
    return value.slice(0, maxLength);
}
function setOptionalInputValue(input, value, maxLength) {
    if (value)
        input.setValue(limitInputValue(value, maxLength));
    return input;
}
const DEFAULT_PANEL_DESCRIPTION = [
    "Seja bem-vindo ao sistema de atendimento Villão. Utilize o menu abaixo para registrar sua solicitação e aguarde o retorno de nossa equipe.",
    "",
    "> - Abra um ticket somente quando houver real necessidade.",
    "> - Evite marcações excessivas à equipe.",
    "> - Para agilizar seu atendimento, forneça todas as informações relevantes de forma clara e completa.",
    "",
    "Equipe Villão conta com sua colaboração para um atendimento eficiente.",
    "",
].join("\n");
const PANEL_TITLE_EMOJI = "\u{1F4C1}";
const DEFAULT_PANEL_TITLE = `${PANEL_TITLE_EMOJI} ATENDIMENTO VILLÃO`;
const LEGACY_DEFAULT_PANEL_TITLES = new Set([
    "Central de Atendimento",
]);
const LEGACY_DEFAULT_PANEL_DESCRIPTIONS = new Set([
    "Selecione a categoria para ser atendido",
    "Selecione a categoria para ser atendido!",
    "Seja bem-vindo(a) ao nosso sistema de atendimento.",
    "Seja bem-vindo(a) ao nosso sistema de atendimento. Através do atendimento, você pode falar diretamente com nossa equipe.",
]);
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
        label: "Responsável",
        roleId: "1477283282616979679",
        description: "Registro como pai, mãe ou responsável.",
        type: "responsavel",
        emoji: "1520828253940486206",
    },
];
function getPanelTitle(title) {
    if (!title || LEGACY_DEFAULT_PANEL_TITLES.has(title)) {
        return DEFAULT_PANEL_TITLE;
    }
    return title.replace(/^(?::File2:|<:File2:\d+>|📁|ðŸ“)\s*/, `${PANEL_TITLE_EMOJI} `);
}
function getPanelDescription(description) {
    if (!description || LEGACY_DEFAULT_PANEL_DESCRIPTIONS.has(description)) {
        return DEFAULT_PANEL_DESCRIPTION;
    }
    return description;
}
function getPanelFooter(footer) {
    if (!footer || footer.trim().toLowerCase() === "oi") {
        return "Villao 2026 \u00A9 Todos os direitos reservados";
    }
    return footer;
}
function formatTicketCategoryChannel(channelId) {
    return channelId ? `<#${channelId}>` : "Nenhuma categoria configurada.";
}
function formatTicketLogChannel(channelId) {
    return channelId ? `<#${channelId}>` : "Nenhum canal configurado.";
}
function createPanelConfigContainer(guildData) {
    const panel = guildData.panel || {};
    const categories = guildData.channels?.categories || {};
    const logChannelId = guildData.channels?.tickets;
    const staffRoleLine = panel.staffRoleId
        ? `<@&${panel.staffRoleId}>`
        : "Nenhum cargo configurado.";
    return createContainer(constants.colors.white, "## Configuração do Painel Ticket", Separator.Default, `**Cargo da Staff:** ${staffRoleLine}`, `**Canal de Logs:** ${formatTicketLogChannel(logChannelId)}`, `**Categoria Peds:** ${formatTicketCategoryChannel(categories.peds)}`, `**Categoria Denuncias:** ${formatTicketCategoryChannel(categories.denuncias)}`, Separator.Default, createRow(new ButtonBuilder({
        customId: "config/painel/text",
        label: "Editar Painel",
        style: ButtonStyle.Primary,
        emoji: "1520832648728023041",
    }), new ButtonBuilder({
        customId: "config/painel/staff_role",
        label: "Cargo Staff",
        style: ButtonStyle.Secondary,
        emoji: "1502789938532450304",
    }), new ButtonBuilder({
        customId: "config/painel/categories",
        label: "Categorias Ticket",
        style: ButtonStyle.Secondary,
        emoji: "1520843134521577615",
    })), createRow(new ButtonBuilder({
        customId: "config/painel/log_channel",
        label: "Canal Logs",
        style: ButtonStyle.Secondary,
        emoji: "1502789882916110407",
    })));
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
function createCategoryId(label, categories) {
    const base = label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "categoria";
    let id = base;
    let index = 2;
    while (categories.some((category) => category.id === id)) {
        id = `${base}_${index++}`.slice(0, 60);
    }
    return id;
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
async function saveRegistrationConfig(guildData, config) {
    guildData.registration = config;
    await guildData.save();
}
function createRegistrationConfigContainer(config) {
    const categories = config.categories.length
        ? config.categories
            .map((category, index) => {
            const typeLabel = category.type === "player" ? "Player" : "Responsável";
            return `${index + 1}. **${category.label}** - <@&${category.roleId}> (${typeLabel})`;
        })
            .join("\n")
        : "Nenhuma categoria configurada.";
    return createContainer(constants.colors.white, "## Configuração do Registro", Separator.Default, `**Cargo Inicial:** <@&${config.initialRoleId}>`, Separator.Default, `**Categorias de Set:**\n${categories}`, Separator.Default, createRow(new ButtonBuilder({
        customId: "config/registro/initial_role",
        label: "Cargo Inicial",
        style: ButtonStyle.Primary,
        emoji: "1502789979229913268",
    }), new ButtonBuilder({
        customId: "config/registro/category/create",
        label: "Criar Categoria",
        style: ButtonStyle.Success,
        emoji: "1502789797821939752",
    })), createRow(new ButtonBuilder({
        customId: "config/registro/set_role/0",
        label: "Cargo Set 1",
        style: ButtonStyle.Secondary,
        emoji: "1502789979229913268",
        disabled: config.categories.length < 1,
    }), new ButtonBuilder({
        customId: "config/registro/set_role/1",
        label: "Cargo Set 2",
        style: ButtonStyle.Secondary,
        emoji: "1502789979229913268",
        disabled: config.categories.length < 2,
    })), createRow(new ButtonBuilder({
        customId: "config/registro/category/edit",
        label: "Editar Categoria",
        style: ButtonStyle.Secondary,
        emoji: "1502789938532450304",
    }), new ButtonBuilder({
        customId: "config/registro/category/delete",
        label: "Excluir Categoria",
        style: ButtonStyle.Danger,
        emoji: "1502789800967536741",
    })));
}
function createCategoryModal(customId, category) {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(category ? "Editar Categoria" : "Criar Categoria");
    modal.addComponents(new LabelBuilder()
        .setLabel("Nome da categoria")
        .setTextInputComponent(setOptionalInputValue(new TextInputBuilder()
        .setCustomId("label")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(true), category?.label, 80)), new LabelBuilder()
        .setLabel("Cargo que será aplicado")
        .setTextInputComponent(setOptionalInputValue(new TextInputBuilder()
        .setCustomId("roleId")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(32)
        .setPlaceholder("ID do cargo")
        .setRequired(true), category?.roleId, 32)), new LabelBuilder()
        .setLabel("Descrição")
        .setTextInputComponent(setOptionalInputValue(new TextInputBuilder()
        .setCustomId("description")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true), category?.description, 100)), new LabelBuilder()
        .setLabel("Tipo")
        .setDescription("Use Player ou Responsável")
        .setTextInputComponent(new TextInputBuilder()
        .setCustomId("type")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(20)
        .setValue(category?.type === "responsavel" ? "Responsável" : "Player")
        .setRequired(true)), new LabelBuilder()
        .setLabel("Emoji opcional")
        .setTextInputComponent(setOptionalInputValue(new TextInputBuilder()
        .setCustomId("emoji")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(40)
        .setRequired(false), category?.emoji, 40)));
    return modal;
}
function createCategorySelect(customId, categories, placeholder) {
    return createRow(new StringSelectMenuBuilder({
        customId,
        placeholder,
        options: categories.map((category) => ({
            label: limitInputValue(category.label, 100),
            value: category.id,
            description: limitInputValue(category.description, 100),
            emoji: category.emoji || undefined,
        })),
    }));
}
function readCategoryFields(data) {
    const getVal = (key) => {
        const value = data[key];
        return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
    };
    return {
        label: limitInputValue(getVal("label"), 80),
        roleId: getVal("roleId").replace(/\D/g, ""),
        description: limitInputValue(getVal("description"), 100),
        type: normalizeCategoryType(getVal("type")),
        emoji: limitInputValue(getVal("emoji"), 40) || undefined,
    };
}
// --- BOTÃO: Canal ---
createResponder({
    customId: "config/registro",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        await interaction.update({
            components: [createRegistrationConfigContainer(config)],
        });
    },
});
createResponder({
    customId: "config/registro/initial_role",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction.reply({
            content: "Selecione o cargo inicial para novos membros.",
            components: [
                createRow(new RoleSelectMenuBuilder({
                    customId: "config/registro/initial_role/select",
                    placeholder: "Escolha o cargo inicial...",
                    minValues: 1,
                    maxValues: 1,
                })),
            ],
            flags: ["Ephemeral"],
        });
    },
});
createResponder({
    customId: "config/registro/initial_role/select",
    types: [ResponderType.RoleSelect],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        config.initialRoleId = interaction.values[0];
        await saveRegistrationConfig(guildData, config);
        await interaction.update({
            content: `<:check:1520842193257103532> Cargo inicial atualizado para <@&${config.initialRoleId}>.`,
            components: [],
        });
    },
});
createResponder({
    customId: "config/registro/set_role/:index",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction, { index }) {
        const categoryIndex = Number(index);
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        const category = config.categories[categoryIndex];
        if (!category) {
            await interaction.reply({
                content: "Categoria de set nao encontrada.",
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.reply({
            content: `Selecione o cargo do Set ${categoryIndex + 1} (${category.label}).`,
            components: [
                createRow(new RoleSelectMenuBuilder({
                    customId: `config/registro/set_role/select/${categoryIndex}`,
                    placeholder: `Escolha o cargo do Set ${categoryIndex + 1}...`,
                    minValues: 1,
                    maxValues: 1,
                })),
            ],
            flags: ["Ephemeral"],
        });
    },
});
createResponder({
    customId: "config/registro/set_role/select/:index",
    types: [ResponderType.RoleSelect],
    cache: "cached",
    async run(interaction, { index }) {
        const categoryIndex = Number(index);
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        const category = config.categories[categoryIndex];
        if (!category) {
            await interaction.update({
                content: "Categoria de set nao encontrada.",
                components: [],
            });
            return;
        }
        category.roleId = interaction.values[0];
        await saveRegistrationConfig(guildData, config);
        await interaction.update({
            content: `<:check:1520842193257103532> Cargo do Set ${categoryIndex + 1} (${category.label}) atualizado para <@&${category.roleId}>.`,
            components: [],
        });
    },
});
createResponder({
    customId: "config/registro/category/create",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction
            .showModal(createCategoryModal("config/registro/category/create_submit"))
            .catch(() => { });
    },
});
createResponder({
    customId: "config/registro/category/create_submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] });
        const data = modalFieldsToRecord(interaction.fields);
        const fields = readCategoryFields(data);
        if (!fields.roleId) {
            await interaction.editReply({ content: "Informe um ID de cargo valido para a categoria." });
            return;
        }
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        config.categories.push({
            id: createCategoryId(fields.label, config.categories),
            ...fields,
        });
        await saveRegistrationConfig(guildData, config);
        await interaction.editReply({
            content: `<:check:1520842193257103532> Categoria **${fields.label}** criada com sucesso.`,
        });
    },
});
createResponder({
    customId: "config/registro/category/edit",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        if (config.categories.length === 0) {
            await interaction.reply({
                content: "Nenhuma categoria configurada para editar.",
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.reply({
            content: "Selecione a categoria que deseja editar.",
            components: [
                createCategorySelect("config/registro/category/edit_select", config.categories, "Escolha uma categoria..."),
            ],
            flags: ["Ephemeral"],
        });
    },
});
createResponder({
    customId: "config/registro/category/edit_select",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        const category = config.categories.find((item) => item.id === interaction.values[0]);
        if (!category) {
            await interaction.reply({
                content: "Categoria nao encontrada.",
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction
            .showModal(createCategoryModal(`config/registro/category/edit_submit/${category.id}`, category))
            .catch(() => { });
    },
});
createResponder({
    customId: "config/registro/category/edit_submit/:categoryId",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction, { categoryId }) {
        await interaction.deferReply({ flags: ["Ephemeral"] });
        const data = modalFieldsToRecord(interaction.fields);
        const fields = readCategoryFields(data);
        if (!fields.roleId) {
            await interaction.editReply({ content: "Informe um ID de cargo valido para a categoria." });
            return;
        }
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        const categoryIndex = config.categories.findIndex((item) => item.id === categoryId);
        if (categoryIndex === -1) {
            await interaction.editReply({ content: "Categoria nao encontrada." });
            return;
        }
        config.categories[categoryIndex] = {
            id: categoryId,
            ...fields,
        };
        await saveRegistrationConfig(guildData, config);
        await interaction.editReply({
            content: `<:check:1520842193257103532> Categoria **${fields.label}** atualizada com sucesso.`,
        });
    },
});
createResponder({
    customId: "config/registro/category/delete",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        if (config.categories.length === 0) {
            await interaction.reply({
                content: "Nenhuma categoria configurada para excluir.",
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.reply({
            content: "Selecione a categoria que deseja excluir.",
            components: [
                createCategorySelect("config/registro/category/delete_select", config.categories, "Escolha uma categoria..."),
            ],
            flags: ["Ephemeral"],
        });
    },
});
createResponder({
    customId: "config/registro/category/delete_select",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        const config = getRegistrationConfig(guildData);
        const category = config.categories.find((item) => item.id === interaction.values[0]);
        if (!category) {
            await interaction.reply({
                content: "Categoria nao encontrada.",
                flags: ["Ephemeral"],
            });
            return;
        }
        config.categories = config.categories.filter((item) => item.id !== category.id);
        await saveRegistrationConfig(guildData, config);
        await interaction.update({
            content: `<:action_remove:1502789800967536741> Categoria **${category.label}** excluida.`,
            components: [],
        });
    },
});
createResponder({
    customId: "config/canal",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("config/canal/submit")
            .setTitle("Configurar Canais");
        modal.addComponents(new LabelBuilder()
            .setLabel("Canal de Logs")
            .setDescription("Canal onde os logs de tickets serão enviados")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("logs")
            .setPlaceholder("Selecione o canal de logs...")
            .setChannelTypes(ChannelType.GuildText)), new LabelBuilder()
            .setLabel("Suporte")
            .setDescription("Categoria para tickets de Suporte")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("cat_suporte")
            .setPlaceholder("Selecione a categoria de suporte...")
            .setChannelTypes(ChannelType.GuildCategory)), new LabelBuilder()
            .setLabel("Bot")
            .setDescription("Categoria para tickets de Bot")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("cat_bot")
            .setPlaceholder("Selecione a categoria de bot...")
            .setChannelTypes(ChannelType.GuildCategory)), new LabelBuilder()
            .setLabel("Roupas")
            .setDescription("Categoria para tickets de Roupas")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("cat_roupas")
            .setPlaceholder("Selecione a categoria de roupas...")
            .setChannelTypes(ChannelType.GuildCategory)), new LabelBuilder()
            .setLabel("Parceria")
            .setDescription("Categoria para tickets de Parceria")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("cat_parceria")
            .setPlaceholder("Selecione a categoria de parceria...")
            .setChannelTypes(ChannelType.GuildCategory)));
        await interaction.showModal(modal).catch(() => { });
    },
});
createResponder({
    customId: "config/canal/submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] });
        try {
            const data = modalFieldsToRecord(interaction.fields);
            const guildData = await db.guilds.get(interaction.guildId);
            const getVal = (key) => {
                const v = data[key];
                return (Array.isArray(v) ? v[0] : v);
            };
            guildData.channels = {
                ...guildData.channels,
                tickets: getVal("logs") || guildData.channels?.tickets,
                categories: {
                    ...guildData.channels?.categories,
                    suporte: getVal("cat_suporte") || guildData.channels?.categories?.suporte,
                    bot: getVal("cat_bot") || guildData.channels?.categories?.bot,
                    roupas: getVal("cat_roupas") || guildData.channels?.categories?.roupas,
                    parceria: getVal("cat_parceria") || guildData.channels?.categories?.parceria,
                },
            };
            await guildData.save();
            const doneButton = new ButtonBuilder({
                customId: "config/canal/done",
                label: "Concluir",
                style: ButtonStyle.Success,
                emoji: "1502789797821939752",
            });
            await interaction.editReply({
                content: `<:check:1520842193257103532> Logs, Suporte, Bot, Roupas e Parceria configurados!`,
                components: [createRow(doneButton)],
            });
        }
        catch (error) {
            console.error("Erro ao salvar canais:", error);
            await interaction.editReply({
                content: "Ocorreu um erro ao salvar a configuração.",
            });
        }
    },
});
// --- BOTÃO: Concluir (apenas remove os botões) ---
createResponder({
    customId: "config/canal/done",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction.update({
            content: `<:check:1520842193257103532> Configuração de canais concluída!`,
            components: [],
        });
    },
});
// --- BOTÃO: Limpar Cache ---
createResponder({
    customId: "config/cache",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] });
        try {
            await db.guilds.clear();
            await db.members.clear();
            await db.tickets.clear();
            await db.transcripts.clear();
            await interaction.editReply({
                content: `<:check:1520842193257103532> Cache limpo com sucesso! Todos os dados em memória foram resetados.`,
            });
        }
        catch (error) {
            console.error("Erro ao limpar cache:", error);
            await interaction.editReply({
                content: "Ocorreu um erro ao limpar o cache.",
            });
        }
    },
});
// --- BOTÃO: Painel Ticket ---
createResponder({
    customId: "config/painel",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        await interaction.update({
            components: [createPanelConfigContainer(guildData)],
        });
    },
});
createResponder({
    customId: "config/painel/text",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        const panel = guildData.panel || {};
        const modal = new ModalBuilder()
            .setCustomId("config/painel/submit")
            .setTitle("Personalizar Painel de Tickets");
        const labelTitulo = new LabelBuilder()
            .setLabel("Título")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("title")
            .setPlaceholder(DEFAULT_PANEL_TITLE)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(120)
            .setValue(limitInputValue(getPanelTitle(panel.title), 120))
            .setRequired(true));
        const labelDescricao = new LabelBuilder()
            .setLabel("Descrição")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("description")
            .setPlaceholder("Texto principal do painel de tickets...")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(3500)
            .setValue(limitInputValue(getPanelDescription(panel.description), 3500))
            .setRequired(true));
        const labelFooter = new LabelBuilder()
            .setLabel("Rodapé")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("footer")
            .setPlaceholder("Villao 2026 \u00A9 Todos os direitos reservados")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(300)
            .setValue(limitInputValue(getPanelFooter(panel.footer), 300))
            .setRequired(true));
        modal.addComponents(labelTitulo, labelDescricao, labelFooter);
        await interaction.showModal(modal).catch(() => { });
    },
});
createResponder({
    customId: "config/painel/staff_role",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction.reply({
            content: "Selecione o cargo que poderá usar Painel Admin, Assumir Ticket e Finalizar Ticket.",
            components: [
                createRow(new RoleSelectMenuBuilder({
                    customId: "config/painel/staff_role/select",
                    placeholder: "Escolha o cargo da staff...",
                    minValues: 1,
                    maxValues: 1,
                })),
            ],
            flags: ["Ephemeral"],
        });
    },
});
createResponder({
    customId: "config/painel/categories",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("config/painel/categories_submit")
            .setTitle("Categorias dos Tickets");
        modal.addComponents(new LabelBuilder()
            .setLabel("Peds")
            .setDescription("Categoria onde os tickets Peds serao abertos")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("cat_peds")
            .setPlaceholder("Selecione a categoria de Peds...")
            .setChannelTypes(ChannelType.GuildCategory)), new LabelBuilder()
            .setLabel("Denuncias")
            .setDescription("Categoria onde os tickets de denuncias serao abertos")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("cat_denuncias")
            .setPlaceholder("Selecione a categoria de denuncias...")
            .setChannelTypes(ChannelType.GuildCategory)));
        await interaction.showModal(modal).catch(() => { });
    },
});
createResponder({
    customId: "config/painel/log_channel",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction.reply({
            content: "Selecione o canal onde os logs dos tickets serao enviados.",
            components: [
                createRow(new ChannelSelectMenuBuilder()
                    .setCustomId("config/painel/log_channel/select")
                    .setPlaceholder("Escolha o canal de logs...")
                    .setChannelTypes(ChannelType.GuildText)),
            ],
            flags: ["Ephemeral"],
        });
    },
});
createResponder({
    customId: "config/painel/log_channel/select",
    types: [ResponderType.ChannelSelect],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        const channelId = interaction.values[0];
        guildData.channels = {
            ...guildData.channels,
            tickets: channelId,
        };
        await guildData.save();
        await interaction.update({
            content: `<:check:1520842193257103532> Canal de logs dos tickets configurado para ${formatTicketLogChannel(channelId)}.`,
            components: [],
        });
    },
});
createResponder({
    customId: "config/painel/categories_submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] });
        const data = modalFieldsToRecord(interaction.fields);
        const getVal = (key) => {
            const value = data[key];
            return (Array.isArray(value) ? value[0] : value);
        };
        const guildData = await db.guilds.get(interaction.guildId);
        guildData.channels = {
            ...guildData.channels,
            categories: {
                ...guildData.channels?.categories,
                peds: getVal("cat_peds") || guildData.channels?.categories?.peds,
                denuncias: getVal("cat_denuncias") || guildData.channels?.categories?.denuncias,
            },
        };
        await guildData.save();
        await interaction.editReply({
            content: `<:check:1520842193257103532> Categorias de ticket configuradas.\n` +
                `**Peds:** ${formatTicketCategoryChannel(guildData.channels.categories.peds)}\n` +
                `**Denuncias:** ${formatTicketCategoryChannel(guildData.channels.categories.denuncias)}`,
        });
    },
});
createResponder({
    customId: "config/painel/staff_role/select",
    types: [ResponderType.RoleSelect],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guildId);
        guildData.panel = {
            ...guildData.panel,
            staffRoleId: interaction.values[0],
        };
        await guildData.save();
        await interaction.update({
            content: `<:check:1520842193257103532> Cargo da staff configurado para <@&${interaction.values[0]}>.`,
            components: [],
        });
    },
});
createResponder({
    customId: "config/painel/submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] });
        try {
            const data = modalFieldsToRecord(interaction.fields);
            const guildData = await db.guilds.get(interaction.guildId);
            const getVal = (key) => {
                const v = data[key];
                return (Array.isArray(v) ? v[0] : v);
            };
            guildData.panel = {
                ...guildData.panel,
                title: limitInputValue(getVal("title"), 120),
                description: limitInputValue(getVal("description"), 3500),
                rules: guildData.panel?.rules || [],
                footer: limitInputValue(getVal("footer"), 300),
            };
            await guildData.save();
            await interaction.editReply({
                content: `<:check:1520842193257103532> Painel de tickets personalizado com sucesso! Use \`/ticket painel\` para enviar o novo painel.`,
            });
        }
        catch (error) {
            console.error("Erro ao salvar painel:", error);
            await interaction.editReply({
                content: "Ocorreu um erro ao salvar as configurações do painel.",
            });
        }
    },
});
