import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams } from 'expo-router';
import api from '../../lib/api';
import { connectSocket, disconnectSocket } from '../../lib/socket';
import { COLORS, SCHOOL } from '../../lib/constants';

interface Position {
  latitude: number;
  longitude: number;
}

interface RouteData {
  id: string;
  nombre: string;
  inicioLat: number;
  inicioLng: number;
  inicioNombre: string;
  destinoLat: number;
  destinoLng: number;
  destinoNombre: string;
  geometria: any;
  estudiantes: {
    id: string;
    nombre: string;
    apellido: string;
    latitud: number;
    longitud: number;
  }[];
}

function parseGeometry(geom: any): Position[] {
  if (!geom) return [];
  if (geom.type === 'LineString' && geom.coordinates) {
    return geom.coordinates.map((c: number[]) => ({
      latitude: c[1],
      longitude: c[0],
    }));
  }
  if (typeof geom === 'string') {
    const match = geom.match(/LINESTRING\s*\((.+)\)/i);
    if (match) {
      return match[1].split(',').map((pair: string) => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return { latitude: lat, longitude: lng };
      });
    }
  }
  return [];
}

export default function TrackingScreen() {
  const params = useLocalSearchParams<{
    rutaId: string;
    vehiculoId: string;
    studentName: string;
    placa: string;
  }>();
  const { rutaId, vehiculoId, studentName, placa } = params;

  const [route, setRoute] = useState<RouteData | null>(null);
  const [busPosition, setBusPosition] = useState<Position | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const mapRef = useRef<MapView>(null);

  // Load route and check active trajectory
  useEffect(() => {
    (async () => {
      try {
        if (rutaId) {
          const routeRes = await api.get(`/routes/${rutaId}`);
          setRoute(routeRes.data);
        }
        if (vehiculoId) {
          // Check if trajectory is active first
          let trajectoryActive = false;
          try {
            const activeRes = await api.get(`/gps/trajectory/${vehiculoId}/active`);
            if (activeRes.data?.id) {
              trajectoryActive = true;
              setIsActive(true);
            }
          } catch {
            setIsActive(false);
          }

          // Only show bus position if trajectory is active
          if (trajectoryActive) {
            try {
              const lastPos = await api.get(`/gps/last/${vehiculoId}`);
              if (lastPos.data) {
                const loc = lastPos.data.location || lastPos.data;
                const lat = loc.lat || loc.latitude || loc.coordinates?.[1];
                const lng = loc.lng || loc.longitude || loc.coordinates?.[0];
                if (lat && lng) setBusPosition({ latitude: lat, longitude: lng });
                if (lastPos.data.timestamp) {
                  setLastUpdate(new Date(lastPos.data.timestamp).toLocaleTimeString());
                }
              }
            } catch {}
          }
        }
      } catch (error) {
        console.error('Error loading tracking data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [rutaId, vehiculoId]);

  // Fit map to all markers after route loads
  useEffect(() => {
    if (!route || !mapRef.current) return;
    const coords: Position[] = [];
    if (route.inicioLat && route.inicioLng) coords.push({ latitude: route.inicioLat, longitude: route.inicioLng });
    if (route.destinoLat && route.destinoLng) coords.push({ latitude: route.destinoLat, longitude: route.destinoLng });
    coords.push({ latitude: SCHOOL.latitude, longitude: SCHOOL.longitude });
    route.estudiantes?.forEach(s => {
      if (s.latitud && s.longitud) coords.push({ latitude: s.latitud, longitude: s.longitud });
    });
    if (busPosition) coords.push(busPosition);

    if (coords.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [route, busPosition]);

  // WebSocket live tracking
  useEffect(() => {
    if (!vehiculoId) return;
    let mounted = true;
    (async () => {
      try {
        const socket = await connectSocket();
        socket.emit('join:vehicle', { vehiculoId });
        socket.on('location:update', (data: any) => {
          if (!mounted || data.vehiculoId !== vehiculoId) return;
          const lat = data.location?.lat || data.lat;
          const lng = data.location?.lng || data.lng;
          if (lat && lng) {
            const newPos = { latitude: lat, longitude: lng };
            setBusPosition(newPos);
            setLastUpdate(new Date().toLocaleTimeString());
            setIsActive(true);
          }
        });
        socket.on('trajectory:started', (data: any) => {
          if (mounted && data.vehiculoId === vehiculoId) setIsActive(true);
        });
        socket.on('trajectory:ended', (data: any) => {
          if (mounted && data.vehiculoId === vehiculoId) {
            setIsActive(false);
            setBusPosition(null);
          }
        });
      } catch (err) {
        console.error('WebSocket error:', err);
      }
    })();
    return () => { mounted = false; disconnectSocket(); };
  }, [vehiculoId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando tracking...</Text>
      </View>
    );
  }

  if (!vehiculoId || !rutaId) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 50, marginBottom: 16 }}>📍</Text>
        <Text style={styles.emptyTitle}>Sin datos de tracking</Text>
        <Text style={styles.emptyText}>Selecciona un hijo desde la pantalla principal.</Text>
      </View>
    );
  }

  const routeCoords = route ? parseGeometry(route.geometria) : [];
  const busLabel = placa ? `Bus ${placa}` : 'Bus Escolar';

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusStudent}>{studentName || 'Tracking'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? COLORS.successBg : COLORS.dangerBg }]}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? COLORS.success : COLORS.danger }]} />
          <Text style={[styles.statusText, { color: isActive ? COLORS.success : COLORS.danger }]}>
            {isActive ? 'Bus en viaje' : 'Sin viaje activo'}
          </Text>
        </View>
      </View>

      {/* Google Maps */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: SCHOOL.latitude,
          longitude: SCHOOL.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Route polyline */}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={COLORS.primaryLight}
            strokeWidth={4}
          />
        )}

        {/* Start marker */}
        {route?.inicioLat && route?.inicioLng && (
          <Marker
            coordinate={{ latitude: route.inicioLat, longitude: route.inicioLng }}
            title={route.inicioNombre || 'Inicio'}
            pinColor="green"
          />
        )}

        {/* End marker */}
        {route?.destinoLat && route?.destinoLng && (
          <Marker
            coordinate={{ latitude: route.destinoLat, longitude: route.destinoLng }}
            title={route.destinoNombre || 'Destino'}
            pinColor="red"
          />
        )}

        {/* School marker */}
        <Marker
          coordinate={{ latitude: SCHOOL.latitude, longitude: SCHOOL.longitude }}
          title={SCHOOL.name}
          pinColor="blue"
        />

        {/* Student markers */}
        {route?.estudiantes?.map(s => (
          s.latitud && s.longitud ? (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.latitud, longitude: s.longitud }}
              title={`${s.nombre} ${s.apellido}`}
              pinColor="orange"
            />
          ) : null
        ))}

        {/* Bus marker - only when active trip and has position */}
        {isActive && busPosition && (
          <Marker
            coordinate={busPosition}
            title={busLabel}
            description={isActive ? 'En viaje' : ''}
          >
            <View style={styles.busMarker}>
              <Text style={styles.busEmoji}>🚌</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Bottom info panel */}
      <View style={styles.infoPanel}>
        <View style={styles.infoPanelRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeName}>{route?.nombre || 'Ruta'}</Text>
            {placa && <Text style={styles.placaText}>Placa: {placa}</Text>}
            <Text style={styles.lastUpdateText}>
              {isActive && lastUpdate
                ? `Última señal: ${lastUpdate}`
                : 'Sin señal activa del bus'}
            </Text>
          </View>
          {isActive && busPosition && (
            <TouchableOpacity
              style={styles.centerBtn}
              onPress={() => {
                mapRef.current?.animateToRegion({
                  ...busPosition,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }, 500);
              }}
            >
              <Text style={styles.centerBtnText}>Centrar Bus</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.textMuted },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusStudent: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },
  map: { flex: 1 },
  busMarker: {
    backgroundColor: 'white',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  busEmoji: { fontSize: 20 },
  infoPanel: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  infoPanelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  placaText: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 1 },
  lastUpdateText: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  centerBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  centerBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
