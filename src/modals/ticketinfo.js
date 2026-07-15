const { Modal } = require('@eartharoid/dbf');
const {
	EmbedBuilder,
	MessageFlags,
} = require('discord.js');

/**
 * GL Capital: passo final da abertura de ticket.
 * Recebe Razão, CPF e Link; recupera o contexto do fluxo (categoria/referências)
 * e delega a criação para o TicketManager, passando o setor escolhido.
 */
module.exports = class TicketInfoModal extends Modal {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'ticketinfo',
		});
	}

	/**
	 * @param {*} id
	 * @param {import("discord.js").ModalSubmitInteraction} interaction
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

		// consume the flow token so it can't be replayed
		await client.keyv.delete(`ticket-flow:${id.flow}`);

		const reason = interaction.fields.getTextInputValue('reason');
		const cpf = interaction.fields.getTextInputValue('cpf');
		const link = interaction.fields.getTextInputValue('link');

		await client.tickets.postQuestions({
			categoryId: ctx.categoryId,
			cpf,
			interaction,
			link,
			referencesMessageId: ctx.referencesMessageId,
			referencesTicketId: ctx.referencesTicketId,
			sector: id.sector,
			topic: reason, // a razão é guardada como "topic" do ticket
		});
	}
};
