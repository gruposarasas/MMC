'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { claveNombre, formatoCuit } from '@/lib/proveedores';

export type OpcionProveedor = { id: number; nombre: string; cuit: string; rubro_id: number | null; alias: string[] };
type Nuevo = { nombre: string; cuit: string };

/**
 * Proveedor de una compra o gasto: se elige de la lista. Si no está, se agrega uno nuevo
 * (queda en la lista al guardar). Escribir un nombre suelto no alcanza.
 */
export function ElegirProveedor({ opciones, id, nuevo, requerido }: { opciones: OpcionProveedor[]; id?: number | null; nuevo?: Nuevo | null; requerido?: boolean }) {
  const inicial = id ? (opciones.find((o) => o.id === id) ?? null) : null;
  const [elegido, setElegido] = useState<OpcionProveedor | null>(inicial);
  const [alta, setAlta] = useState<Nuevo | null>(inicial ? null : (nuevo ?? null));
  const [texto, setTexto] = useState(inicial?.nombre ?? nuevo?.nombre ?? '');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const idLista = useId();

  const k = claveNombre(texto);
  const digitos = texto.replace(/\D/g, '');
  const lista = useMemo(() => {
    if (!k) return opciones.slice(0, 40);
    return opciones
      .filter((o) => claveNombre(o.nombre).includes(k) || o.alias.some((a) => claveNombre(a).includes(k)) || (digitos.length >= 4 && o.cuit.includes(digitos)))
      .slice(0, 40);
  }, [k, digitos, opciones]);
  const exacto = opciones.find((o) => claveNombre(o.nombre) === k || o.alias.some((a) => claveNombre(a) === k));
  const puedeAgregar = texto.trim().length >= 2 && !exacto && !elegido;
  const total = lista.length + (puedeAgregar ? 1 : 0);

  // Escrito pero sin elegir: el formulario no se envía hasta que se elija o se agregue.
  useEffect(() => {
    const msg = elegido || alta ? '' : texto.trim() ? 'Elegí el proveedor de la lista o tocá "Agregar proveedor nuevo".' : requerido ? 'Elegí el proveedor.' : '';
    input.current?.setCustomValidity(msg);
  }, [elegido, alta, texto, requerido]);

  useEffect(() => {
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, []);

  function elegir(o: OpcionProveedor) {
    setElegido(o);
    setAlta(null);
    setTexto(o.nombre);
    setAbierto(false);
    // El rubro habitual del proveedor, si todavía no se eligió uno.
    const rubro = input.current?.form?.elements.namedItem('rubro_id');
    if (o.rubro_id && rubro instanceof HTMLSelectElement && !rubro.value && [...rubro.options].some((x) => x.value === String(o.rubro_id))) {
      rubro.value = String(o.rubro_id);
    }
  }
  function agregar() {
    setAlta({ nombre: texto.trim().replace(/\s+/g, ' '), cuit: nuevo && claveNombre(nuevo.nombre) === k ? nuevo.cuit : '' });
    setElegido(null);
    setAbierto(false);
  }
  function tecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAbierto(true);
      setActivo((a) => (total ? (a + (e.key === 'ArrowDown' ? 1 : total - 1)) % total : 0));
    } else if (e.key === 'Enter' && abierto && total) {
      e.preventDefault(); // Enter elige, no guarda
      if (activo < lista.length) elegir(lista[activo]);
      else agregar();
    } else if (e.key === 'Escape' && abierto) {
      e.stopPropagation(); // cierra la lista, no la ventana
      setAbierto(false);
    }
  }

  return (
    <div className="campo combo" ref={caja}>
      <span>
        <label htmlFor={`${idLista}-in`}>Proveedor</label> {!requerido && <em>(opcional)</em>}
      </span>
      <input
        id={`${idLista}-in`}
        ref={input}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={abierto && total ? `${idLista}-${activo}` : undefined}
        autoComplete="off"
        placeholder="Buscá por nombre o CUIT"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setElegido(null);
          setAlta(null);
          setAbierto(true);
          setActivo(0);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => {
          // Si escribió el nombre exacto de uno de la lista, queda elegido.
          if (exacto && !elegido && !alta) elegir(exacto);
        }}
        onKeyDown={tecla}
      />
      {abierto && total > 0 && (
        <ul className="combo-lista" id={idLista} role="listbox">
          {lista.map((o, i) => (
            <li
              key={o.id}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activo}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => elegir(o)}
              onMouseEnter={() => setActivo(i)}
            >
              {o.nombre}
              {o.cuit && <small>{formatoCuit(o.cuit)}</small>}
            </li>
          ))}
          {puedeAgregar && (
            <li
              id={`${idLista}-${lista.length}`}
              role="option"
              aria-selected={activo === lista.length}
              className="combo-nuevo"
              onPointerDown={(e) => e.preventDefault()}
              onClick={agregar}
              onMouseEnter={() => setActivo(lista.length)}
            >
              + Agregar proveedor nuevo: «{texto.trim()}»
            </li>
          )}
        </ul>
      )}
      {elegido && <input type="hidden" name="proveedor_id" value={elegido.id} />}
      {elegido?.cuit && <span className="ayuda">CUIT {formatoCuit(elegido.cuit)}</span>}
      {alta && (
        <div className="combo-alta">
          <input type="hidden" name="proveedor_nuevo" value={alta.nombre} />
          <span className="ayuda">Proveedor nuevo: se agrega a la lista al guardar.</span>
          <input name="proveedor_cuit" aria-label="CUIT del proveedor nuevo" inputMode="numeric" placeholder="CUIT (opcional)" defaultValue={formatoCuit(alta.cuit)} />
        </div>
      )}
    </div>
  );
}
