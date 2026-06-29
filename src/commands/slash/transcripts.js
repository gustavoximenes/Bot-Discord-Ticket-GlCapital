const { SlashCommand } = require('@eartharoid/dbf');
const {
	ApplicationCommandOptionType,
	ChannelType,
	MessageFlags,
} = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');

module.exports = class TranscriptsSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'transcripts';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			options: [
				{
					channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
					name: 'channel',
					required: false,
					type: ApplicationCommandOptionType.Channel,
				},
				{
					name: 'clear',
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
						.setTitle(getMessage('commands.slash.transcripts.not_staff.title'))
						.setDescription(getMessage('commands.slash.transcripts.not_staff.description')),
				],
			});
		}

		let channels;
		try {
			channels = JSON.parse(settings.transcriptChannels || '[]');
		} catch {
			channels = [];
		}

		const successEmbed = (title, description) => new ExtendedEmbedBuilder({
			iconURL: interaction.guild.iconURL(),
			text: settings.footer,
		})
			.setColor(settings.successColour)
			.setTitle(title)
			.setDescription(description);

		// clear all transcript channels
		if (interaction.options.getBoolean('clear', false)) {
			await client.prisma.guild.update({
				data: { transcriptChannels: null },
				where: { id: interaction.guild.id },
			});
			return await interaction.editReply({
				embeds: [
					successEmbed(
						getMessage('commands.slash.transcripts.cleared.title'),
						getMessage('commands.slash.transcripts.cleared.description'),
					),
				],
			});
		}

		const channel = interaction.options.getChannel('channel', false);

		// add or remove (toggle) a channel
		if (channel) {
			let title, description;
			if (channels.includes(channel.id)) {
				channels = channels.filter(id => id !== channel.id);
				title = getMessage('commands.slash.transcripts.removed.title');
				description = getMessage('commands.slash.transcripts.removed.description', { channel: `<#${channel.id}>` });
			} else {
				channels.push(channel.id);
				title = getMessage('commands.slash.transcripts.added.title');
				description = getMessage('commands.slash.transcripts.added.description', { channel: `<#${channel.id}>` });
			}
			await client.prisma.guild.update({
				data: { transcriptChannels: channels.length ? JSON.stringify(channels) : null },
				where: { id: interaction.guild.id },
			});
			return await interaction.editReply({ embeds: [successEmbed(title, description)] });
		}

		// no options: list the current channels
		return await interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: interaction.guild.iconURL(),
					text: settings.footer,
				})
					.setColor(settings.primaryColour)
					.setTitle(getMessage('commands.slash.transcripts.list.title'))
					.setDescription(
						channels.length
							? getMessage('commands.slash.transcripts.list.set', { channels: channels.map(id => `> <#${id}>`).join('\n') })
							: getMessage('commands.slash.transcripts.list.empty'),
					),
			],
		});
	}
};
