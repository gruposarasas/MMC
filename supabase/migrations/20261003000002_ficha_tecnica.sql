-- Ficha técnica: de 0 a 1 (con un decimal) que se suma al puntaje final de la ronda.
-- Con la ficha, el puntaje final puede llegar a 10.
alter table public.puntajes add column ficha numeric(2,1) not null default 0 check (ficha between 0 and 1);
alter table public.puntajes drop constraint if exists puntajes_puntaje_check;
alter table public.puntajes add constraint puntajes_puntaje_check check (puntaje between 1 and 10);
