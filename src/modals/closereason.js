const { Modal } = require('@eartharoid/dbf');
const { MessageFlags } = require('discord.js');
const ExtendedEmbedBuilder = require('../lib/embed');
const ms = require('ms');

/**
 * GL Capital: recebe a razão do fechamento preenchida no formulário.
 * - /fechar (id sem `force`): segue o fluxo normal de fechamento com a razão.
 * - /fechar-forcado (id.force): fecha o ticket imediatamente com a razão.
 */
module.exports = class CloseReasonModal extends Modal {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'closereason',
		});
	}

	/**
	 * @param {*} id
	 * @param {import("discord.js").ModalSubmitInteraction} interaction
	 */
	async run(id, interaction) {
		/** @type {import("client")} */
		const client = this.client;

		const reason = interaction.fields.getTextInputValue('reason') || null;

		if (id.force) {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });

			// GL Capital: a confirmação mostra quem estava sendo atendido e a razão informada
			const ticket = await client.prisma.ticket.findUnique({
				select: { createdById: true },
				where: { id: id.ticket },
			});
			const creatorName = ticket
				? await client.tickets.getCreatorName(interaction.guild, ticket.createdById)
				: null;

			const description = [];
			if (creatorName) description.push(`Atendimento de **${creatorName}**.`);
			if (reason) description.push('', '**Razão do fechamento**', `> ${reason.replace(/\n/g, '\n> ')}`);
			description.push('', 'O canal será excluído em alguns segundos.');

			await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.successColour)
						.setTitle('✅ Ticket fechado')
						.setDescription(description.join('\n')),
				],
			});

			setTimeout(async () => {
				await client.tickets.finallyClose(id.ticket, {
					closedBy: interaction.user.id,
					reason,
				});
			}, ms('3s'));
		} else {
			await client.tickets.beforeRequestClose(interaction, reason);
		}
	}
};
