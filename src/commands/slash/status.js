const { SlashCommand } = require('@eartharoid/dbf');
const { ApplicationCommandOptionType } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { logTicketEvent } = require('../../lib/logging');
const { isStaff } = require('../../lib/users');

const getEmoji = status => {
	const emojis = {
		'NEW': '🆕',
		'IN_PROGRESS': '🔧',
		'FOLLOW_UP': '🔁', // eslint-disable-line sort-keys
	};
	return emojis[status];
};

module.exports = class StatusSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'status';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			options: [
				{
					choices: ['NEW', 'IN_PROGRESS', 'FOLLOW_UP'],
					name: 'status',
					required: true,
					type: ApplicationCommandOptionType.String,
				},
			].map(option => {
				option.descriptionLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.description`);
				option.description = option.descriptionLocalizations['en-GB'];
				option.nameLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.name`);
				if (option.choices) {
					option.choices = option.choices.map(choice => ({
						name: client.i18n.getMessage(null, `commands.slash.${name}.options.${option.name}.choices.${choice}`),
						nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.choices.${choice}`),
						value: choice,
					}));
				}
				return option;
			}),
		});
	}

	/**
	 *
	 * @param {import("discord.js").ChatInputCommandInteraction} interaction
	 */
	async run(interaction) {
		/** @type {import("client")} */
		const client = this.client;

		await interaction.deferReply();

		const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
		const getMessage = client.i18n.getLocale(settings.locale);
		const ticket = await client.prisma.ticket.findUnique({
			include: { category: { select: { channelName: true } } },
			where: { id: interaction.channel.id },
		});

		if (!ticket) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('misc.not_ticket.title'))
						.setDescription(getMessage('misc.not_ticket.description')),
				],
			});
		}

		if (!(await isStaff(interaction.guild, interaction.user.id))) { // if user is not staff
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.status.not_staff.title'))
						.setDescription(getMessage('commands.slash.status.not_staff.description')),
				],
			});
		}

		const status = interaction.options.getString('status', true);

		// The status is persisted in the legacy `priority` column (free-form text)
		// to avoid a database migration; everything user-facing is "status".
		let name = interaction.channel.name;
		const oldEmoji = getEmoji(ticket.priority);
		if (oldEmoji && name.includes(oldEmoji)) name = name.replace(oldEmoji, getEmoji(status));
		else name = getEmoji(status) + name;
		await interaction.channel.setName(name);

		// don't reassign ticket because the original is used below
		// reset the follow-up reminder progress whenever the status changes:
		// entering FOLLOW_UP starts fresh, leaving it stops the reminders
		await client.prisma.ticket.update({
			data: {
				priority: status,
				reminder: null,
			},
			where: { id: interaction.channel.id },
		});

		logTicketEvent(this.client, {
			action: 'update',
			diff: {
				original: { status: ticket.priority },
				updated: { status: status },
			},
			target: {
				id: ticket.id,
				name: `<#${ticket.id}>`,
			},
			userId: interaction.user.id,
		});

		return await interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: interaction.guild.iconURL(),
					text: settings.footer,
				})
					.setColor(settings.successColour)
					.setTitle(getMessage('commands.slash.status.success.title'))
					.setDescription(getMessage('commands.slash.status.success.description', { status: getMessage(`commands.slash.status.options.status.choices.${status}`) })),
			],
		});

	}
};

module.exports.getEmoji = getEmoji;
