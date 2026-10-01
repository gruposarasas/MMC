-- El puntaje del torneo de baristas va de 1 a 9, con un decimal.
alter table public.puntajes drop constraint if exists puntajes_puntaje_check;
alter table public.puntajes add constraint puntajes_puntaje_check check (puntaje between 1 and 9);
