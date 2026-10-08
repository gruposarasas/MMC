import json
reg_hora={"03":{0:43,1:7,2:10,3:1,4:3,6:1,7:6,8:13,9:25,10:60,11:117,12:107,13:91,14:73,15:35,16:51,17:176,18:152,19:118,20:49,21:11,22:15,23:13},
          "04":{0:3,1:9,2:1,4:1,7:1,9:11,10:68,11:97,12:43,13:30,14:28,15:47,16:67,17:134,18:160,19:69,20:14,22:1,23:1}}
edades=[("13–17",106),("18–24",671),("25–34",823),("35–44",406),("45–54",337),("55+",213)]
por_dia=[("Antes del evento<br><small>28/9 al 2/10</small>",588),("Sábado 3",1177),("Domingo 4",785),("Después<br><small>5/10</small>",6)]
marcas=[("Pato Coffee","50% OFF en la segunda bebida","En tu primera compra",98,98),("Chiamo","20% OFF","Pagando en efectivo",49,49),("Macanudo","2x1 en budín + café","Con cualquier compra",47,47),("Carpediem","10% extra","Efectivo / transferencia",24,24),("Enebro Gluten Free","10% off efectivo","",12,12),("Vanta Alfajores","10% off","En todos los alfajores",12,12),("Cumbal","10% en cuartos de café","",11,11),("Una Pausita Mendocina","10% off en especiales fríos","Mínimo de compra $10.000",9,9),("Vicentica","10% off en sándwich serrano","Hasta 10 usos",7,6),("La Cabaña Chocolates","20% off","En el total de la compra",6,6),("Monte Tienda de Café","25% descuento","Accesorios de barista",6,6),("Marian Estudio","10% en cuadernos A5","Efectivo / transferencia",2,2),("Bruno Brown","4x3 en ¼ de café","Llevás 4 cuartos y pagás 3",1,1),("Belén Berti Tattoo","1 mini por 35 mil o 2 por 50 mil","",0,0),("Chefsitos","2 talleres x $11.000","Promo amigos",0,0),("Manga","20% off","",0,0),("Mates Marcán","5% off en mates","",0,0),("Petit Patisserie","10% off","Abonando en efectivo",0,0),("Tercer Mundo","20% OFF en remeras personalizadas","2 usos",0,0)]
stand=[("Pato Coffee",152),("El Cafetín del Centro",116),("Manga",71),("Enebro Gluten Free",70),("Hefesto",69),("Shelby",63),("Vicentica",36),("Cumbal",28),("Chiamo",19),("Macanudo",19),("Petit Patisserie",17),("Duende Negro",16),("Una Pausita Mendocina",15),("Monte Tienda de Café",12),("Crudo",9),("Alma Cacao",5),("Vanta Alfajores",5)]
bar=[("Julieta Fernandez","White Shark",176,247),("Rodrigo Herrera","Pato Coffee",160,140),("Melina","Modesto Alvear",119,232),("Neyen Molina","Modesto Dalvian",77,70),("Facundo Lobos","Cake in Box",74,63),("Jonás Mesa","Patio",65,56),("Italo Siriani","Cumbal",60,46),("Jerónimo Osorio","Shelby",52,33),("Valentina Esquivel","Virgen del Valle",51,40),("Bruno Fernandez","Shelby",33,17),("Valentino Alvarez","Petit Patisserie",31,22),("Chiara Moyano","Hogaza by Erudito",26,28)]
r1=[[1,"Jerónimo Osorio","Shelby",8.1,7,0.9],[2,"Agustín Benito","Pato Coffee",8.1,6.6,0.9],[3,"Rosario Molina","",7.9,6.6,0.8],[4,"Rodrigo Herrera","Pato Coffee",7.8,6.5,0.8],[5,"Marcelo Ortega","Patio Café",7.7,6.8,0.8],[6,"Chiara Moyano","Hogaza by Erudito",7.7,6,0.8],[7,"Agustin Stubbia","Pato Coffee",7.6,6.1,0.9],[8,"Melina","Modesto Alvear",7.5,6.2,0.9],[9,"Valentina Esquivel","Virgen del Valle",7.4,6.2,1],[10,"Luciano Poblete","",7.4,5.8,0.7],[11,"Jonás Mesa","Patio",7.4,5.2,1],[12,"Valentino Alvarez","Petit Patisserie",7.3,6.1,0.9],[13,"Gonzalo Encina","Chiamo",7.3,4.7,0.9],[14,"Alan Vera","El Búho Coffice and Food",7.2,6,0.8],[15,"Juan Cenci","Club de Café",7.2,5.2,0.8],[16,"Abril Zeballes","Macanudo",7,6.2,0.8],[17,"Daiana Oyola","Una Pausita Mendocina",7,4.4,1],[18,"Italo Siriani","Cumbal",6.9,5,0.8],[19,"Lian Yair Diaz","Only Barismo",6.9,4.3,0.8],[20,"Facundo Lobos","Cake in Box",6.8,4.8,0.8],[21,"Bruno Fernandez","Shelby",6.6,4.2,0.8],[22,"Nicolás Zaradnik","Hefesto",6.5,4.8,0.8],[23,"Facundo Quiroga","",6.4,4.2,0.8],[24,"Priscila Muñoz","",6.3,4.9,0.6],[25,"Neyen Molina","Modesto Dalvian",6.2,4.3,0.9],[26,"Julieta Fernandez","White Shark",6.1,3.8,0.9],[27,"Joaquín Karlen","Hefesto",6,3.9,0.7],[28,"Jeremias Loyola","Chill",5.9,3.3,0.8],[29,"Sol Perea","Una Pausita Mendocina",4.8,5.2,0.8],[30,"Ignacio López","HÜ Cueva de Café",4,5.3,0.8]]
r2=[[1,"Jonás Mesa","Patio",8.4,6.6,1],[2,"Jerónimo Osorio","Shelby",8.2,6.6,0.9],[3,"Agustín Benito","Pato Coffee",7.9,6.3,1],[4,"Juan Cenci","Club de Café",7.9,6.2,1],[5,"Agustin Stubbia","Pato Coffee",7.9,6.2,1],[6,"Marcelo Ortega","Patio Café",7.8,6.2,0.9],[7,"Abril Zeballes","Macanudo",7.6,6,1],[8,"Melina","Modesto Alvear",7.5,6.8,0.9],[9,"Chiara Moyano","Hogaza by Erudito",7.4,5.8,0.9],[10,"Alan Vera","El Búho Coffice and Food",7.4,5.7,0.9],[11,"Rosario Molina","",7.3,4.8,1],[12,"Gonzalo Encina","Chiamo",7.2,4.8,1],[13,"Luciano Poblete","",7.1,5,1],[14,"Rodrigo Herrera","Pato Coffee",7,5.3,0.8],[15,"Valentino Alvarez","Petit Patisserie",7,5,1],[16,"Valentina Esquivel","Virgen del Valle",6.9,5.3,1]]
r3=[[1,"Jerónimo Osorio","Shelby",8.8,7.1,0.9],[2,"Jonás Mesa","Patio",8.1,7.0,0.9],[3,"Agustin Stubbia","Pato Coffee",8.1,6.4,1],[4,"Marcelo Ortega","Patio Café",8.1,6.4,0.9],[5,"Juan Cenci","Club de Café",8.1,5.0,1],[6,"Agustín Benito","Pato Coffee",7.7,6.3,0.9]]

