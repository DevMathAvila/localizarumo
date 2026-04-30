export const brazilStates = [
  { name: "Acre", code: "AC", capital: "Rio Branco", lat: -9.97499, lng: -67.8243 },
  { name: "Alagoas", code: "AL", capital: "Maceio", lat: -9.64985, lng: -35.70895 },
  { name: "Amapa", code: "AP", capital: "Macapa", lat: 0.034934, lng: -51.0694 },
  { name: "Amazonas", code: "AM", capital: "Manaus", lat: -3.11903, lng: -60.0217 },
  { name: "Bahia", code: "BA", capital: "Salvador", lat: -12.9714, lng: -38.5014 },
  { name: "Ceara", code: "CE", capital: "Fortaleza", lat: -3.73186, lng: -38.5267 },
  { name: "Distrito Federal", code: "DF", capital: "Brasilia", lat: -15.7939, lng: -47.8828 },
  { name: "Espirito Santo", code: "ES", capital: "Vitoria", lat: -20.3155, lng: -40.3128 },
  { name: "Goias", code: "GO", capital: "Goiania", lat: -16.6864, lng: -49.2643 },
  { name: "Maranhao", code: "MA", capital: "Sao Luis", lat: -2.53874, lng: -44.2825 },
  { name: "Mato Grosso", code: "MT", capital: "Cuiaba", lat: -15.6014, lng: -56.0979 },
  { name: "Mato Grosso do Sul", code: "MS", capital: "Campo Grande", lat: -20.4697, lng: -54.6201 },
  { name: "Minas Gerais", code: "MG", capital: "Belo Horizonte", lat: -19.9167, lng: -43.9345 },
  { name: "Para", code: "PA", capital: "Belem", lat: -1.45583, lng: -48.4902 },
  { name: "Paraiba", code: "PB", capital: "Joao Pessoa", lat: -7.1195, lng: -34.845 },
  { name: "Parana", code: "PR", capital: "Curitiba", lat: -25.4296, lng: -49.2713 },
  { name: "Pernambuco", code: "PE", capital: "Recife", lat: -8.04756, lng: -34.877 },
  { name: "Piaui", code: "PI", capital: "Teresina", lat: -5.08921, lng: -42.8016 },
  { name: "Rio de Janeiro", code: "RJ", capital: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
  { name: "Rio Grande do Norte", code: "RN", capital: "Natal", lat: -5.77926, lng: -35.2009 },
  { name: "Rio Grande do Sul", code: "RS", capital: "Porto Alegre", lat: -30.0346, lng: -51.2177 },
  { name: "Rondonia", code: "RO", capital: "Porto Velho", lat: -8.76194, lng: -63.9039 },
  { name: "Roraima", code: "RR", capital: "Boa Vista", lat: 2.82384, lng: -60.6753 },
  { name: "Santa Catarina", code: "SC", capital: "Florianopolis", lat: -27.5949, lng: -48.5482 },
  { name: "Sao Paulo", code: "SP", capital: "Sao Paulo", lat: -23.5505, lng: -46.6333 },
  { name: "Sergipe", code: "SE", capital: "Aracaju", lat: -10.9472, lng: -37.0731 },
  { name: "Tocantins", code: "TO", capital: "Palmas", lat: -10.184, lng: -48.3336 }
];

export function findBrazilStateByName(name) {
  const normalizedName = normalizeText(name);

  return brazilStates.find((state) => normalizeText(state.name) === normalizedName) ?? null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
