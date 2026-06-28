import { Schema } from "mongoose";
import { t } from "../utils.js";
export const ticketSchema = new Schema({
    guildId: t.string,
    ownerId: t.string,
    channelId: t.string,
    messageId: String,
    ticketId: { type: String, unique: true },
    category: t.string,
    description: t.string,
    statusTitle: { type: String, default: "ALINHANDO DETALHES" },
    statusDescription: {
        type: String,
        default: "Estamos conversando sobre sua encomenda e alinhando todos os pontos do projeto.",
    },
    claimedBy: String,
    closed: { type: Boolean, default: false },
    closedBy: String,
    openedAt: { type: Date, default: Date.now },
    closedAt: Date,
}, {
    statics: {
        async getByChannel(channelId) {
            return await this.findOne({ channelId });
        },
    },
});
