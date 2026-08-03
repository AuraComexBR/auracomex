/**
 * Single source of truth for country code <-> name (pt-BR) mapping,
 * plus a resolver that turns messy/legacy values (full names, abbreviations,
 * accents, etc.) into a clean 2-letter ISO code.
 */

export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afeganistão' }, { code: 'ZA', name: 'África do Sul' }, { code: 'AL', name: 'Albânia' },
  { code: 'DE', name: 'Alemanha' }, { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antígua e Barbuda' }, { code: 'SA', name: 'Arábia Saudita' }, { code: 'DZ', name: 'Argélia' },
  { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armênia' }, { code: 'AU', name: 'Austrália' },
  { code: 'AT', name: 'Áustria' }, { code: 'AZ', name: 'Azerbaijão' }, { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrein' }, { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' },
  { code: 'BE', name: 'Bélgica' }, { code: 'BZ', name: 'Belize' }, { code: 'BJ', name: 'Benin' },
  { code: 'BY', name: 'Bielorrússia' }, { code: 'BO', name: 'Bolívia' }, { code: 'BA', name: 'Bósnia e Herzegovina' },
  { code: 'BW', name: 'Botsuana' }, { code: 'BR', name: 'Brasil' }, { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgária' }, { code: 'BF', name: 'Burkina Faso' }, { code: 'BI', name: 'Burundi' },
  { code: 'BT', name: 'Butão' }, { code: 'CV', name: 'Cabo Verde' }, { code: 'CM', name: 'Camarões' },
  { code: 'KH', name: 'Camboja' }, { code: 'CA', name: 'Canadá' }, { code: 'QA', name: 'Catar' },
  { code: 'KZ', name: 'Cazaquistão' }, { code: 'TD', name: 'Chade' }, { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' }, { code: 'CY', name: 'Chipre' }, { code: 'CO', name: 'Colômbia' },
  { code: 'KM', name: 'Comores' }, { code: 'CG', name: 'Congo' }, { code: 'KP', name: 'Coreia do Norte' },
  { code: 'KR', name: 'Coreia do Sul' }, { code: 'CI', name: 'Costa do Marfim' }, { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croácia' }, { code: 'CU', name: 'Cuba' }, { code: 'DK', name: 'Dinamarca' },
  { code: 'DJ', name: 'Djibuti' }, { code: 'DM', name: 'Dominica' }, { code: 'EG', name: 'Egito' },
  { code: 'SV', name: 'El Salvador' }, { code: 'AE', name: 'Emirados Árabes Unidos' }, { code: 'EC', name: 'Equador' },
  { code: 'ER', name: 'Eritreia' }, { code: 'SK', name: 'Eslováquia' }, { code: 'SI', name: 'Eslovênia' },
  { code: 'ES', name: 'Espanha' }, { code: 'US', name: 'Estados Unidos' }, { code: 'EE', name: 'Estônia' },
  { code: 'SZ', name: 'Eswatini' }, { code: 'ET', name: 'Etiópia' }, { code: 'FJ', name: 'Fiji' },
  { code: 'PH', name: 'Filipinas' }, { code: 'FI', name: 'Finlândia' }, { code: 'FR', name: 'França' },
  { code: 'GA', name: 'Gabão' }, { code: 'GM', name: 'Gâmbia' }, { code: 'GH', name: 'Gana' },
  { code: 'GE', name: 'Geórgia' }, { code: 'GR', name: 'Grécia' }, { code: 'GD', name: 'Granada' },
  { code: 'GT', name: 'Guatemala' }, { code: 'GY', name: 'Guiana' }, { code: 'GN', name: 'Guiné' },
  { code: 'GW', name: 'Guiné-Bissau' }, { code: 'GQ', name: 'Guiné Equatorial' }, { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' }, { code: 'HU', name: 'Hungria' }, { code: 'YE', name: 'Iêmen' },
  { code: 'IN', name: 'Índia' }, { code: 'ID', name: 'Indonésia' }, { code: 'IQ', name: 'Iraque' },
  { code: 'IR', name: 'Irã' }, { code: 'IE', name: 'Irlanda' }, { code: 'IS', name: 'Islândia' },
  { code: 'IL', name: 'Israel' }, { code: 'IT', name: 'Itália' }, { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japão' }, { code: 'JO', name: 'Jordânia' }, { code: 'KW', name: 'Kuwait' },
  { code: 'LA', name: 'Laos' }, { code: 'LS', name: 'Lesoto' }, { code: 'LV', name: 'Letônia' },
  { code: 'LB', name: 'Líbano' }, { code: 'LR', name: 'Libéria' }, { code: 'LY', name: 'Líbia' },
  { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lituânia' }, { code: 'LU', name: 'Luxemburgo' },
  { code: 'MO', name: 'Macau' },
  { code: 'MK', name: 'Macedônia do Norte' }, { code: 'MG', name: 'Madagascar' }, { code: 'MY', name: 'Malásia' },
  { code: 'MW', name: 'Malawi' }, { code: 'MV', name: 'Maldivas' }, { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' }, { code: 'MA', name: 'Marrocos' }, { code: 'MU', name: 'Maurício' },
  { code: 'MR', name: 'Mauritânia' }, { code: 'MX', name: 'México' }, { code: 'MM', name: 'Mianmar' },
  { code: 'MZ', name: 'Moçambique' }, { code: 'MD', name: 'Moldávia' }, { code: 'MC', name: 'Mônaco' },
  { code: 'MN', name: 'Mongólia' }, { code: 'ME', name: 'Montenegro' }, { code: 'NA', name: 'Namíbia' },
  { code: 'NR', name: 'Nauru' }, { code: 'NP', name: 'Nepal' }, { code: 'NI', name: 'Nicarágua' },
  { code: 'NE', name: 'Níger' }, { code: 'NG', name: 'Nigéria' }, { code: 'NO', name: 'Noruega' },
  { code: 'NZ', name: 'Nova Zelândia' }, { code: 'OM', name: 'Omã' }, { code: 'NL', name: 'Países Baixos' },
  { code: 'PW', name: 'Palau' }, { code: 'PA', name: 'Panamá' }, { code: 'PG', name: 'Papua-Nova Guiné' },
  { code: 'PK', name: 'Paquistão' }, { code: 'PY', name: 'Paraguai' }, { code: 'PE', name: 'Peru' },
  { code: 'PL', name: 'Polônia' }, { code: 'PT', name: 'Portugal' }, { code: 'KE', name: 'Quênia' },
  { code: 'KG', name: 'Quirguistão' }, { code: 'GB', name: 'Reino Unido' }, { code: 'CF', name: 'República Centro-Africana' },
  { code: 'DO', name: 'República Dominicana' }, { code: 'CZ', name: 'República Tcheca' }, { code: 'RO', name: 'Romênia' },
  { code: 'RW', name: 'Ruanda' }, { code: 'RU', name: 'Rússia' }, { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' }, { code: 'LC', name: 'Santa Lúcia' }, { code: 'KN', name: 'São Cristóvão e Névis' },
  { code: 'ST', name: 'São Tomé e Príncipe' }, { code: 'VC', name: 'São Vicente e Granadinas' },
  { code: 'SN', name: 'Senegal' }, { code: 'SL', name: 'Serra Leoa' }, { code: 'RS', name: 'Sérvia' },
  { code: 'SC', name: 'Seychelles' }, { code: 'SG', name: 'Singapura' }, { code: 'SY', name: 'Síria' },
  { code: 'SO', name: 'Somália' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'SE', name: 'Suécia' },
  { code: 'CH', name: 'Suíça' }, { code: 'SR', name: 'Suriname' }, { code: 'TH', name: 'Tailândia' },
  { code: 'TW', name: 'Taiwan' }, { code: 'TJ', name: 'Tajiquistão' }, { code: 'TZ', name: 'Tanzânia' },
  { code: 'TL', name: 'Timor-Leste' }, { code: 'TG', name: 'Togo' }, { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad e Tobago' }, { code: 'TN', name: 'Tunísia' }, { code: 'TM', name: 'Turcomenistão' },
  { code: 'TR', name: 'Turquia' }, { code: 'TV', name: 'Tuvalu' }, { code: 'UA', name: 'Ucrânia' },
  { code: 'UG', name: 'Uganda' }, { code: 'UY', name: 'Uruguai' }, { code: 'UZ', name: 'Uzbequistão' },
  { code: 'VU', name: 'Vanuatu' }, { code: 'VA', name: 'Vaticano' }, { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnã' }, { code: 'ZM', name: 'Zâmbia' }, { code: 'ZW', name: 'Zimbábue' },
  { code: 'HK', name: 'Hong Kong' },
];

const CODE_SET = new Set(COUNTRIES.map((c) => c.code));

/** Extra names/abbreviations that don't match the canonical list above. */
const SYNONYMS: Record<string, string> = {
  'eua': 'US',
  'estados unidos da america': 'US',
  'inglaterra': 'GB',
  'reino unido da gra-bretanha': 'GB',
  'holanda': 'NL',
  'coreia': 'KR',
  'russia federation': 'RU',
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .trim();
}

const NAME_TO_CODE: Record<string, string> = {};
for (const c of COUNTRIES) {
  NAME_TO_CODE[normalize(c.name)] = c.code;
}

/**
 * Resolve any legacy/free-form country value (a 2-letter code, a pt-BR name,
 * or a known abbreviation like "EUA") into a clean 2-letter ISO code.
 * Returns '' if it can't be confidently resolved.
 */
export function resolveCountryCode(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length === 2 && CODE_SET.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  const norm = normalize(trimmed);
  if (SYNONYMS[norm]) return SYNONYMS[norm];
  if (NAME_TO_CODE[norm]) return NAME_TO_CODE[norm];
  return '';
}

export function countryCodeToName(code: string | null | undefined): string {
  if (!code) return '';
  const found = COUNTRIES.find((c) => c.code === code.toUpperCase());
  return found ? found.name : code;
}
