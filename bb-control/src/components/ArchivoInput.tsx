'use client';

/** Elige una foto o PDF. Las fotos se achican en el celular antes de subirlas. */
export function ArchivoInput({ name, required }: { name: string; required?: boolean }) {
  async function achicar(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f || !f.type.startsWith('image/') || f.size < 900_000) return;
    try {
      const bmp = await createImageBitmap(f);
      const escala = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * escala);
      c.height = Math.round(bmp.height * escala);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82));
      if (!blob) return;
      const dt = new DataTransfer();
      dt.items.add(new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
      input.files = dt.files;
    } catch {
      // Si el navegador no puede, se sube tal cual.
    }
  }
  return <input type="file" name={name} accept="image/*,application/pdf" required={required} onChange={(e) => achicar(e.currentTarget)} />;
}
