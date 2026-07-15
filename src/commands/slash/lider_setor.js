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
const { SECTORS, sectorLabel } = require('../../lib/tickets/sectors');
const {
	applySectorLeader,
	getSectorLeaders,
} = require('../../lib/sectorLeaders');

module.exports = class LiderSetorSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'lider_setor';
		super(client, {
			...options,
			description: 'Define o líder de um setor (CLT, FGTS, HE ou Outro)',
			dmPermission: false,
			name,
			options: [
				{
					choices: SECTORS.map(s => ({
						name: s.label,
						value: s.value,
					})),
					description: 'Setor que terá o líder definido',
					name: 'setor',
					required: true,
					type: ApplicationCommandOptionType.String,
				},
				{
					description: 'Usuário que será o líder do setor',
					name: 'lider',
					required: true,
					type: ApplicationCommandOptionType.User,
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

		// definir líder é configuração do servidor: exige administrador (Gerenciar Servidor) ou acima
		if (await getPrivilegeLevel(interaction.member) < 2) {
			return await interaction.editReply({
				embeds: [embed(settings.errorColour, 'Sem permissão', 'Você precisa ser administrador do servidor para definir líderes de setor.')],
			});
		}

		const sector = interaction.options.getString('setor', true);
		const leader = interaction.options.getUser('lider', true);
		const leaders = getSectorLeaders(settings);
		const current = leaders[sector];

		// já é o líder atual: nada a fazer
		if (current === leader.id) {
			return await interaction.editReply({
				embeds: [embed(settings.primaryColour, 'Nenhuma alteração', `<@${leader.id}> já é o líder do setor **${sectorLabel(sector)}**.`)],
			});
		}

		// setor já tem um líder diferente: pedir confirmação antes de alterar
		if (current) {
			return await interaction.editReply({
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId(JSON.stringify({
								action: 'setleader',
								sector,
								user: leader.id,
							}))
							.setStyle(ButtonStyle.Success)
							.setLabel('Sim, alterar'),
						new ButtonBuilder()
							.setCustomId(JSON.stringify({
								action: 'setleader',
								cancel: true,
							}))
							.setStyle(ButtonStyle.Secondary)
							.setLabel('Cancelar'),
					),
				],
				embeds: [
					embed(
						settings.primaryColour,
						'Alterar líder do setor?',
						`O setor **${sectorLabel(sector)}** já possui um líder: <@${current}>.\nDeseja alterar para <@${leader.id}>?`,
					),
				],
			});
		}

		// setor sem líder: aplicar direto
		const { count } = await applySectorLeader(client, settings, sector, leader.id);
		return await interaction.editReply({
			embeds: [
				embed(
					settings.successColour,
					'Líder definido',
					`<@${leader.id}> agora é o líder do setor **${sectorLabel(sector)}** e foi adicionado a **${count}** ticket(s) aberto(s) desse setor.`,
				),
			],
		});
	}
};
