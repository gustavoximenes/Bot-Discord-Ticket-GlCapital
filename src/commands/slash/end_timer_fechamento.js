const { SlashCommand } = require('@eartharoid/dbf');
const { MessageFlags } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');

/**
 * GL Capital: para o contador de fechamento automático do ticket atual.
 *
 * O contador é guardado em Ticket.closeTimer e tem três estados:
 * - `null`                  -> nunca começou; começa na primeira resposta do cargo
 *                              definido em /ticket_devs
 * - `{ dueAt, ms }`         -> contando
 * - `{ stopped: true, ms }` -> parado aqui; não rearma sozinho, só com /start_timer
 */
module.exports = class EndTimerFechamentoSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'end_timer_fechamento';
		super(client, {
			...options,
			description: 'Para o contador de fechamento automático deste ticket',
			dmPermission: false,
			name,
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

		const embed = (colour, title, description) => new ExtendedEmbedBuilder({
			iconURL: interaction.guild.iconURL(),
			text: settings.footer,
		})
			.setColor(colour)
			.setTitle(title)
			.setDescription(description);

		const ticket = await client.prisma.ticket.findUnique({
			select: {
				closeTimer: true,
				id: true,
			},
			where: { id: interaction.channel.id },
		});

		if (!ticket) {
			return await interaction.editReply({
				embeds: [embed(settings.errorColour, '❌ Este não é um canal de tickets', 'Você só pode usar esse comando em tickets.')],
			});
		}

		if (!(await isStaff(interaction.guild, interaction.user.id))) { // if user is not staff
			return await interaction.editReply({
				embeds: [embed(settings.errorColour, '❌ Sem permissão', 'Apenas membros da equipe podem parar o contador de fechamento.')],
			});
		}

		let timer = null;
		try {
			timer = JSON.parse(ticket.closeTimer || 'null');
		} catch {
			timer = null;
		}

		if (timer && !timer.dueAt) {
			return await interaction.editReply({
				embeds: [embed(settings.primaryColour, '⏱️ O contador já está parado', 'Este ticket não será fechado automaticamente.\nUse `/start_timer` para voltar a contar.')],
			});
		}

		// guarda o estado "parado" em vez de limpar: é ele que impede o contador de
		// rearmar sozinho na próxima resposta da equipe. O tempo fica guardado para
		// que o /start_timer possa retomar com a mesma duração.
		await client.prisma.ticket.update({
			data: {
				closeTimer: JSON.stringify({
					ms: timer?.ms ?? null,
					stopped: true,
				}),
			},
			where: { id: ticket.id },
		});

		return await interaction.editReply({
			embeds: [
				embed(
					settings.successColour,
					'⏹️ Contador parado',
					(timer?.dueAt
						? 'A contagem foi interrompida — este ticket não será mais fechado automaticamente por falta de resposta.'
						: 'Este ticket não será fechado automaticamente, nem depois que a equipe responder.') +
					'\nUse `/start_timer` aqui dentro para voltar a contar.',
				),
			],
		});
	}
};
