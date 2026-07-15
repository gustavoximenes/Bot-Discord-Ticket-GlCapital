const ExtendedEmbedBuilder = require('./embed');
const {
	sectorFromChannelName,
	sectorLabel,
} = require('./tickets/sectors');

/**
 * Lê o mapa de líderes de setor guardado no registro do guild.
 * @param {import('@prisma/client').Guild} settings
 * @returns {Record<string, string>} { [setor]: userId }
 */
function getSectorLeaders(settings) {
	try {
		return JSON.parse(settings.sectorLeaders || '{}') || {};
	} catch {
		return {};
	}
}

/**
 * Define o líder de um setor e o adiciona a todos os tickets abertos daquele
 * setor. Usado tanto pelo comando /lider_setor quanto pelo botão de confirmação.
 * @param {import("client")} client
 * @param {import('@prisma/client').Guild} settings registro do guild
 * @param {string} sector valor do setor (ex.: 'CLT')
 * @param {string} leaderId id do usuário líder
 * @returns {Promise<{ count: number }>} quantos tickets receberam o líder
 */
async function applySectorLeader(client, settings, sector, leaderId) {
	const leaders = getSectorLeaders(settings);
	leaders[sector] = leaderId;
	await client.prisma.guild.update({
		data: { sectorLeaders: JSON.stringify(leaders) },
		where: { id: settings.id },
	});

	const tickets = await client.prisma.ticket.findMany({
		select: { id: true },
		where: {
			guildId: settings.id,
			open: true,
		},
	});

	const guild = client.guilds.cache.get(settings.id);
	let count = 0;

	for (const ticket of tickets) {
		try {
			let channel = client.channels.cache.get(ticket.id);
			if (!channel) channel = await client.channels.fetch(ticket.id).catch(() => null);
			if (!channel) continue;
			// só os tickets do setor escolhido (setor identificado pelo nome do canal)
			if (sectorFromChannelName(channel.name) !== sector) continue;

			await channel.permissionOverwrites.edit(
				leaderId,
				{
					AttachFiles: true,
					EmbedLinks: true,
					ReadMessageHistory: true,
					SendMessages: true,
					ViewChannel: true,
				},
				`Líder do setor ${sectorLabel(sector)} definido`,
			);

			await channel.send({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: guild?.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.primaryColour)
						.setDescription(`👑 <@${leaderId}> foi definido como líder do setor **${sectorLabel(sector)}** e adicionado a este ticket.`),
				],
			}).catch(() => { });

			count++;
		} catch (error) {
			client.log.error(error);
		}
	}

	return { count };
}

module.exports = {
	applySectorLeader,
	getSectorLeaders,
};
