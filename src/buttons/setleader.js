const { Button } = require('@eartharoid/dbf');
const { MessageFlags } = require('discord.js');
const ExtendedEmbedBuilder = require('../lib/embed');
const { getPrivilegeLevel } = require('../lib/users');
const { applySectorLeader } = require('../lib/sectorLeaders');
const { sectorLabel } = require('../lib/tickets/sectors');

module.exports = class SetLeaderButton extends Button {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'setleader',
		});
	}

	/**
	 * @param {*} id
	 * @param {import("discord.js").ButtonInteraction} interaction
	 */
	async run(id, interaction) {
		/** @type {import("client")} */
		const client = this.client;

		const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });

		const embed = (colour, title, description) => new ExtendedEmbedBuilder({
			iconURL: interaction.guild.iconURL(),
			text: settings.footer,
		})
			.setColor(colour)
			.setTitle(title)
			.setDescription(description);

		if (await getPrivilegeLevel(interaction.member) < 2) {
			return await interaction.reply({
				embeds: [embed(settings.errorColour, 'Sem permissão', 'Você precisa ser administrador do servidor para definir líderes de setor.')],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (id.cancel) {
			return await interaction.update({
				components: [],
				embeds: [embed(settings.primaryColour, 'Operação cancelada', 'O líder do setor não foi alterado.')],
			});
		}

		const { count } = await applySectorLeader(client, settings, id.sector, id.user);
		return await interaction.update({
			components: [],
			embeds: [
				embed(
					settings.successColour,
					'Líder alterado',
					`<@${id.user}> agora é o líder do setor **${sectorLabel(id.sector)}** e foi adicionado a **${count}** ticket(s) aberto(s) desse setor.`,
				),
			],
		});
	}
};