f=lambda x:(f"{x:.1f}").replace('.',',')
n=lambda x:f"{x:,}".replace(',','.')
CAB='<div class="cab"><img src="rec/logoOsc.png" alt=""><span>Informe de la app · 4ta edición</span></div>'
pg=[2]
def pie():
    s=f'<div class="pie"><span class="lg"><img src="rec/bplum.png" alt="Bruno Brown"><i></i><img src="rec/gpos.png" alt="Godoy Cruz"></span><span>Mundial de Café · Informe de la app · {pg[0]}</span></div>'
    pg[0]+=1; return s

def barras_v(d, alto=34, maxv=None):
    maxv=maxv or max(d.values())
    out='<div class="vb">'
    for h in range(8,24):
        v=d.get(h,0); hh=v/maxv*alto
        lab=f'<em>{v}</em>' if v==max(d.values()) else ''
        out+=f'<div class="c"><div class="b" style="height:{hh:.1f}mm">{lab}</div><span>{h}</span></div>'
    return out+'</div>'
def barras_h(rows, w=100, cls=''):
    maxv=max(v for _,v in rows); out=f'<div class="hb {cls}">'
    for k,v in rows:
        out+=f'<div class="r"><span class="k">{k}</span><div class="t"><div class="b" style="width:{v/maxv*w:.1f}%"></div><em>{n(v)}</em></div></div>'
    return out+'</div>'
