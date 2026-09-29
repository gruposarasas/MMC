import { redirect } from 'next/navigation';

// La pantalla del sorteo vive en /sorteo (link corto para proyectar).
export default function AdminSorteo() {
  redirect('/sorteo');
}
