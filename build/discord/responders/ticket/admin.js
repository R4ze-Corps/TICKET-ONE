import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createSection, modalFieldsToRecord, Separator, createRow, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";
import { db } from "#database";
import { generateTranscript } from "./manage.js";
function getGuildImage(guild) {
    return (guild?.iconURL?.({ size: 1024 }) ||
        guild?.bannerURL?.({ size: 1024 }) ||
        "https://cdn.discordapp.com/embed/avatars/0.png");
}
function getTicketOpenedAt(ticket) {
    const openedAt = ticket.openedAt ? new Date(ticket.openedAt) : new Date();
    return Number.isNaN(openedAt.getTime()) ? new Date() : openedAt;
}
function hasTicketClaimer(ticket) {
    return typeof ticket.claimedBy === "string" && ticket.claimedBy.length > 0;
}
async function hasTicketStaffPermission(interaction) {
    const member = await interaction.guild?.members
        .fetch(interaction.user.id)
        .catch(() => null);
    if (!member)
        return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator))
        return true;
    if (member.permissions.has(PermissionFlagsBits.ManageChannels))
        return true;
    const guildData = await db.guilds.get(interaction.guildId);
    const staffRoleId = guildData.panel?.staffRoleId;
    return staffRoleId ? member.roles.cache.has(staffRoleId) : false;
}
// Função compartilhada para renomear
async function processRename(interaction) {
    const { channel, fields } = interaction;
    if (!channel?.isTextBased())
        return;
    try {
        // Acknowledge rápido
        await (interaction.isFromMessage()
            ? interaction.deferUpdate()
            : interaction.deferReply({ ephemeral: true })).catch(() => { });
        const data = modalFieldsToRecord(fields);
        const newName = data.new_name;
        if (!newName) {
            await interaction
                .editReply({ content: "Nome inválido." })
                .catch(() => { });
            return;
        }
        const toolEmoji = "🔨";
        const formattedName = `${toolEmoji}・${newName.replace(/\s+/g, "-").toLowerCase()}`;
        await channel.setName(formattedName).catch((err) => {
            console.error("Erro ao renomear canal:", err);
        });
        await interaction
            .editReply({
            content: `<:check:1520842193257103532> Canal renomeado para: \`${formattedName}\``,
        })
            .catch(() => { });
    }
    catch (error) {
        console.error("[Renomear] Erro ao processar:", error);
    }
}
// Responder Original
createResponder({
    customId: "ticket/manage/rename_submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processRename(interaction);
    },
});
// Backup para Renomear
createResponder({
    customId: "Renomear Ticket",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processRename(interaction);
    },
});
// Função compartilhada para finalização (V5 - LOGS OBRIGATÓRIOS + FIX MODAL)
async function processCloseSubmission(interaction) {
    const { channel, user, fields, guild } = interaction;
    if (!channel?.isTextBased())
        return;
    console.log(`[Ticket] >>> FINALIZANDO CANAL: ${channel.name}`);
    // 1. Acknowledge IMEDIATO (Fecha o modal instantaneamente)
    try {
        if (interaction.isFromMessage()) {
            await interaction.deferUpdate().catch(() => { });
        }
        else {
            await interaction.deferReply({ ephemeral: true }).catch(() => { });
        }
        console.log("[Ticket] 1. Discord Acknowledged (Modal Closed)");
    }
    catch (e) {
        console.error("[Ticket] Erro no Acknowledge:", e);
    }
    try {
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket)
            return;
        if (!(await hasTicketStaffPermission(interaction))) {
            await interaction
                .editReply({
                content: "<:action_warning:1502789801949265990> Você não tem permissão para finalizar este ticket.",
                components: [],
            })
                .catch(() => { });
            return;
        }
        if (!hasTicketClaimer(ticket)) {
            await interaction
                .editReply({
                content: "<:action_warning:1502789801949265990> Este ticket precisa ser assumido antes de ser finalizado.",
                components: [],
            })
                .catch(() => { });
            return;
        }
        const data = modalFieldsToRecord(fields);
        const transcriptChoiceRaw = data.transcript_choice;
        const wantTranscriptUser = (Array.isArray(transcriptChoiceRaw)
            ? transcriptChoiceRaw[0]
            : transcriptChoiceRaw) === "yes";
        const considerations = data.considerations || "Atendimento concluído.";
        await channel
            .send({
            content: wantTranscriptUser
                ? `<:bagdinfo:1520843355108544683> O atendimento foi finalizado por ${user}. Gerando transcript e deletando o canal em instantes...`
                : `<:bagdinfo:1520843355108544683> O atendimento foi finalizado por ${user}. Deletando o canal em instantes...`,
        })
            .catch(() => { });
        // 2. Atualizar Banco
        ticket.closed = true;
        ticket.closedBy = user.id;
        ticket.closedAt = new Date();
        await ticket.save();
        console.log("[Ticket] 2. Banco Atualizado");
        // 3. Gerar transcript apenas quando a staff escolher salvar
        console.log(wantTranscriptUser
            ? "[Ticket] 3. Gerando Transcript..."
            : "[Ticket] 3. Fechamento sem transcript.");
        const transcript = wantTranscriptUser
            ? await generateTranscript(channel, ticket, user).catch((err) => {
                console.error("[Ticket] Erro ao gerar transcript:", err);
                return null;
            })
            : null;
        const transcriptUrl = transcript?.url;
        // 4. LOG PARA STAFF (Sempre envia com o link se gerado)
        const guildData = await db.guilds.get(guild.id);
        const logChannelId = guildData.channels?.tickets;
        if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel?.isTextBased()) {
                const owner = await guild.members
                    .fetch(ticket.ownerId)
                    .catch(() => null);
                const claimer = ticket.claimedBy
                    ? await guild.members.fetch(ticket.claimedBy).catch(() => null)
                    : null;
                const openedAtTimestamp = Math.floor(getTicketOpenedAt(ticket).getTime() / 1000);
                const closedAtTimestamp = Math.floor(Date.now() / 1000);
                const logContainer = createContainer("#00FFD4", createSection({
                    content: wantTranscriptUser
                        ? `## <:fileclock:1520839663068119061> Atendimento ${ticket.ticketId}
Venho registrar a log de encerramento do atendimento \`${ticket.ticketId}\`, encerrado por ${user}. Abaixo voce pode ver todas as informacoes seguido do transcript.`
                        : `## <:fileclock:1520839663068119061> Atendimento ${ticket.ticketId}
Venho registrar a log de encerramento do atendimento \`${ticket.ticketId}\`, encerrado por ${user}. O transcript nao foi salvo por escolha da staff.`,
                    thumbnail: getGuildImage(guild),
                }), Separator.Default, `**Identificação**\n` +
                    [
                        `<:Fileup:1520841650652450877> **Aberto por:** ${owner || "Desconhecido"} (\`${ticket.ownerId}\`)`,
                        `<:shield_check:1502789932727668788> **Encerrado por:** ${user} (\`${user.id}\`)`,
                        `<:check:1520842193257103532> **Assumido por:** ${claimer || "Ninguém"} (\`${ticket.claimedBy || "0"}\`)`,
                    ].join("\n"), Separator.Default, `**Cronologia**\n` +
                    [
                        `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f> (<t:${openedAtTimestamp}:R>)`,
                        `<:clock:1502789859960422502> **Encerrado em:** <t:${closedAtTimestamp}:f> (<t:${closedAtTimestamp}:R>)`,
                    ].join("\n"), Separator.Default, `**Detalhes do Ticket**\n` +
                    [
                        `<:foldersearch:1520843134521577615> **Categoria:** \`${ticket.category}\``,
                        `<:bagdinfo:1520843355108544683> **Motivo:** \`${ticket.description || "Não informado."}\``,
                    ].join("\n"), Separator.Default, `**<:check:1520842193257103532> Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``, transcript ? `**Codigo do transcript:** \`${transcript.id}\`` : [], transcriptUrl
                    ? createRow(new ButtonBuilder({
                        label: "Acessar Transcript",
                        style: ButtonStyle.Link,
                        emoji: "1502789882916110407",
                        url: transcriptUrl,
                    }))
                    : []);
                await logChannel
                    .send({ components: [logContainer], flags: ["IsComponentsV2"] })
                    .catch(() => { });
                console.log("[Ticket] 4. Log enviado para Staff");
            }
        }
        // 5. ENVIAR DM PARA O USUÁRIO (Apenas se ele quiser o link)
        const ownerMember = await guild.members
            .fetch(ticket.ownerId)
            .catch(() => null);
        if (ownerMember) {
            const openTime = Math.floor(getTicketOpenedAt(ticket).getTime() / 1000);
            const closeTime = Math.floor(Date.now() / 1000);
            const dmContainer = createContainer(constants.colors.danger, createSection({
                content: `### Atendimento Encerrado\nOlá ${ownerMember}, seu atendimento na categoria \`${ticket.category.toUpperCase()}\` foi encerrado por ${user}. Abaixo você pode ver as considerações finais do seu atendimento.`,
                thumbnail: getGuildImage(guild),
            }), Separator.Default, `<:calendar:1502789854486986752> **Aberto em:** <t:${openTime}:f>`, `<:calendar:1502789854486986752> **Encerrado em:** <t:${closeTime}:f>`, Separator.Default, `<:check:1520842193257103532> **Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``, wantTranscriptUser && transcript
                ? `**Codigo do transcript:** \`${transcript.id}\``
                : [], wantTranscriptUser && transcriptUrl
                ? createRow(new ButtonBuilder({
                    label: "Acessar Transcript",
                    style: ButtonStyle.Link,
                    emoji: "1502789882916110407",
                    url: transcriptUrl,
                }))
                : []);
            await ownerMember
                .send({
                components: [dmContainer],
                flags: ["IsComponentsV2"],
            })
                .catch(() => { });
            console.log("[Ticket] 5. DM de encerramento enviada");
        }
        // 6. Deletar canal
        console.log("[Ticket] 6. Deletando canal em 3 segundos...");
        setTimeout(() => {
            channel.delete().catch(() => { });
        }, 3000);
    }
    catch (err) {
        console.error("[Ticket] Erro no encerramento:", err);
    }
}
// Responder Principal do Submit
createResponder({
    customId: "ticket/manage/close_submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processCloseSubmission(interaction);
    },
});
// Backup para o ID de título
createResponder({
    customId: "Finalizar Atendimento",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        console.log(">>> [Ticket] Finalização capturada pelo backup!");
        await processCloseSubmission(interaction);
    },
});
