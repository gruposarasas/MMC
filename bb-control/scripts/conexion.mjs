// Lee DATABASE_URL a mano (no con URL()) para aceptar contraseñas con @ # / ? sin codificar,
// y explica en castellano los errores de conexión más comunes. Lo usan la app y migrar.mjs.

const dec = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Opciones de conexión para `postgres` a partir de DATABASE_URL. Tira un Error con la explicación si no sirve. */
export function opcionesConexion(url) {
  const u = (url || '').trim();
  if (!u) throw new Error('Falta la variable DATABASE_URL.');
  if (/\[YOUR-PASSWORD\]|\[[^\]]*PASSWORD[^\]]*\]/i.test(u))
    throw new Error('DATABASE_URL todavía tiene [YOUR-PASSWORD]: reemplazalo por la contraseña de la base, sin corchetes.');
  // usuario:contraseña@host:puerto/base?parametros — la contraseña es todo hasta la ÚLTIMA @.
  const m = u.match(/^postgres(?:ql)?:\/\/([^:@/]+)(?::(.*))?@([^@/:?#]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?(.*))?$/);
  if (!m) throw new Error('DATABASE_URL no tiene la forma postgresql://usuario:contraseña@host:puerto/postgres');
  const [, usuario, clave, host, puerto, base, query] = m;
  const params = new URLSearchParams(query || '');
  const modo = params.get('sslmode');
  const ssl = modo ? (modo === 'disable' ? false : 'require') : /supabase\.(co|com)$/i.test(host) ? 'require' : false;
  return { host, port: Number(puerto || 5432), database: dec(base || 'postgres'), username: dec(usuario), password: dec(clave || ''), ssl };
}

/** Datos para el log, sin la contraseña. */
export const describirConexion = (o) => `${o.username}@${o.host}:${o.port}/${o.database}${o.ssl ? ' (SSL)' : ''}`;

/** Explicación de un error de conexión, para los logs. */
export function explicarError(e) {
  const msg = String(e?.message || e);
  const code = e?.code || '';
  if (code === '28P01' || /password authentication failed/i.test(msg))
    return 'La contraseña de la base no es correcta. En Supabase: Project Settings → Database → Reset database password, y actualizá DATABASE_URL.';
  if (/tenant or user not found/i.test(msg))
    return 'El pooler no reconoce el usuario: tiene que ser postgres.<ref-del-proyecto> y el host el del pooler (aws-…-sa-east-1.pooler.supabase.com), copiados de Supabase → Connect → Session pooler.';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `No se encuentra el servidor "${e?.hostname || ''}". Revisá el host de DATABASE_URL.`;
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'CONNECT_TIMEOUT'].includes(code))
    return 'No se pudo conectar. Si usaste la conexión directa (db.xxx.supabase.co, solo IPv6), cambiala por la del Session pooler.';
  return msg;
}
