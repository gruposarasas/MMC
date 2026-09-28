'use client';

/** Imprime solo el elemento indicado. */
export function Imprimir({ id, texto, className = 'link' }: { id: string; texto: string; className?: string }) {
  return (
    <button
      className={className}
      style={className === 'link' ? { justifySelf: 'start' } : undefined}
      onClick={() => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('objetivo');
        document.body.classList.add('imprimiendo');
        const fin = () => {
          el.classList.remove('objetivo');
          document.body.classList.remove('imprimiendo');
          window.removeEventListener('afterprint', fin);
        };
        window.addEventListener('afterprint', fin);
        window.print();
        setTimeout(fin, 1000);
      }}
    >
      {texto}
    </button>
  );
}
