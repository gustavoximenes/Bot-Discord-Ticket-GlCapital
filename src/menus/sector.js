const { Menu } = require('@eartharoid/dbf');
const {
	ActionRowBuilder,
	EmbedBuilder,
	ModalBuilder,
	MessageFlags,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');

/**
 * GL Capital: segundo passo da abertura de ticket.
 * O usuário escolhe o setor no dropdown; aqui abrimos o modal com
 * Razão, CPF e Link. O setor e o token do fluxo viajam no customId do modal.
 */
module.exports = class SectorMenu extends Menu {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'sector',
		});
	}

	/**
	 * @param {*} id
	 * @param {import("discord.js").StringSelectMenuInteraction} interaction
	 */
	async run(id, interaction) {
		/** @type {import("client")} */
		const client = this.client;

		const ctx = await client.keyv.get(`ticket-flow:${id.flow}`);
		if (!ctx) {
			return await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor('Orange')
						.setTitle('Sessão expirada')
						.setDescription('Este formulário expirou. Clique novamente no botão para abrir um ticket.'),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const sector = interaction.values[0];

		const reasonField = new TextInputBuilder()
			.setCustomId('reason')
			.setLabel('Razão do ticket')
			.setStyle(TextInputStyle.Paragraph)
			.setMinLength(5)
			.setMaxLength(1000)
			.setPlaceholder('Descreva o motivo do ticket')
			.setRequired(true);
		if (ctx.topic) reasonField.setValue(String(ctx.topic).slice(0, 1000));

		const cpfField = new TextInputBuilder()
			.setCustomId('cpf')
			.setLabel('CPF')
			.setStyle(TextInputStyle.Short)
			.setMinLength(11)
			.setMaxLength(14)
			.setPlaceholder('000.000.000-00')
			.setRequired(true);

		const linkField = new TextInputBuilder()
			.setCustomId('link')
			.setLabel('Link')
			.setStyle(TextInputStyle.Short)
			.setMaxLength(300)
			.setPlaceholder('https://...')
			.setRequired(false);

		await interaction.showModal(
			new ModalBuilder()
				.setCustomId(JSON.stringify({
					action: 'ticketinfo',
					flow: id.flow,
					sector,
				}))
				.setTitle('Informações do ticket')
				.setComponents(
					new ActionRowBuilder().setComponents(reasonField),
					new ActionRowBuilder().setComponents(cpfField),
					new ActionRowBuilder().setComponents(linkField),
				),
		);
	}
};
