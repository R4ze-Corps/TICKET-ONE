import { Schema } from "mongoose";
import { t } from "../utils.js";
export const guildSchema = new Schema({
    id: t.string,
    panel: {
        title: { type: String, default: "📁 ATENDIMENTO VILLÃO" },
        description: { type: String, default: [
                "Seja bem-vindo ao sistema de atendimento Villão. Utilize o menu abaixo para registrar sua solicitação e aguarde o retorno de nossa equipe.",
                "",
                "> - Abra um ticket somente quando houver real necessidade.",
                "> - Evite marcações excessivas à equipe.",
                "> - Para agilizar seu atendimento, forneça todas as informações relevantes de forma clara e completa.",
                "",
                "Equipe Villão conta com sua colaboração para um atendimento eficiente.",
                "",
            ].join("\n") },
        rules: { type: [String], default: ["Forneça o motivo e o máximo de informações possível para agilizar seu atendimento.", "Não chame membros da equipe no privado.", "Iniciar um atendimento sem um motivo coerente poderá resultar em punições."] },
        footer: { type: String, default: "Villao 2026 \u00A9 Todos os direitos reservados" },
    },
    channels: {
        logs: String,
        general: String,
        tickets: String,
        categories: {
            suporte: String,
            bot: String,
            roupas: String,
            parceria: String,
        },
    },
    registration: {
        initialRoleId: { type: String, default: "1519184755373903912" },
        categories: {
            type: [
                {
                    id: String,
                    label: String,
                    roleId: String,
                    description: String,
                    type: String,
                    emoji: String,
                },
            ],
            default: [
                {
                    id: "player",
                    label: "Player",
                    roleId: "1477306990295257208",
                    description: "Registro como player.",
                    type: "player",
                    emoji: "1502789979229913268",
                },
                {
                    id: "responsavel",
                    label: "Responsavel",
                    roleId: "1477283282616979679",
                    description: "Registro como pai, mae ou responsavel.",
                    type: "responsavel",
                    emoji: "1502789940612698192",
                },
            ],
        },
    },
}, {
    statics: {
        async get(id) {
            return (await this.findOne({ id })) ?? this.create({ id });
        },
    },
});
