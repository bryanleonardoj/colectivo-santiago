# Colectivo Santiago

Prototipo web de la aplicación de movilidad para taxis colectivos.
Proyecto Integrado TIHI43 — contraparte CONATACOCH.

Tres perfiles sobre una misma base de datos simulada: **pasajero**, **conductor**
y **administración**. Las líneas del prototipo son la `3012` y la `2012`, con
recorridos entre Peñalolén, La Florida, La Granja y La Pintana.

El pasajero no solo consulta dónde viene el colectivo: declara **cuántos van** y
**qué tiene que caber en el maletero** —nada, equipaje voluminoso, o su silla de
ruedas plegada. Con eso el sistema muestra únicamente los vehículos que de
verdad pueden parar por ellos.

---

## Cómo ejecutarlo

```bash
npm install
npm run dev
```

Luego abrir `http://localhost:5173/`. Las rutas son `/`, `/pasajero`,
`/conductor` y `/admin`.

Para generar la versión de producción:

```bash
npm run build     # deja el sitio en dist/
npm run preview   # lo sirve para revisarlo
npm test          # comprueba las reglas del núcleo, sin navegador
```

**Para ver la sincronización entre perfiles**, abrir `/pasajero`, `/conductor` y
`/admin` en tres pestañas del mismo navegador: al finalizar el turno en la
pestaña del conductor, su vehículo desaparece del mapa del pasajero y el
indicador "En turno" de administración baja en el acto.

**Para ver la regla de accesibilidad**, en `/pasajero` elegir *Mi silla de
ruedas* y pedir cupo; luego, en `/conductor`, cambiar el nivel del maletero en
la pestaña *Turno* y mirar la pestaña *Radar*: la solicitud aparece cuando el
maletero da para una silla y desaparece cuando se baja a equipaje o a nada.

El mapa usa Leaflet con cartografía de OpenStreetMap servida por CARTO, y pide
la geometría real de las calles a OSRM al cargar la página. Ninguno de los dos
necesita clave de API; si el servicio no responde, el recorrido cae de vuelta a
los puntos de paso definidos en `datos/lineas.js`. Para producción conviene un
proveedor de tiles con límites y atribución propios.

---

## Estructura

```
colectivo-santiago/
├── index.html              Punto de entrada de Vite
├── vite.config.js
├── public/                 Favicon e iconos
│
├── pruebas/
│   └── reglas.test.mjs     Pruebas del núcleo (npm test)
│
└── src/
    ├── main.jsx            Monta React y carga los estilos
    ├── App.jsx             Solo el enrutado
    ├── config.js           Constantes: tarifas, tiempos, límites
    │
    ├── datos/
    │   └── lineas.js       Líneas de colectivo, recorridos y flota
    │
    ├── nucleo/             Lógica independiente de la interfaz
    │   ├── util.js         Formato de moneda y hora, utilidades
    │   ├── geo.js          Distancias y posición sobre el recorrido
    │   ├── store.js        Estado compartido + publicación de cambios
    │   ├── api.js          Capa de datos: hoy simulada, mañana real
    │   └── ganchos.js      Puentes entre el store y React
    │
    ├── componentes/        Piezas reutilizables
    │   ├── NavegacionInferior.jsx
    │   ├── Mapa.jsx        Leaflet: rutas, vehículos y solicitudes de cupo
    │   ├── PedirCupo.jsx   Declarar acompañantes y qué va en el maletero
    │   └── Pago.jsx        Flujo de pago del pasajero
    │
    ├── paginas/            Una por perfil
    │   ├── Inicio.jsx
    │   ├── Pasajero.jsx
    │   ├── Conductor.jsx
    │   └── Admin.jsx
    │
    └── css/
        ├── tokens.css      Variables de color, tema claro y oscuro
        ├── base.css        Reset, tipografía y layout general
        ├── componentes.css Botones, tarjetas, píldoras, listas, overlays
        └── mapa.css        Contenedor del mapa y selector de líneas
```

---

## Cómo está organizado el código

**Las páginas no saben de dónde vienen los datos.** Piden todo a `api.js` y se
suscriben con los ganchos de `ganchos.js`. Cuando el proyecto pase de simulación
a backend real solo cambia `api.js`; ninguna página se toca.

**El movimiento de los vehículos es una función pura del tiempo.** `posicionDe()`
calcula dónde está un vehículo a partir del reloj, sin guardar estado. Por eso
tres pestañas abiertas muestran exactamente lo mismo sin necesidad de
sincronizarse entre ellas.

**Lo que sí es estado compartido** —turnos, asientos, avisos y pagos— vive en
`store.js`, que lo persiste en `localStorage` y avisa a las otras pestañas con
`BroadcastChannel`. Ese mecanismo cumple el mismo rol que tendrán los listeners
en tiempo real del backend definitivo.