def tabla_r(rows, pasan):
    s='<table class="t rk"><thead><tr><th>#</th><th>Barista</th><th>Cafetería</th><th class="n">Puntaje</th><th class="n">Espresso</th><th class="n">Ficha</th></tr></thead><tbody>'
    for p,nom,caf,pu,es,fi in rows:
        c=' class="pasa"' if p<=pasan else ''
        s+=f'<tr{c}><td>{p}</td><td><b>{nom}</b></td><td>{caf or "—"}</td><td class="n"><b>{f(pu)}</b></td><td class="n">{f(es)}</td><td class="n">{f(fi)}</td></tr>'
    return s+'</tbody></table>'

H=open('/var/tmp/manual/informe/tpl.html').read()
tot_reg=2556
body=f'''
<section class="hoja tapa">
  <img class="deco" src="rec/ic_copa.png" style="width:78mm;right:-12mm;top:22mm">
  <img class="deco" src="rec/ic_grano.png" style="width:40mm;right:26mm;top:150mm">
  <img class="logo" src="rec/logo.png" alt="Mundial de Café by Bruno Brown">
  <span class="ed">4ta edición</span>
  <div class="kicker">Informe final</div>
  <h1>La app del Mundial de Café</h1>
  <p class="bajada">Todo lo que pasó en mmc.saraimagineers.com: visitantes, cupones, votaciones, torneo de baristas y sorteo.</p>
  <div class="datos">
    <div><b>Sábado 3 y domingo 4</b>de octubre de 2026</div>
    <div><b>Bodega Arizu</b>Godoy Cruz, Mendoza</div>
    <div><b>{n(tot_reg)}</b>visitantes registrados</div>
  </div>
  <div class="lgs"><img src="rec/bcrema.png" alt="Bruno Brown"><i></i><img src="rec/gneg.png" alt="Godoy Cruz"></div>
  <img class="guarda" src="rec/guarda.png" alt="">
</section>

<section class="hoja">{CAB}
  <span class="sec">1 · Resumen</span>
  <h2>La app en números</h2>
  <p class="sub">Datos tomados de la base de la app al cierre del evento.</p>
  <div class="grande"><img src="rec/ic_estrella.png" alt=""><div class="n">{n(tot_reg)}</div><div class="d"><b>visitantes registrados</b>con su billetera de cupones</div></div>
  <div class="stats">
    <div class="stat"><div class="n">284</div><div class="d"><b>Cupones canjeados</b>en 13 marcas</div></div>
    <div class="stat"><div class="n">254</div><div class="d"><b>Personas usaron un cupón</b>10% de los registrados</div></div>
    <div class="stat"><div class="n">19</div><div class="d"><b>Cupones publicados</b>de 37 marcas cargadas</div></div>
    <div class="stat"><div class="n">1.124</div><div class="d"><b>Votos al barista favorito</b></div></div>
    <div class="stat"><div class="n">722</div><div class="d"><b>Votos al stand más lindo</b>entre 17 stands</div></div>
    <div class="stat"><div class="n">1.204</div><div class="d"><b>Mensajes de aliento</b>a los baristas</div></div>
    <div class="stat v"><div class="n">400</div><div class="d"><b>Presentes en el sorteo</b>de la camiseta de Enzo</div></div>
    <div class="stat v"><div class="n">30</div><div class="d"><b>Baristas en la app</b>con perfil y clave propia</div></div>
    <div class="stat v"><div class="n">81%</div><div class="d"><b>Aceptó recibir novedades</b>2.080 personas</div></div>
  </div>
  {pie()}
</section>

<section class="hoja">{CAB}
  <span class="sec">2 · Visitantes</span>
  <h2>Quiénes se registraron</h2>
  <div class="dos" style="gap:6mm">
    <div class="caja"><h3>Registros por día</h3>{barras_h(por_dia)}</div>
    <div class="caja"><h3>Edades (al 3 de octubre)</h3>{barras_h(edades, cls='eda')}</div>
  </div>
  <div class="caja" style="margin-top:4mm"><h3>Registros por hora · sábado 3</h3>{barras_v(reg_hora["03"],maxv=176)}
  <h3 style="margin-top:3mm">Registros por hora · domingo 4</h3>{barras_v(reg_hora["04"],maxv=176)}
  <p class="mini">Hora de Mendoza. Los picos fueron entre las 17 y las 19 los dos días. La mitad del público tiene entre 18 y 34 años.</p></div>
  <div class="caja" style="margin-top:4mm;display:grid;grid-template-columns:70mm 1fr;gap:6mm;align-items:center"><div><h3>Cómo dejaron su contacto</h3>
      <div class="split" style="margin:0"><div style="flex:1454"><b>1.454</b>WhatsApp · 57%</div><div style="flex:1102"><b>1.102</b>Mail · 43%</div></div></div>
      <p class="mini" style="margin:0">El contacto sirve para recuperar la billetera y para avisar de la próxima edición: 2.080 personas (81%) aceptaron recibir novedades.</p></div>
  {pie()}
</section>

<section class="hoja">{CAB}
  <span class="sec">3 · Cupones</span>
  <h2>Beneficios y canjes por marca</h2>
  <p class="sub" style="margin-bottom:3mm">284 canjes: 135 el sábado y 149 el domingo. No hubo canjes en sucursales después del evento.</p>
  <table class="t"><thead><tr><th>Marca</th><th>Beneficio</th><th>Condiciones</th><th class="n">Canjes</th></tr></thead><tbody>
  {''.join(f'<tr><td><b>{m}</b></td><td>{b}</td><td>{c or "—"}</td><td class="n"><b>{k}</b></td></tr>' for m,b,c,k,p in marcas)}
  </tbody></table>
  <p class="mini">Marcas cargadas que no publicaron cupón: Alma Cacao, Atellier de Café, Banquetes Suárez, Cata Internacional, Chocolates Hipólito, Cono Creps, Crudo, Duende Negro, El Cafetín del Centro, Hefesto, Helados Verde Pistacchio, India &amp; Co., Pepper Truck, Pintao Pins, Reserva del Sol, Shelby, Tregar y Waggon.</p>
  {pie()}
</section>

<section class="hoja">{CAB}
  <span class="sec">4 · Votaciones del público</span>
  <h2>Stand más lindo</h2>
  <div class="gan"><img src="rec/ic_copa.png" alt=""><div><span>Ganador · 152 votos</span><b>Pato Coffee</b></div></div>
  {barras_h(stand, cls='st')}
  <h2 style="margin-top:7mm">Barista favorito del público</h2>
  <div class="gan"><img src="rec/ic_copa.png" alt=""><div><span>Ganadora · 176 votos y 247 mensajes de aliento</span><b>Julieta Fernandez</b></div></div>
  <table class="t"><thead><tr><th>#</th><th>Barista</th><th>Cafetería</th><th class="n">Votos</th><th class="n">Mensajes</th></tr></thead><tbody>
  {''.join(f'<tr><td>{i+1}</td><td><b>{a}</b></td><td>{c}</td><td class="n"><b>{v}</b></td><td class="n">{m}</td></tr>' for i,(a,c,v,m) in enumerate(bar[:8]))}
  </tbody></table>
  <p class="mini">Se votó una vez por visitante, hasta el domingo 4 a las 20 hs. Se muestran los 8 baristas más votados de 30.</p>
  {pie()}
</section>

<section class="hoja">{CAB}
  <span class="sec">5 · Torneo de baristas</span>
  <h2>La final y la Ronda 3</h2>
  <div class="final">
    <div class="jug gan2"><img src="rec/ic_copa.png" alt=""><div class="r">Campeón</div><div class="nom">Jerónimo Osorio</div><div class="pt">8,3</div><div class="r">Shelby</div></div>
    <div class="vs">VS</div>
    <div class="jug"><div class="r">Subcampeón</div><div class="nom">Jonás Mesa</div><div class="pt">8,0</div><div class="r">Patio</div></div>
  </div>
  <div class="podio"><div><b>3°</b> Agustin Stubbia <small>Pato Coffee</small></div><div><b>4°</b> Marcelo Ortega <small>Patio Café</small></div></div>
  <h3 class="tt">Ronda 3 · domingo 17:00 y 17:45 · pasan 2</h3>
  {tabla_r(r3,2)}
  <p class="mini">Puntaje = promedio de los 3 jurados (espresso, flat white y bebida de autor) − descuentos de los fiscales + ficha técnica (0 a 1). En la Ronda 3, Stubbia, Ortega y Cenci empataron en 8,1 con Mesa; se desempató por el puntaje del espresso.</p>
  <h3 class="tt">Ronda 2 · domingo de 10:30 a 13:30 · pasan 6</h3>
  {tabla_r(r2,6)}
  {pie()}
</section>

<section class="hoja">{CAB}
  <span class="sec">5 · Torneo de baristas</span>
  <h2>Ronda 1 · sábado 3</h2>
  <p class="sub" style="margin-bottom:2mm">30 baristas, de 10:30 a 13 y de 17 a 19:30. Pasaron 16.</p>
  {tabla_r(r1,16)}
  {pie()}
</section>

<section class="hoja">{CAB}
  <span class="sec">6 · Sorteo</span>
  <h2>La camiseta de Enzo</h2>
  <div class="dos">
    <div class="caja"><h3>Cómo fue</h3><p>Todos los registrados podían participar. El domingo 4, de 18 a 20 hs, tocaron "Estoy presente" en su billetera: se anotaron <b>400 personas</b>. El ganador lo eligió el servidor al azar entre todos los presentes y se proyectó con la ruleta de <b>/sorteo</b>. Para llevarse el premio había que mostrar el DNI.</p></div>
    <div class="caja"><h3>Sorteos del domingo 4</h3>
      <ol class="sor"><li><b>Micol Vanini</b><span>18:19 hs</span></li><li><b>Lucas Vidal</b><span>18:19 hs</span></li><li><b>Octavio Garcia Narvaez</b><span>18:51 hs</span></li></ol>
      <p class="mini">Si el ganador no aparecía, se volvía a sortear entre los mismos presentes. Los sorteos anteriores al domingo fueron pruebas.</p></div>
  </div>
  <span class="sec" style="margin-top:9mm">7 · Cómo funcionó</span>
  <h2>Qué tenía la app</h2>
  <table class="t"><thead><tr><th>Pantalla</th><th>Para quién</th><th>Qué hacía</th></tr></thead><tbody>
  <tr><td><b>Registro y billetera</b></td><td>Visitantes</td><td>Registro con mail o WhatsApp, cupones de las marcas, acceso al sorteo, votaciones, mapa y competencia en vivo.</td></tr>
  <tr><td><b>Canje</b></td><td>Visitantes y cajeros</td><td>Código de caja de 4 números y pantalla "Canje válido" con hora en movimiento.</td></tr>
  <tr><td><b>Panel de marca</b></td><td>Marcas</td><td>Cada marca cargó su beneficio, condiciones, usos y sucursales, y vio sus canjes.</td></tr>
  <tr><td><b>Back office</b></td><td>Organización</td><td>Resumen, marcas, visitantes (CSV), canjes, votos y carteles para imprimir.</td></tr>
  <tr><td><b>Torneo</b></td><td>Baristas, jurados y público</td><td>Perfil de cada barista, planillas de los 3 jurados, puntajes automáticos y pantalla /competencia.</td></tr>
  <tr><td><b>Sorteo</b></td><td>Organización</td><td>Pantalla para proyectar con los presentes en vivo y la ruleta.</td></tr>
  </tbody></table>
  {pie()}
</section>
'''
open('/var/tmp/manual/informe.html','w').write(H.replace('<!--BODY-->',body))
