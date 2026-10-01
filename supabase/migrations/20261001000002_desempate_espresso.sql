-- Desempate del torneo de baristas: a igual puntaje, pasa el de mejor puntaje en el espresso.
-- Si también empatan en el espresso, decide el jurado (columna desempate).
alter table public.puntajes add column espresso numeric(3,1) check (espresso between 1 and 9);