**El CSS está separado por responsabilidad**, no por página: los tokens definen
el sistema de diseño, `componentes.css` lo aplica y cada página solo compone.

---

## La regla de las solicitudes de cupo

Cuando alguien pide cupo declara dos cosas: cuántos van y qué tiene que caber en
el maletero. Eso se convierte en una sola regla, `puedeTomar()` en
`nucleo/api.js`, que decide si un vehículo califica.

**Una solicitud no se dibuja en el mapa de un conductor que no puede tomarla.**

La silla de ruedas **es del pasajero** y viaja plegada en el maletero. No es una
prestación aparte que el conductor ofrezca, sino el tamaño más grande que se le
puede pedir al mismo espacio, así que los niveles se comparan en vez de
combinarse:

| Nivel | El pasajero necesita | El vehículo califica si su maletero es… |
|---|---|---|
| 0 · `no` | nada que guardar | cualquiera |
| 1 · `equipaje` | una maleta o bulto grande | `equipaje` o `silla` |
| 2 · `silla` | guardar su silla de ruedas | `silla` |

Donde cabe una silla cabe también una maleta, por eso basta con que el nivel del
vehículo sea mayor o igual al de la solicitud. Junto con los asientos libres,
son las dos únicas condiciones del sistema.

El conductor **no acepta ni rechaza nada**: elige el nivel de su maletero cuando
quiera, sin ningún compromiso, y bajarlo solo hace que esas solicitudes dejen de
aparecerle. Como nunca las vio, el pasajero tampoco ve un rechazo — solo ve
cuántos colectivos podrían tomarlo.

Del mismo modo no hay botón de "voy en camino": cuando un vehículo apto queda a
menos de `REVELAR_PATENTE_MIN` minutos, el pasajero pasa a ver su patente. El
conductor no toca la pantalla; le basta con manejar.

Esto es lo que sostiene el diseño de la pantalla bloqueada: si el conductor no
puede desbloquear el teléfono para contar pasajeros, tampoco va a poder hacerlo
para aceptar viajes. Por eso el nivel del maletero también se cambia ahí.

---

## De prototipo a producción

| Pieza del prototipo | Reemplazo en producción |
|---|---|
| `componentes/Mapa.jsx` (Leaflet + OSM) | Google Maps SDK o Mapbox GL |
| `nucleo/api.js` (simulación) | REST sobre PostgreSQL + listeners de Firestore |
| `nucleo/store.js` (BroadcastChannel) | Suscripciones en tiempo real del backend |
| `componentes/Pago.jsx` (pago simulado) | Webpay Plus, ambiente de integración de Transbank |
| Páginas de React DOM | Pantallas de React Native con Expo |

La separación entre datos, núcleo, componentes y páginas se mantiene igual en la
app móvil: cambia la capa de presentación, no la lógica.

---

## Modelo de datos

**Relacional** (integridad referencial, consultas con relaciones):
`usuarios`, `conductores`, `vehiculos`, `lineas`, `paradas`, `viajes`, `pagos`.

**No relacional** (alta frecuencia, esquema flexible, lectura por suscripción):
`posiciones`, `estado_asientos`, `avisos`, `solicitudes`.

Las `solicitudes` son el caso de libro para la parte no relacional: nacen y
mueren en minutos, se leen por suscripción y su esquema va a cambiar cada vez
que se agregue un tipo de necesidad. El maletero que ofrece un vehículo, en cambio,
es un atributo suyo y vive junto a `vehiculos` en la parte relacional.

Esta separación es la que se argumenta en el informe de diagnóstico.

---

## Requisitos cubiertos por el prototipo

| Requisito | Dónde se ve |
|---|---|
| RF-01 · El pasajero ve solo vehículos con posición vigente | `api.vehiculosActivos()` |
| RF-02 · El pasajero pide cupo declarando su necesidad | `componentes/PedirCupo.jsx` |
| RF-07 · El conductor declara qué da su maletero | `api.fijarMaletero()` |
| RF-05 · El conductor abre y cierra su turno | Perfil conductor, pestaña *Turno* |
| RF-06 · El conductor declara la ocupación | Control rápido de pasajeros |
| RF-07 / RF-08 · Pago y comprobante | `componentes/Pago.jsx` |
| RF-09 · La dirigencia difunde avisos | Perfil administración, pestaña *Avisos* |
| Accesibilidad · Espacio de maletero por tamaño | `api.puedeTomar()` + nivel declarado por el conductor |
| S4 · Privacidad de la posición | Fuera de turno el vehículo desaparece del mapa |
| S5 · Privacidad del pasajero | El conductor ve la necesidad, nunca la identidad |

Todo lo de esta tabla que es lógica —no interfaz— está cubierto por `npm test`.
