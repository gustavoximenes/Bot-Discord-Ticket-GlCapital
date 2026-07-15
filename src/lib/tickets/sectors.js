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

module.exports = {
	SECTORS,
	sectorLabel: value => byValue(value)?.label ?? String(value),
	sectorSlug: value => byValue(value)?.slug ?? String(value).toLowerCase(),
};
