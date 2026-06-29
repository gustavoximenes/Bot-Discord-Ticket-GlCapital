const { SlashCommand } = require('@eartharoid/dbf');
const {
	ApplicationCommandOptionType,
	MessageFlags,
} = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
const ms = require('ms');

const MIN_REPEAT = 1;
const MAX_REPEAT = 20;
const DEFAULT_REPEAT = 3;

module.exports = class RemindSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'remind';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			options: [
				{
					name: 'message',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: 'time',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: 'repeat',
					required: false,
					type: ApplicationCommandOptionType.Integer,
				},
				{
					name: 'cancel',
					required: false,
					type: ApplicationCommandOptionType.Boolean,
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

		const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
		const getMessage = client.i18n.getLocale(settings.locale);

		if (!(await isStaff(interaction.guild, interaction.user.id))) { // if user is not staff
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.remind.not_staff.title'))
						.setDescription(getMessage('commands.slash.remind.not_staff.description')),
				],
			});
		}

		// cancel the follow-up reminder
		if (interaction.options.getBoolean('cancel', false)) {
			await client.prisma.guild.update({
				data: { followUpReminder: null },
				where: { id: interaction.guild.id },
			});
			// reset every ticket's progress so a future reminder starts fresh
			await client.prisma.ticket.updateMany({
				data: { reminder: null },
				where: {
					guildId: interaction.guild.id,
					reminder: { not: null },
				},
			});
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.successColour)
						.setTitle(getMessage('commands.slash.remind.cancelled.title'))
						.setDescription(getMessage('commands.slash.remind.cancelled.description')),
				],
			});
		}

		const message = interaction.options.getString('message', false);
		const timeInput = interaction.options.getString('time', false);

		if (!message || !timeInput) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.remind.missing.title'))
						.setDescription(getMessage('commands.slash.remind.missing.description')),
				],
			});
		}

		const intervalMs = ms(timeInput);
		if (!intervalMs) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.close.invalid_time.title'))
						.setDescription(getMessage('commands.slash.close.invalid_time.description', { input: timeInput })),
				],
			});
		}

		let totalReps = interaction.options.getInteger('repeat', false) ?? DEFAULT_REPEAT;
		totalReps = Math.max(MIN_REPEAT, Math.min(MAX_REPEAT, totalReps));

		const followUpReminder = {
			createdBy: interaction.user.id,
			intervalMs,
			message,
			totalReps,
		};

		await client.prisma.guild.update({
			data: { followUpReminder: JSON.stringify(followUpReminder) },
			where: { id: interaction.guild.id },
		});
		// reset every ticket's progress so they all start fresh under the new reminder
		await client.prisma.ticket.updateMany({
			data: { reminder: null },
			where: {
				guildId: interaction.guild.id,
				reminder: { not: null },
			},
		});

		return await interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: interaction.guild.iconURL(),
					text: settings.footer,
				})
					.setColor(settings.successColour)
					.setTitle(getMessage('commands.slash.remind.success.title'))
					.setDescription(getMessage('commands.slash.remind.success.description', {
						message,
						time: ms(intervalMs, { long: true }),
						total: totalReps,
					})),
			],
		});
	}
};
