/**
 * GL Capital: fecha automaticamente os tickets em que o autor ficou sem responder
 * pelo tempo configurado em /tempo_de_fechamento.
 *
 * O tempo padrão do servidor fica em Guild.closeTimer: { ms, createdBy }.
 * Todo ticket novo já nasce com o contador armado (ver src/lib/tickets/manager.js).
 *
 * O contador de cada ticket fica em Ticket.closeTimer: { dueAt, ms }.
 * `dueAt` é reiniciado sempre que o autor do ticket responde
 * (ver src/listeners/client/messageCreate.js) e o contador é removido por
 * /end_timer_fechamento.
 */
const CLOSE_REASON = 'Fechado automaticamente por falta de resposta';

module.exports = async function handleCloseTimers(client) {
	client.log.verbose.cron('Handling close timers');

	const tickets = await client.prisma.ticket.findMany({
		select: {
			closeTimer: true,
			id: true,
		},
		where: {
			closeTimer: { not: null },
			open: true,
		},
	});

	let closed = 0;

	for (const ticket of tickets) {
		try {
			let timer = null;
			try {
				timer = JSON.parse(ticket.closeTimer);
			} catch {
				timer = null;
			}

			// sem prazo: o contador foi parado por /end_timer_fechamento (ou o dado
			// é inválido). Não limpa o registro — é ele que impede o contador de
			// rearmar sozinho na próxima resposta da equipe.
			if (!timer?.dueAt) continue;

			// ainda dentro do prazo
			if (Date.now() < timer.dueAt) continue;

			// limpa o contador antes de fechar: se duas execuções se sobrepuserem,
			// só a que conseguir limpar (count === 1) fecha o ticket
			const { count } = await client.prisma.ticket.updateMany({
				data: { closeTimer: null },
				where: {
					closeTimer: { not: null },
					id: ticket.id,
					open: true,
				},
			});
			if (count !== 1) continue;

			await client.tickets.finallyClose(ticket.id, {
				closedBy: null,
				reason: CLOSE_REASON,
			});
			closed++;
		} catch (error) {
			client.log.error(error);
		}
	}

	if (closed > 0) {
		client.log.success.cron({
			closed,
			processed: tickets.length,
		});
	}
};

module.exports.CLOSE_REASON = CLOSE_REASON;
