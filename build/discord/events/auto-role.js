import { createEvent } from "#base";
import { db } from "#database";
const DEFAULT_INITIAL_ROLE_ID = "1519184755373903912";
createEvent({
    name: "Auto Role on Join",
    event: "guildMemberAdd",
    async run(member) {
        const guildData = await db.guilds.get(member.guild.id);
        const roleId = guildData.registration?.initialRoleId || DEFAULT_INITIAL_ROLE_ID;
        await member.roles.add(roleId).catch((error) => {
            console.error(`[AutoRole] Nao foi possivel adicionar o cargo ${roleId} para ${member.id}:`, error);
        });
    },
});
