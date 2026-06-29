const ExtendedEmbedBuilder = require('./embed');

/**
 * Periodically nudges the openers of every ticket that has the "follow-up" status.
 * Mirrors the structure of ./stale.js (the auto-close engine).
 *
 * The reminder is defined ONCE per guild (via /remind) and stored as JSON in
 * Guild.followUpReminder: { message, intervalMs, totalReps, createdBy }.
 *
 * Per-ticket progress is stored as JSON in Ticket.reminder: { sentReps, lastSentAt }.
 * `lastSentAt` is the timer baseline; it is reset when the opener replies
 * (see src/listeners/client/messageCreate.js), so a ticket is only nudged after
 * a full interval of opener silence. Progress is cleared whenever the ticket's
 * status changes (see src/commands/slash/status.js).
 *
 * The follow-up status is stored in the ticket's `priority` column (see status.js).
 */
module.exports = async function handleReminders(client) {
	client.log.info.cron('Handling follow-up reminders');
	const guilds = await client.prisma.guild.findMany({
		include: {
			tickets: {
				where: {
					open: true,
					priority: 'FOLLOW_UP',
				},
			},
		},
		where: { followUpReminder: { not: null } },
	});

	let processed = 0;
	let sent = 0;

	for (const guild of guilds) {
		let config;
		try {
			config = JSON.parse(guild.followUpReminder);
		} catch {
			continue;
		}
		if (!config?.message || !config?.intervalMs || !config?.totalReps) continue;

		const getMessage = client.i18n.getLocale(guild.locale);

		for (const ticket of guild.tickets) {
			try {
				processed++;

				let progress = null;
				if (ticket.reminder) {
					try {
						progress = JSON.parse(ticket.reminder);
					} catch {
						progress = null;
					}
				}

				// first time we see this follow-up ticket: start the clock (don't fire yet)
				if (!progress) {
					await client.prisma.ticket.update({
						data: { reminder: JSON.stringify({ lastSentAt: Date.now(), sentReps: 0 }) },
						where: { id: ticket.id },
					});
					continue;
				}

				// already nudged the maximum number of times
				if (progress.sentReps >= config.totalReps) continue;

				// not due yet
				if (Date.now() < progress.lastSentAt + config.intervalMs) continue;

				let channel = client.channels.cache.get(ticket.id);
				if (!channel) channel = await client.channels.fetch(ticket.id).catch(() => null);
				if (!channel) {
					await client.prisma.ticket.update({
						data: { reminder: null },
						where: { id: ticket.id },
					});
					continue;
				}

				await channel.send({
					content: `<@${ticket.createdById}>`,
					embeds: [
						new ExtendedEmbedBuilder({
							iconURL: channel.guild.iconURL(),
							text: guild.footer,
						})
							.setColor(guild.primaryColour)
							.setTitle(getMessage('commands.slash.remind.embed_title'))
							.setDescription(config.message),
					],
				});
				sent++;

				progress.sentReps++;
				progress.lastSentAt = Date.now();
				// keep the progress object even when finished so it is not re-initialised
				await client.prisma.ticket.update({
					data: { reminder: JSON.stringify(progress) },
					where: { id: ticket.id },
				});
			} catch (error) {
				client.log.error(error);
			}
		}
	}

	client.log.success.cron({
		processed,
		sent,
	});
};
