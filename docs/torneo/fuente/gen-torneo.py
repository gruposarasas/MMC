import html
R1 = [
 ("10:30 – 11:00", [('Facundo Quiroga', ''), ('Facundo Lobos', 'Cake in Box'), ('Marcelo Ortega', 'Patio Café')]),
 ("11:00 – 11:30", [('Lian Yair Diaz', 'Only Barismo'), ('Joaquín Karlen', 'Hefesto'), ('Sol Perea', 'Una Pausita Mendocina')]),
 ("11:30 – 12:00", [('Juan Cenci', 'Club de Café'), ('Abril Zeballes', 'Macanudo'), ('Luciano Poblete', '')]),
 ("12:00 – 12:30", [('Jeremias Loyola', 'Chill'), ('Alan Vera', 'El Búho Coffice and Food'), ('Chiara Moyano', 'Hogaza by Erudito')]),
 ("12:30 – 13:00", [('Jerónimo Osorio', 'Shelby'), ('Melina', 'Modesto Alvear'), ('Ignacio López', 'HÜ Cueva de Café')]),
 None,
 ("17:00 – 17:30", [('Italo Siriani', 'Cumbal'), ('Valentino Alvarez', 'Petit Patisserie'), ('Valentina Esquivel', 'Virgen del Valle')]),
 ("17:30 – 18:00", [('Rosario Molina', ''), ('Nicolás Zaradnik', 'Hefesto'), ('Rodrigo Herrera', 'Pato Coffee')]),
 ("18:00 – 18:30", [('Bruno Fernandez', 'Shelby'), ('Priscila Muñoz', ''), ('Julieta Fernandez', 'White Shark')]),
 ("18:30 – 19:00", [('Gonzalo Encina', 'Chiamo'), ('Neyen Molina', 'Modesto Dalvian'), ('Daiana Oyola', 'Una Pausita Mendocina')]),
 ("19:00 – 19:30", [('Agustin Stubbia', 'Pato Coffee'), ('Agustín Benito', 'Pato Coffee'), ('Jonás Mesa', 'Patio')]),
]
e = html.escape
def celda(x):
    if x is None: return '<td class="vacia">—</td>'
    n,c = x
    return f'<td><b>{e(n)}</b>{f"<small>{e(c)}</small>" if c else ""}</td>'
filas1 = []
for f in R1:
    if f is None:
        filas1.append('<tr class="corte"><td colspan="4">Pausa · la competencia sigue a las 17:00</td></tr>'); continue
    h, xs = f
    filas1.append(f'<tr><th>{h}</th>{"".join(celda(x) for x in xs)}</tr>')
def pos(n, r): return f'<td class="pos"><b>{n}°</b><small>de la {r}</small></td>'
R2 = [("10:30 – 11:00",[1,16,10]),("11:00 – 11:30",[2,15,9]),("11:30 – 12:00",[3,14,8]),("12:00 – 12:30",[4,13,7]),("12:30 – 13:00",[5,12,None]),("13:00 – 13:30",[6,11,None])]
filas2 = [f'<tr><th>{h}</th>{"".join(pos(n,"Ronda 1") if n else "<td class=vacia>—</td>" for n in xs)}</tr>' for h,xs in R2]
R3 = [("17:00 – 17:30",[1,3,5]),("17:30 – 18:00",[2,4,6])]
filas3 = [f'<tr><th>{h}</th>{"".join(pos(n,"Ronda 2") for n in xs)}</tr>' for h,xs in R3]
open('/var/tmp/manual/torneo-filas.html','w').write('<!--R1-->'+''.join(filas1)+'<!--R2-->'+''.join(filas2)+'<!--R3-->'+''.join(filas3))
print('ok')
