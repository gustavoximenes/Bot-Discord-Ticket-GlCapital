const { SlashCommand } = require('@eartharoid/dbf');
const {
	ApplicationCommandOptionType,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	MessageFlags,
} = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
const ms = require('ms');

module.exports = class ForceCloseSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'force-close';
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
					required: false,
					type: ApplicationCommandOptionType.Integer,
				},
				{
					name: 'reason',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					autocomplete: true,
					name: 'ticket',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: 'time',
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

		const timeOption = interaction.options.getString('time', false);
		const reasonOption = interaction.options.getString('reason', false);
		const ticketOption = interaction.options.getString('ticket', false);

		// GL Capital: fechamento de um único ticket (canal atual ou opção 'ticket')
		// pede a razão via formulário. Não se aplica ao fechamento em massa por 'time'
		// nem quando a opção 'reason' já foi informada.
		if (!timeOption && !reasonOption && await isStaff(interaction.guild, interaction.user.id)) {
			const targetId = ticketOption || interaction.channel.id;
			const ticket = await client.prisma.ticket.findUnique({
				select: { id: true },
				where: {
					guildId: interaction.guild.id,
					id: targetId,
				},
			});
			if (ticket) {
				return await interaction.showModal(client.tickets.buildCloseReasonModal({
					force: true,
					ticket: ticket.id,
				}));
			}
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
		let ticket;

		const embed = (colour, title, description) => new ExtendedEmbedBuilder({
			iconURL: interaction.guild.iconURL(),
			text: settings.footer,
		})
			.setColor(colour)
			.setTitle(title)
			.setDescription(description);

		// GL Capital: a confirmação de fechamento mostra quem estava sendo atendido
		// e a razão informada no comando.
		const closedEmbed = async closedTicket => {
			const creatorName = await client.tickets.getCreatorName(interaction.guild, closedTicket.createdById);
			const description = [`Atendimento de **${creatorName}**.`];
			if (reasonOption) description.push('', '**Razão do fechamento**', `> ${reasonOption.replace(/\n/g, '\n> ')}`);
			description.push('', 'O canal será excluído em alguns segundos.');
			return embed(settings.successColour, '✅ Ticket fechado', description.join('\n'));
		};

		if (!(await isStaff(interaction.guild, interaction.user.id))) { // if user is not staff
			return await interaction.editReply({
				embeds: [embed(settings.errorColour, '❌ Sem permissão', 'Apenas membros da equipe podem forçar o fechamento de tickets.')],
			});
		}

		if (ticketOption) { // if ticket option is passed
			ticket = await client.prisma.ticket.findUnique({
				include: { category: true },
				where: {
					guildId: interaction.guild.id, // ! very important
					id: ticketOption,
				},
			});

			if (!ticket) {
				return await interaction.editReply({
					embeds: [embed(settings.errorColour, '❌ Ticket inválido', 'Por favor, especifique um ticket válido.')],
				});
			}

			await interaction.editReply({ embeds: [await closedEmbed(ticket)] });

			setTimeout(async () => {
				await client.tickets.finallyClose(ticket.id, {
					closedBy: interaction.user.id,
					reason: reasonOption,
				});
			}, ms('3s'));

		} else if (timeOption) { // if time option is passed
			const time = ms(timeOption);

			if (!time) {
				return await interaction.editReply({
					embeds: [embed(settings.errorColour, '❌ Tempo inválido', `\`${timeOption}\` não é um formato de tempo válido.`)],
				});
			}

			const categoryId = interaction.options.getInteger('category', false);
			const tickets = await client.prisma.ticket.findMany({
				where: {
					categoryId: categoryId ?? undefined, // must be undefined not null
					guildId: interaction.guild.id, // ! very important
					lastMessageAt: { lte: new Date(Date.now() - time) },
					open: true,
				},
			});

			if (tickets.length === 0) {
				return await interaction.editReply({
					embeds: [embed(settings.errorColour, '❌ Sem tickets', `Não há tickets abertos que estão inativos por mais de \`${ms(time, { long: true })}\`.`)],
				});
			}

			const collectorTime = ms('15s');
			const confirmationM = await interaction.editReply({
				components: [
					new ActionRowBuilder()
						.addComponents([
							new ButtonBuilder()
								.setCustomId(JSON.stringify({
									action: 'custom',
									id: 'close',
								}))
								.setStyle(ButtonStyle.Danger)
								.setEmoji('✖️')
								.setLabel('Fechar'),
							new ButtonBuilder()
								.setCustomId(JSON.stringify({
									action: 'custom',
									id: 'cancel',
								}))
								.setStyle(ButtonStyle.Secondary)
								.setEmoji('➖')
								.setLabel('Cancelar'),
						]),
				],
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: `Expira em ${ms(collectorTime, { long: true })}`,
					})
						.setColor(settings.primaryColour)
						.setTitle('❓ Tem certeza?')
						.setDescription(
							`Você está prestes a fechar **${tickets.length}** ticket(s) que estão inativos por mais de \`${ms(time, { long: true })}\`:\n\n` +
							tickets.map(t => `> <#${t.id}>`).join('\n'),
						),
				],
			});

			confirmationM.awaitMessageComponent({
				componentType: ComponentType.Button,
				filter: i => i.user.id === interaction.user.id,
				time: collectorTime,
			})
				.then(async i => {
					if (JSON.parse(i.customId).id === 'close') {
						await i.reply({
							components: [],
							embeds: [
								embed(
									settings.successColour,
									`✅ Fechando ${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`,
									'Os canais serão excluídos em alguns segundos.',
								),
							],
							flags: MessageFlags.Ephemeral,
						});
						setTimeout(async () => {
							for (const t of tickets) {
								await client.tickets.finallyClose(t.id, {
									closedBy: interaction.user.id,
									reason: reasonOption,
								});
							}
						}, ms('3s'));
					} else {
						await interaction.deleteReply();
					}
				})
				.catch(async error => {
					client.log.error(error);
					await interaction.reply({
						components: [],
						embeds: [embed(settings.errorColour, '⏰ Expirado', 'Você não respondeu a tempo. Por favor, tente novamente.')],
					});
				});
		} else {
			ticket = await client.prisma.ticket.findUnique({
				include: { category: true },
				where: {
					guildId: interaction.guild.id, // redundant
					id: interaction.channel.id,
				},
			});

			if (!ticket) {
				return await interaction.editReply({
					embeds: [embed(settings.errorColour, '❌ Este não é um canal de tickets', 'Você só pode usar esse comando em tickets.')],
				});
			}

			await interaction.editReply({ embeds: [await closedEmbed(ticket)] });

			setTimeout(async () => {
				await client.tickets.finallyClose(ticket.id, {
					closedBy: interaction.user.id,
					reason: reasonOption,
				});
			}, ms('3s'));
		}
	}
};
