const { SlashCommand } = require('@eartharoid/dbf');
const {
	ApplicationCommandOptionType,
	MessageFlags,
} = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { isStaff } = require('../../lib/users');

/**
 * GL Capital: define o cargo de atendimento cujo primeiro comentário em um ticket
 * dispara o contador de fechamento automático (ver /tempo_de_fechamento).
 *
 * O cargo é guardado em Guild.devRole e lido em src/listeners/client/messageCreate.js.
 */
module.exports = class TicketDevsSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'ticket_devs';
		super(client, {
			...options,
			description: 'Define o cargo cuja primeira resposta inicia o contador de fechamento',
			dmPermission: false,
			name,
			options: [
				{
					description: 'Cargo de atendimento. Deixe vazio para ver o cargo atual',
					name: 'cargo',
					required: false,
					type: ApplicationCommandOptionType.Role,
				},
				{
					description: 'Remove o cargo definido (o contador deixa de começar sozinho)',
					name: 'remover',
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
				embeds: [embed(settings.errorColour, '❌ Sem permissão', 'Apenas membros da equipe podem definir o cargo de atendimento.')],
			});
		}

		// remover o cargo
		if (interaction.options.getBoolean('remover', false)) {
			await client.prisma.guild.update({
				data: { devRole: null },
				where: { id: interaction.guild.id },
			});
			return await interaction.editReply({
				embeds: [
					embed(
						settings.successColour,
						'✅ Cargo removido',
						'O contador de fechamento não começará mais sozinho.\nEle só poderá ser iniciado manualmente com `/start_timer`.',
					),
				],
			});
		}

		const role = interaction.options.getRole('cargo', false);

		// sem opções: mostrar a configuração atual
		if (!role) {
			return await interaction.editReply({
				embeds: [
					embed(
						settings.primaryColour,
						'👥 Cargo de atendimento',
						settings.devRole
							? `O contador de fechamento começa na primeira resposta de <@&${settings.devRole}> em cada ticket.`
							: 'Nenhum cargo definido — o contador de fechamento não começa sozinho.\nUse `/ticket_devs cargo:@cargo` para definir um.',
					),
				],
			});
		}

		await client.prisma.guild.update({
			data: { devRole: role.id },
			where: { id: interaction.guild.id },
		});

		let closeTimer = null;
		try {
			closeTimer = JSON.parse(settings.closeTimer || 'null');
		} catch {
			closeTimer = null;
		}

		return await interaction.editReply({
			embeds: [
				embed(
					settings.successColour,
					'✅ Cargo de atendimento definido',
					`A partir de agora, o contador de fechamento de cada ticket começa quando alguém de <@&${role.id}> responder nele pela primeira vez.` +
					(closeTimer?.ms
						? ''
						: '\n\n⚠️ Ainda não há tempo de fechamento configurado — use `/tempo_de_fechamento` para definir um, senão nada será fechado.'),
				),
			],
		});
	}
};
