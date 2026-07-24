const { SlashCommand } = require('@eartharoid/dbf');
const {
	ApplicationCommandOptionType,
	MessageFlags,
} = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');
const ms = require('ms');

const MIN_TIME = ms('10s');
const MAX_TIME = ms('30d');

/**
 * GL Capital: define quanto tempo sem resposta do autor faz o ticket fechar sozinho.
 *
 * - Usado FORA de um ticket: define o tempo padrão do servidor (Guild.closeTimer),
 *   aplicado a cada ticket quando o cargo de /ticket_devs responde nele.
 * - Usado DENTRO de um ticket: aplica só àquele ticket e já começa a contar,
 *   sem esperar a resposta do cargo (Ticket.closeTimer).
 *
 * Quem fecha os tickets vencidos é o cron em src/lib/closeTimers.js.
 */
module.exports = class TempoDeFechamentoSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'tempo_de_fechamento';
		super(client, {
			...options,
			description: 'Define em quanto tempo sem resposta do autor o ticket fecha sozinho',
			dmPermission: false,
			name,
			options: [
				{
					description: 'Ex.: 45s, 30m, 2h. Deixe vazio para ver a configuração atual',
					name: 'tempo',
					required: false,
					type: ApplicationCommandOptionType.String,
				},
				{
					description: 'Desliga o fechamento automático (deste ticket ou dos novos tickets)',
					name: 'cancelar',
					required: false,
					type: ApplicationCommandOptionType.Boolean,
				},
			],
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

		if (!(await isStaff(interaction.guild, interaction.user.id))) { // if user is not staff
			return await interaction.editReply({
				embeds: [embed(settings.errorColour, '❌ Sem permissão', 'Apenas membros da equipe podem configurar o fechamento automático.')],
			});
		}

		// se o comando foi usado dentro de um ticket, a alteração vale só para ele
		const ticket = await client.prisma.ticket.findUnique({
			select: {
				closeTimer: true,
				id: true,
			},
			where: { id: interaction.channel.id },
		});

		let ticketTimer = null;
		try {
			ticketTimer = JSON.parse(ticket?.closeTimer || 'null');
		} catch {
			ticketTimer = null;
		}

		let guildDefault = null;
		try {
			guildDefault = JSON.parse(settings.closeTimer || 'null');
		} catch {
			guildDefault = null;
		}

		// desligar o fechamento automático
		if (interaction.options.getBoolean('cancelar', false)) {
			if (ticket) {
				// grava o estado "parado" para o contador não rearmar sozinho
				await client.prisma.ticket.update({
					data: {
						closeTimer: JSON.stringify({
							ms: ticketTimer?.ms ?? null,
							stopped: true,
						}),
					},
					where: { id: ticket.id },
				});
				return await interaction.editReply({
					embeds: [embed(settings.successColour, '⏹️ Contador parado', 'Este ticket não será fechado automaticamente.\nUse `/start_timer` para voltar a contar.')],
				});
			}
			await client.prisma.guild.update({
				data: { closeTimer: null },
				where: { id: interaction.guild.id },
			});
			return await interaction.editReply({
				embeds: [embed(settings.successColour, '⏹️ Fechamento automático desligado', 'Nenhum ticket terá o contador iniciado a partir de agora.\nOs tickets que já estão contando continuam — use `/end_timer_fechamento` dentro de cada um para pará-los.')],
			});
		}

		const timeInput = interaction.options.getString('tempo', false);

		// sem tempo informado: mostrar a configuração atual
		if (!timeInput) {
			const lines = [
				guildDefault?.ms
					? `**Tempo:** ${ms(guildDefault.ms, { long: true })} sem resposta do autor.`
					: '**Tempo:** não configurado (nenhum ticket fecha sozinho).',
				settings.devRole
					? `**Começa:** na primeira resposta de <@&${settings.devRole}> no ticket.`
					: '**Começa:** nunca — nenhum cargo definido em `/ticket_devs`.',
			];
			if (ticket) {
				if (ticketTimer?.dueAt) lines.push(`**Este ticket:** fecha <t:${Math.floor(ticketTimer.dueAt / 1000)}:R> se o autor não responder.`);
				else if (ticketTimer) lines.push('**Este ticket:** contador parado — use `/start_timer` para retomar.');
				else if (settings.devRole) lines.push('**Este ticket:** aguardando a primeira resposta do cargo de atendimento.');
				else lines.push('**Este ticket:** sem contador.');
			}
			return await interaction.editReply({
				embeds: [embed(settings.primaryColour, '⏱️ Fechamento automático', lines.join('\n'))],
			});
		}

		const duration = ms(timeInput);

		if (!duration || duration < MIN_TIME || duration > MAX_TIME) {
			return await interaction.editReply({
				embeds: [
					embed(
						settings.errorColour,
						'❌ Tempo inválido',
						`Não consegui entender \`${timeInput}\`.\nUse valores como \`45s\`, \`30m\` ou \`2h\`, entre ${ms(MIN_TIME, { long: true })} e ${ms(MAX_TIME, { long: true })}.`,
					),
				],
			});
		}

		// dentro de um ticket: arma/reinicia só o contador deste ticket
		if (ticket) {
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
						'⏱️ Contador definido',
						`Este ticket será fechado <t:${Math.floor(dueAt / 1000)}:R> se o autor não responder.\nA contagem reinicia a cada resposta dele.`,
					),
				],
			});
		}

		// fora de um ticket: define o padrão usado por todos os tickets
		await client.prisma.guild.update({
			data: {
				closeTimer: JSON.stringify({
					createdBy: interaction.user.id,
					ms: duration,
				}),
			},
			where: { id: interaction.guild.id },
		});

		return await interaction.editReply({
			embeds: [
				embed(
					settings.successColour,
					'⏱️ Tempo de fechamento definido',
					`Cada ticket será fechado automaticamente após **${ms(duration, { long: true })}** sem resposta do autor.\n` +
					'A contagem começa quando o cargo de atendimento responde no ticket, e reinicia a cada resposta do autor.\n\n' +
					(settings.devRole
						? `Cargo de atendimento atual: <@&${settings.devRole}>.`
						: '⚠️ Nenhum cargo de atendimento definido — use `/ticket_devs` para definir um, senão o contador nunca começa sozinho.'),
				),
			],
		});
	}
};
