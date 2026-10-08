// Lee una factura (foto o PDF) con Claude y devuelve sus datos estructurados. Solo servidor.
// Necesita ANTHROPIC_API_KEY. La salida es estructurada y se valida con Zod.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const Renglon = z.object({
  descripcion: z.string().describe('Producto o concepto tal como figura en la factura'),
  cantidad: z.number().describe('Cantidad (1 si no figura)'),
  unidad: z.string().describe('Unidad de medida: kg, u, l, etc. Vacío si no figura'),
  precio_unitario: z.number().describe('Precio unitario SIN IVA, con descuentos aplicados. En facturas B, C o tickets: el precio final del renglón dividido la cantidad'),
  alicuota_iva: z.number().describe('Alícuota de IVA en porcentaje (21, 10.5, 27, 0). En facturas B, C o tickets va 0'),
});

export const FacturaLeida = z.object({
  es_comprobante: z.boolean().describe('false si la imagen no es una factura, ticket, nota de crédito o comprobante de compra'),
  proveedor: z.string().describe('Razón social de quien EMITE el comprobante (el vendedor)'),
  cuit_proveedor: z.string().describe('CUIT del emisor, con guiones si los tiene. Vacío si no figura'),
  tipo_comprobante: z.string().describe('Ej.: Factura A, Factura B, Factura C, Nota de crédito A, Ticket, Recibo, Despacho de importación'),
  numero: z.string().describe('Punto de venta y número, formato 0001-00001234. Vacío si no figura'),
  fecha: z.string().describe('Fecha de emisión en formato AAAA-MM-DD'),
  vencimiento_pago: z.string().describe('Fecha de vencimiento del pago en AAAA-MM-DD, o vacío. No es el vencimiento del CAE'),
  moneda: z.enum(['ARS', 'USD']),
  cotizacion: z.number().describe('Tipo de cambio si la factura está en dólares y lo informa; 0 si no'),
  renglones: z.array(Renglon),
  percepciones: z.number().describe('Suma de percepciones de IVA e Ingresos Brutos, impuestos internos y otros tributos. 0 si no hay'),
  total: z.number().describe('Importe total del comprobante'),
  rubro_sugerido: z.string().describe('Uno de los rubros de la lista dada que mejor corresponda, escrito exactamente igual; vacío si ninguno'),
  dudas: z.string().describe('Datos ilegibles o dudosos, en una frase. Vacío si se leyó todo bien'),
});
export type FacturaLeida = z.infer<typeof FacturaLeida>;

const INSTRUCCIONES = `Sos el administrativo de Grupo Modesto, una fábrica mayorista de panificados, pastas, pastelería y
producción de Mendoza (Argentina), con sus marcas Modesto (casa de café), Bastante (café) y La Social (pizzería de barrio).
Te pasan la foto o el PDF de un comprobante de compra o de gasto. Leelo y devolvé sus datos.

- Grupo Modesto (o la razón social del grupo que figure como cliente) es quien COMPRA (el receptor): el proveedor es quien emite el comprobante.
- Los importes van como números, sin símbolo ni separador de miles (1.234,56 → 1234.56).
- En facturas A: precio unitario sin IVA y la alícuota de cada renglón.
- En facturas B, C, tickets y recibos el IVA no se discrimina: alícuota 0 y el precio final.
- Las notas de crédito van con importes positivos: el tipo de comprobante ya indica que restan.
- Si hay descuentos o bonificaciones, aplicalos al precio unitario (o agregá un renglón negativo).
- Si no hay detalle de productos, poné un solo renglón con el concepto principal y el neto.
- No inventes datos: lo que no se lea, dejalo vacío o en 0 y explicalo en "dudas".`;

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type TipoArchivo = (typeof TIPOS)[number];
export const sePuedeLeer = (tipo: string): tipo is TipoArchivo => (TIPOS as readonly string[]).includes(tipo);

export class ErrorLector extends Error {}

export async function leerFactura(datos: Buffer, tipo: TipoArchivo, rubros: string[]): Promise<FacturaLeida> {
  if (!process.env.ANTHROPIC_API_KEY) throw new ErrorLector('Falta configurar ANTHROPIC_API_KEY en el servidor para leer facturas.');
  const client = new Anthropic({ timeout: 120_000, maxRetries: 2 });
  const archivo: Anthropic.Beta.BetaContentBlockParam =
    tipo === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: datos.toString('base64') } }
      : { type: 'image', source: { type: 'base64', media_type: tipo, data: datos.toString('base64') } };
  try {
    const r = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Si los filtros de seguridad rechazaran el pedido, la API lo reintenta sola con el modelo recomendado.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: INSTRUCCIONES,
      output_config: { effort: 'medium', format: betaZodOutputFormat(FacturaLeida) },
      messages: [
        {
          role: 'user',
          content: [archivo, { type: 'text', text: `Rubros posibles: ${rubros.join(' | ') || '(ninguno)'}.\nLeé el comprobante.` }],
        },
      ],
    });
    if (r.stop_reason === 'refusal') throw new ErrorLector('No se pudo leer este comprobante. Cargalo a mano.');
    if (r.stop_reason === 'max_tokens') throw new ErrorLector('La factura es demasiado larga para leerla de una vez. Cargala a mano o en partes.');
    if (!r.parsed_output) throw new ErrorLector('No se pudo interpretar la factura. Probá con una foto más nítida.');
    return r.parsed_output;
  } catch (e) {
    if (e instanceof ErrorLector) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorLector('La ANTHROPIC_API_KEY no es válida.');
    if (e instanceof Anthropic.RateLimitError) throw new ErrorLector('Se hicieron muchos pedidos seguidos. Probá en un minuto.');
    if (e instanceof Anthropic.BadRequestError) throw new ErrorLector('El archivo no se pudo procesar. Probá con una foto JPG o un PDF.');
    if (e instanceof Anthropic.APIConnectionError) throw new ErrorLector('No hubo conexión con el servicio que lee facturas. Probá de nuevo.');
    if (e instanceof Anthropic.APIError) throw new ErrorLector(`El servicio que lee facturas respondió con un error (${e.status}).`);
    throw e;
  }
}
