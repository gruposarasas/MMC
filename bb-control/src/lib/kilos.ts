// Kilos de café según el nombre del producto. Puro.

/** Kilos por unidad: "Brasil 1 kg", "x 250 g", "1/2 kg", "1,5 kilos", "por kg" (= 1). null si el nombre no dice el peso. */
export function kilosPorUnidad(nombre: string): number | null {
  const s = ` ${nombre.toLowerCase()} `;
  let m = s.match(/(\d+)\s*\/\s*(\d+)\s*(kg|kgs|kilos?)\b/);
  if (m && Number(m[2])) return Number(m[1]) / Number(m[2]);
  m = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilos?)\b/);
  if (m) return Number(m[1].replace(',', '.')) || null;
  // Gramos: "1.000 g" es mil gramos (punto de miles).
  m = s.match(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(g|gr|grs|gramos?)\b/);
  if (m) return Number(m[1].replace(/\./g, '').replace(',', '.')) / 1000 || null;
  if (/\b(x|por|el)\s*(kg|kilo)\b/.test(s)) return 1;
  return null;
}

/**
 * Si un renglón es café, para contar los kilos de cada cliente. Con rubros elegidos en Criterios, los de esos rubros;
 * si no, los de un rubro que diga "café" (o, sin rubro, los que lo digan en el nombre).
 */
export function esCafe(rubro: string, concepto: string, rubrosCafe: string[] | null | undefined) {
  if (rubrosCafe && rubrosCafe.length) return rubrosCafe.some((r) => r.toLowerCase() === rubro.trim().toLowerCase());
  return rubro ? /caf[eé]/i.test(rubro) : /caf[eé]/i.test(concepto);
}
