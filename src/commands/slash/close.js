const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const { isStaff } = require('../../lib/users');

module.exports = class CloseSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'close';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			options: [
				{
					name: 'reason',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
			].map(option => {
				option.descriptionLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.description`);
				option.description = option.descriptionLocalizations['en-GB'];
				option.nameLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.name`);
				return option;
			}),
		});
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction} interaction
	 */
	async run(interaction) {
		/** @type {import("client")} */
		const client = this.client;

		const reasonOption = interaction.options.getString('reason', false);
		const ticket = await client.prisma.ticket.findUnique({
			select: { id: true },
			where: { id: interaction.channel.id },
		});

		// GL Capital: staff que fecha um ticket preenche a razão via formulário
		// (a menos que já tenha informado a opção 'reason' na hora do comando).
		if (ticket && !reasonOption && await isStaff(interaction.guild, interaction.user.id)) {
			return await interaction.showModal(client.tickets.buildCloseReasonModal());
		}

		await client.tickets.beforeRequestClose(interaction);
	}
};
