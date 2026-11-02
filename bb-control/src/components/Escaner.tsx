'use client';
import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

// Lee el QR de la pantalla del lugar con la cámara trasera (jsQR: anda en Android y en iPhone). Adaptado de Sara.
export function Escaner({ onLeido, onCerrar }: { onLeido: (texto: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const leido = useRef(onLeido);
  useEffect(() => { leido.current = onLeido; }, [onLeido]);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let cuadro = 0;
    let terminado = false;
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    const leer = () => {
      if (terminado) return;
      const v = video.current;
      if (v && ctx && v.readyState >= 2 && v.videoWidth) {
        const escala = Math.min(1, 640 / v.videoWidth);
        lienzo.width = Math.round(v.videoWidth * escala);
        lienzo.height = Math.round(v.videoHeight * escala);
        ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
        const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
        const codigo = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (codigo?.data) {
          if (codigo.data.startsWith('BB|')) {
            terminado = true;
            navigator.vibrate?.(80);
            leido.current(codigo.data);
            return;
          }
          setAviso('Ese no es el QR de fichaje. Apuntá al de la pantalla del lugar.');
        }
      }
      cuadro = requestAnimationFrame(leer);
    };
    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (terminado) { flujo.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!;
        v.srcObject = flujo;
        await v.play().catch(() => {});
        cuadro = requestAnimationFrame(leer);
      } catch (e) {
        setError((e as { name?: string }).name === 'NotAllowedError'
          ? 'Permití el uso de la cámara para escanear el QR. Se usa solo para leer el código.'
          : 'No se pudo abrir la cámara. Cerrá otras apps que la estén usando y probá de nuevo.');
      }
    })();
    return () => {
      terminado = true;
      cancelAnimationFrame(cuadro);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="escaner" role="dialog" aria-label="Escanear el QR">
      <p>Apuntá al QR de la pantalla</p>
      <div className="visor">
        <video ref={video} playsInline muted />
        <span className="marco" />
      </div>
      {(error || aviso) && <p role="alert" className="escaner-aviso">{error ?? aviso}</p>}
      <button className="btn claro" style={{ marginTop: 16 }} onClick={onCerrar}>Cancelar</button>
    </div>
  );
}
