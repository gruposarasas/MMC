import { guardarEmpleado } from '@/acciones/equipo';
import { FormAccion } from '@/components/FormAccion';
import { aTexto } from '@/lib/formato';

export type Empleado = {
  id: number; nombre: string; apellido: string; dni: string | null; cuil: string; nacimiento: string | null; ingreso: string | null; egreso: string | null;
  puesto: string; area: string; telefono: string; mail: string; direccion: string; emergencia: string; obra_social: string; cbu: string;
  talle_remera: string; talle_pantalon: string; talle_calzado: string; sueldo_bruto: number; sueldo_neto: number; dias_vacaciones: number | null;
  activo: boolean; clave_hash: string | null; notas: string;
};

const Campo = ({ n, t, v, tipo = 'text', ayuda, req, modo }: { n: string; t: string; v?: string | null; tipo?: string; ayuda?: string; req?: boolean; modo?: 'numeric' | 'decimal' | 'tel' | 'email' }) => (
  <label className="campo">
    <span>{t}</span>
    <input name={n} type={tipo} defaultValue={v ?? ''} required={req} inputMode={modo} />
    {ayuda && <span className="ayuda">{ayuda}</span>}
  </label>
);

export function FormEmpleado({ e, volver }: { e?: Empleado | null; volver: string }) {
  return (
    <FormAccion accion={guardarEmpleado}>
      <input type="hidden" name="volver" value={volver} />
      {e && <input type="hidden" name="id" value={e.id} />}
      <Campo n="nombre" t="Nombre" v={e?.nombre} req />
      <Campo n="apellido" t="Apellido" v={e?.apellido} />
      <Campo n="dni" t="DNI" v={e?.dni} modo="numeric" ayuda="Es su usuario para entrar a la app." />
      <Campo n="cuil" t="CUIL" v={e?.cuil} modo="numeric" />
      <Campo n="nacimiento" t="Fecha de nacimiento" v={e?.nacimiento} tipo="date" />
      <Campo n="ingreso" t="Fecha de ingreso" v={e?.ingreso} tipo="date" />
      <Campo n="puesto" t="Puesto" v={e?.puesto} />
      <Campo n="area" t="Área / lugar" v={e?.area} />
      <Campo n="telefono" t="WhatsApp" v={e?.telefono} modo="tel" />
      <Campo n="mail" t="Mail" v={e?.mail} tipo="email" />
      <label className="campo ancho">
        <span>Dirección</span>
        <input name="direccion" defaultValue={e?.direccion} />
      </label>
      <Campo n="emergencia" t="Contacto de emergencia" v={e?.emergencia} />
      <Campo n="obra_social" t="Obra social" v={e?.obra_social} />
      <Campo n="cbu" t="CBU o alias" v={e?.cbu} />
      <Campo n="talle_remera" t="Talle remera" v={e?.talle_remera} />
      <Campo n="talle_pantalon" t="Talle pantalón" v={e?.talle_pantalon} />
      <Campo n="talle_calzado" t="Talle calzado" v={e?.talle_calzado} />
      <Campo n="sueldo_neto" t="Sueldo neto de referencia" v={aTexto(e?.sueldo_neto)} modo="decimal" ayuda="Se usa al armar los sueldos del mes." />
      <Campo n="sueldo_bruto" t="Sueldo bruto de referencia" v={aTexto(e?.sueldo_bruto)} modo="decimal" />
      <Campo n="dias_vacaciones" t="Días de vacaciones por año" v={e?.dias_vacaciones != null ? String(e.dias_vacaciones) : ''} modo="numeric" ayuda="Vacío: se calculan por antigüedad (14, 21, 28 o 35)." />
      <label className="campo ancho">
        <span>Notas</span>
        <textarea name="notas" defaultValue={e?.notas} />
      </label>
    </FormAccion>
  );
}
