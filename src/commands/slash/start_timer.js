const { SlashCommand } = require('@eartharoid/dbf');
const { MessageFlags } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
const ms = require('ms');

/**
 * GL Capital: (re)inicia o contador de fechamento automático do ticket atual.
 *
 * Normalmente o contador começa sozinho na primeira resposta do cargo definido em
 * /ticket_devs. Este comando serve para retomá-lo depois de um /end_timer_fechamento,
 * ou para começar antes da equipe responder.
 *
 * Usa o tempo que o ticket já tinha; se não houver, usa o padrão do servidor
 * definido em /tempo_de_fechamento.
 */
module.exports = class StartTimerSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'start_timer';
		super(client, {
			...options,
			description: 'Inicia (ou reinicia) o contador de fechamento automático deste ticket',
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
				embeds: [embed(settings.errorColour, '❌ Sem permissão', 'Apenas membros da equipe podem iniciar o contador de fechamento.')],
			});
		}

		let timer = null;
		try {
			timer = JSON.parse(ticket.closeTimer || 'null');
		} catch {
			timer = null;
		}

		let guildDefault = null;
		try {
			guildDefault = JSON.parse(settings.closeTimer || 'null');
		} catch {
			guildDefault = null;
		}

		// o tempo que este ticket já usava tem prioridade sobre o padrão do servidor
		const duration = timer?.ms ?? guildDefault?.ms ?? null;

		if (!duration) {
			return await interaction.editReply({
				embeds: [
					embed(
						settings.errorColour,
						'❌ Nenhum tempo definido',
						'Não há tempo de fechamento configurado.\nUse `/tempo_de_fechamento` para definir um antes de iniciar o contador.',
					),
				],
			});
		}

		const dueAt = Date.now() + duration;
		await client.prisma.ticket.update({
			data: {
				closeTimer: JSON.stringify({
					dueAt,
					ms: duration,
				}),
			},
			where: { id: ticket.id },
		});

		return await interaction.editReply({
			embeds: [
				embed(
					settings.successColour,
					'▶️ Contador iniciado',
					`Este ticket será fechado <t:${Math.floor(dueAt / 1000)}:R> se o autor não responder.\n` +
					`Tempo: **${ms(duration, { long: true })}**. A contagem reinicia a cada resposta dele.`,
				),
			],
		});
	}
};
