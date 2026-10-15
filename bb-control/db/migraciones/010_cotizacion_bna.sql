-- Compras y gastos en dólares con el dólar BNA: mientras no se pagan, la cotización se actualiza con el BNA de cada
-- día; al pagarse queda la del día del pago.
alter table egresos add column cotizacion_auto boolean not null default false;
create index egresos_cotizacion_auto on egresos (id) where cotizacion_auto and not pagado and moneda = 'USD';
