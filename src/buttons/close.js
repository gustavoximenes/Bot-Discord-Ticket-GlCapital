const { Button } = require('@eartharoid/dbf');
const ExtendedEmbedBuilder = require('../lib/embed');
const { isStaff } = require('../lib/users');
const { MessageFlags } = require('discord.js');

module.exports = class CloseButton extends Button {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'close',
		});
	}

	/**
	 * @param {*} id
	 * @param {import("discord.js").ButtonInteraction} interaction
	 */
	async run(id, interaction) {
		/** @type {import("client")} */
		const client = this.client;

		if (id.accepted === undefined) {
			// the close button on the opening message, the same as using /close
			await client.tickets.beforeRequestClose(interaction);
		} else {
			const ticket = await client.tickets.getTicket(interaction.channel.id, true); // true to override cache and load new feedback
			const staff = await isStaff(interaction.guild, interaction.user.id);

			if (id.expect === 'staff' && !staff) {
				return await interaction.reply({
					embeds: [
						new ExtendedEmbedBuilder()
							.setColor(ticket.guild.errorColour)
							.setDescription('✋ Aguarde até que a equipe feche este ticket.'),
					],
					flags: MessageFlags.Ephemeral,
				});
			} else if (id.expect === 'user' && interaction.user.id !== ticket.createdById) {
				return await interaction.reply({
					embeds: [
						new ExtendedEmbedBuilder()
							.setColor(ticket.guild.errorColour)
							.setDescription('✋ Aguarde a resposta do usuário.'),
					],
					flags: MessageFlags.Ephemeral,
				});
			} else {
				if (id.accepted) {
					if (
						ticket.createdById === interaction.user.id &&
						ticket.category.enableFeedback &&
						!ticket.feedback
					) {
						return await interaction.showModal(client.tickets.buildFeedbackModal(ticket.guild.locale, { next: 'acceptClose' }));
					} else {
						await interaction.deferReply();
						await client.tickets.acceptClose(interaction);
					}
				} else {
					try {
						await interaction.update({
							components: [],
							embeds: [
								new ExtendedEmbedBuilder({
									iconURL: interaction.guild.iconURL(),
									text: ticket.guild.footer,
								})
									.setColor(ticket.guild.errorColour)
									.setDescription(`✋ ${interaction.user.toString()} rejeitou a solicitação de fechamento deste ticket.`)
									.setFooter({ text: null }),
							],
						});

					} finally { // this should run regardless of whatever happens above
						client.tickets.$stale.delete(ticket.id);
					}
				}
			}
		}
	}
};
