import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import * as api from '../nucleo/api.js';
import { cssVar } from '../nucleo/util.js';
import { describir } from './PedirCupo.jsx';
import { CONFIG } from '../config.js';

/** Color de cada recorrido sobre la cartografía oscura. */
const COLOR_RUTA = { 3012: '#ff8a65', 2012: '#4de1b5' };

const colorDe = (linea) => COLOR_RUTA[linea.id] || cssVar(linea.color);

/** Traslada al mapa los toques del usuario para mover su punto de espera. */
function CapturarToque({ onMove }) {
  useMapEvents({ click: (evento) => onMove([evento.latlng.lat, evento.latlng.lng]) });
  return null;
}

/**
 * Encuadra el mapa sobre un conjunto de puntos.
 * El pasajero encuadra los recorridos completos; el conductor encuadra solo
 * su vehículo y lo que tiene por delante, que es lo que le interesa mirar.
 */
function Encuadrar({ puntos }) {
  const mapa = useMap();
  const firma = JSON.stringify(puntos);
  useEffect(() => {
    if (puntos.length) mapa.fitBounds(puntos, { padding: [28, 28], maxZoom: 15 });
    // La firma evita reencuadrar en cada repintado con los mismos puntos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, firma]);
  return null;
}

/** Centra el mapa en el punto de espera del pasajero. */
function CentrarPasajero({ punto }) {
  const mapa = useMap();
  useEffect(() => {
    mapa.flyTo(punto, Math.max(mapa.getZoom(), 13), { duration: 0.45 });
  }, [mapa, punto]);
  return null;
}

/** Recorrido de una línea: borde blanco + trazo de color + puntos de paso. */
function Recorrido({ linea, activa }) {
  const color = colorDe(linea);
  return (
    <>
      <Polyline
        positions={linea.recorrido}
        interactive={false}
        pathOptions={{ color: '#ffffff', weight: activa ? 10 : 6, opacity: activa ? 0.9 : 0.45, lineCap: 'round', lineJoin: 'round' }}
      />
      <Polyline
        positions={linea.recorrido}
        interactive={false}
        pathOptions={{ color, weight: activa ? 5 : 2.5, opacity: activa ? 1 : 0.35, lineCap: 'round', lineJoin: 'round' }}
      />
      {activa && linea.puntosPaso.map((parada, i) => (
        <CircleMarker
          key={`${linea.id}-parada-${i}`}
          center={parada}
          radius={3}
          interactive={false}
          pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: color, fillOpacity: 1 }}
        />
      ))}
    </>
  );
}

/** Un colectivo en marcha: halo tenue y punto sólido, más grande si está elegido. */
function Vehiculo({ vehiculo, activo, onSelect }) {
  const color = cssVar(api.obtenerLinea(vehiculo.linea).color);
  return (
    <>
      <CircleMarker
        center={vehiculo.posicion}
        radius={activo ? 15 : 11}
        pathOptions={{ color, weight: 2, opacity: 0.35, fillColor: color, fillOpacity: 0.22 }}
      />
      <CircleMarker
        center={vehiculo.posicion}
        radius={activo ? 9 : 7}
        eventHandlers={onSelect ? {
          click: (evento) => {
            evento.originalEvent.stopPropagation();
            onSelect(vehiculo.id);
          },
        } : undefined}
        pathOptions={{ color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 }}
      >
        <Tooltip direction="top" offset={[0, -10]}>
          {vehiculo.linea} · {vehiculo.patente}
        </Tooltip>
      </CircleMarker>
    </>
  );
}

/**
 * Chincheta de una solicitud de cupo sobre el mapa del conductor.
 *
 * El símbolo dice de un vistazo qué hay que guardar: la silla de ruedas del
 * pasajero, un bulto, o nada, en cuyo caso se muestra cuántos van. Se dibuja
 * con `divIcon` en vez de un círculo porque acá el símbolo ES la información:
 * el conductor tiene que entenderlo sin leer.
 */
function SolicitudEnMapa({ solicitud }) {
  const conMaletero = solicitud.maletero !== 'no';
  const simbolo = conMaletero ? CONFIG.MALETERO[solicitud.maletero].icono : solicitud.personas;
  const clase = solicitud.maletero === 'silla' ? 'pin-silla'
    : solicitud.maletero === 'equipaje' ? 'pin-maletero'
    : 'pin-normal';
  const icono = divIcon({
    className: 'pin-solicitud-envoltura',
    html: `<span class="pin-solicitud ${clase}">${simbolo}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

  return (
    <Marker position={solicitud.punto} icon={icono} keyboard={false}>
      <Tooltip direction="top" offset={[0, -14]}>{describir(solicitud)} · a {solicitud.eta} min</Tooltip>
    </Marker>
  );
}

/**
 * Mapa compartido por los dos perfiles.
 *
 * No decide nada: recibe los vehículos, las solicitudes y el punto de espera
 * ya calculados, y avisa hacia arriba cuando el usuario toca el mapa o elige
 * un vehículo. El conductor lo usa como radar pasándole `solicitudes`.
 */
export default function Mapa({ vehiculos, puntoEspera, seleccionado, lineaActiva, lineas, solicitudes = [], encuadre: encuadrePedido, onSelect, onMove }) {
  const encuadre = encuadrePedido?.length ? encuadrePedido : lineas.flatMap((linea) => linea.recorrido);

  return (
    <div className="mapwrap">
      <MapContainer
        bounds={encuadre.length ? encuadre : undefined}
        boundsOptions={{ padding: [24, 24] }}
        minZoom={11.5}
        maxZoom={18}
        scrollWheelZoom
        doubleClickZoom
        touchZoom
        zoomControl
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <Encuadrar puntos={encuadre} />
        {puntoEspera && <CentrarPasajero punto={puntoEspera} />}
        {onMove && <CapturarToque onMove={onMove} />}

        {lineas.map((linea) => (
          <Recorrido key={linea.id} linea={linea} activa={lineaActiva === 'todas' || lineaActiva === linea.id} />
        ))}

        {puntoEspera && (
          <>
            <CircleMarker center={puntoEspera} radius={13} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2f80ed', fillOpacity: 0.25 }} />
            <CircleMarker center={puntoEspera} radius={7} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2f80ed', fillOpacity: 1 }}>
              <Tooltip direction="top" offset={[0, -8]} permanent>Tu ubicación</Tooltip>
            </CircleMarker>
          </>
        )}

        {solicitudes.map((s) => <SolicitudEnMapa key={s.id} solicitud={s} />)}

        {vehiculos.map((vehiculo) => (
          <Vehiculo key={vehiculo.id} vehiculo={vehiculo} activo={seleccionado === vehiculo.id} onSelect={onSelect} />
        ))}
      </MapContainer>

      <div className="route-legend" aria-label="Recorridos del mapa">
        {lineas.map((linea) => (
          <span key={linea.id}><i style={{ background: colorDe(linea) }} />{linea.id}</span>
        ))}
      </div>

      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap · CARTO
      </a>
    </div>
  );
}
