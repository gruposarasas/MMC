-- Solo algunas marcas participan de la votación del stand más lindo.
alter table public.marcas add column en_votacion boolean not null default false;
update public.marcas set en_votacion = true where nombre in (
  'El Cafetín del Centro', 'VANTA ALFAJORES', 'Una Pausita Mendocina', 'Enebro Gluten Free', 'Vicentica',
  'Petit Patisserie', 'Cumbal', 'Chiamo', 'Monte Tienda de Café', 'Crudo', 'Shelby', 'Hefesto',
  'Pato Coffee', 'Manga', 'Alma Cacao', 'Macanudo', 'Duende Negro'
);
