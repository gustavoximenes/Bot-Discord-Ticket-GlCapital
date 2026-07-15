/**
 * GL Capital: os setores disponíveis ao abrir um ticket.
 *
 * `value`  -> valor guardado/enviado nos componentes (customId, select value)
 * `label`  -> texto exibido no dropdown e no embed de abertura
 * `slug`   -> parte usada no nome do canal (numero-setor-nome)
 *
 * Para adicionar/remover um setor, basta editar esta lista.
 */
const SECTORS = [
	{
		label: 'CLT',
		slug: 'clt',
		value: 'CLT',
	},
	{
		label: 'FGTS',
		slug: 'fgts',
		value: 'FGTS',
	},
	{
		label: 'HE',
		slug: 'he',
		value: 'HE',
	},
	{
		label: 'Outro',
		slug: 'outro',
		value: 'OUTRO',
	},
];

const byValue = value => SECTORS.find(s => s.value === value);

/**
 * Descobre o setor de um ticket a partir do nome do canal.
 * O nome é criado como "numero-setor-nome" (ex.: 42-clt-joao-silva), mas pode
 * ter um emoji de status prefixado (ex.: 🔧42-clt-joao). Procuramos o slug do
 * setor na posição esperada e, se não achar, em qualquer segmento do nome.
 * @param {string} channelName
 * @returns {string|null} o `value` do setor (ex.: 'CLT') ou null
 */
const sectorFromChannelName = channelName => {
	const segments = String(channelName).toLowerCase().split('-');
	const found = SECTORS.find(s => s.slug === segments[1])
		?? SECTORS.find(s => segments.includes(s.slug));
	return found?.value ?? null;
};

module.exports = {
	SECTORS,
	sectorFromChannelName,
	sectorLabel: value => byValue(value)?.label ?? String(value),
	sectorSlug: value => byValue(value)?.slug ?? String(value).toLowerCase(),
};
