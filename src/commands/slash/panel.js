const { SlashCommand } = require('@eartharoid/dbf');
const {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { getPrivilegeLevel } = require('../../lib/users');

module.exports = class PanelSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'panel';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			options: [
				{
					autocomplete: true,
					name: 'category',
					required: true,
					type: ApplicationCommandOptionType.Integer,
				},
				{
					name: 'title',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: 'description',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: 'button',
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

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const settings = await client.prisma.guild.findUnique({
			include: { categories: true },
			where: { id: interaction.guild.id },
		});
		const getMessage = client.i18n.getLocale(settings.locale);

		// creating a panel is server setup; require an administrator (Manage Server) or above
		if (await getPrivilegeLevel(interaction.member) < 2) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.panel.not_admin.title'))
						.setDescription(getMessage('commands.slash.panel.not_admin.description')),
				],
			});
		}

		const categoryId = interaction.options.getInteger('category', true);
		const category = settings.categories.find(c => c.id === categoryId);

		if (!category) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.panel.invalid_category.title'))
						.setDescription(getMessage('commands.slash.panel.invalid_category.description')),
				],
			});
		}

		const title = interaction.options.getString('title', false) || category.name;
		const description = interaction.options.getString('description', false) || category.description;
		const label = interaction.options.getString('button', false) || getMessage('buttons.create.text');
		const emoji = getMessage('buttons.create.emoji');

		try {
			const embed = new ExtendedEmbedBuilder({
				iconURL: interaction.guild.iconURL(),
				text: settings.footer,
			})
				.setColor(settings.primaryColour)
				.setTitle(title)
				.setDescription(description);

			// `{ action: 'create', target: <categoryId> }` is the exact customId the existing
			// create button handler (src/buttons/create.js) expects, so the panel opens a ticket
			// through the same flow as /new (including category questions/topic modals).
			const button = new ButtonBuilder()
				.setCustomId(JSON.stringify({
					action: 'create',
					target: category.id,
				}))
				.setStyle(ButtonStyle.Primary)
				.setLabel(label);
			if (emoji) button.setEmoji(emoji);

			await interaction.channel.send({
				components: [new ActionRowBuilder().addComponents(button)],
				embeds: [embed],
			});
		} catch (error) {
			client.log.error(error);
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.panel.failed.title'))
						.setDescription(getMessage('commands.slash.panel.failed.description')),
				],
			});
		}

		return await interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: interaction.guild.iconURL(),
					text: settings.footer,
				})
					.setColor(settings.successColour)
					.setTitle(getMessage('commands.slash.panel.success.title'))
					.setDescription(getMessage('commands.slash.panel.success.description')),
			],
		});
	}
};
