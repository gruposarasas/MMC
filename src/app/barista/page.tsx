import { redirect } from 'next/navigation';

// El panel de cada barista ahora está en /baristas.
export default function Barista() {
  redirect('/baristas');
}
