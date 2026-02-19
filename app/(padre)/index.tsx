import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { getUser, type User } from '../../lib/auth';
import { COLORS, SHADOWS } from '../../lib/constants';

interface Student {
  id: string;
  nombre: string;
  apellido: string;
  grado: string;
  direccion: string;
  latitud: number;
  longitud: number;
  ruta?: {
    id: string;
    nombre: string;
    vehiculoId: string;
    vehiculo?: {
      id: string;
      placa: string;
      conductor?: { nombre: string; apellido: string };
    };
  };
}

interface AttendanceStatus {
  abordaje: string | null; // timestamp
  descenso: string | null; // timestamp
}

export default function DashboardScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeVehicles, setActiveVehicles] = useState<Set<string>>(new Set());
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const userData = await getUser();
      if (!userData) return;
      setUser(userData);

      const studentsRes = await api.get(`/students/padre/${userData.id}`);
      let studentsList: Student[] = studentsRes.data;

      const [routesRes, vehiclesRes] = await Promise.all([
        api.get('/routes'),
        api.get('/vehicles'),
      ]);

      studentsList = studentsList.map((s) => {
        if (s.ruta) {
          const fullRoute = routesRes.data.find((r: any) => r.id === s.ruta?.id);
          if (fullRoute?.vehiculo) {
            const fullVehicle = vehiclesRes.data.find((v: any) => v.id === fullRoute.vehiculo.id);
            s.ruta = { ...s.ruta, vehiculoId: fullRoute.vehiculo.id, vehiculo: fullVehicle };
          }
        }
        return s;
      });

      setStudents(studentsList);

      // Fetch active trajectories and attendance in parallel
      const actives = new Set<string>();
      const attMap: Record<string, AttendanceStatus> = {};
      const todayStr = new Date().toISOString().split('T')[0];

      await Promise.all(
        studentsList.map(async (s) => {
          // Check active trajectory
          if (s.ruta?.vehiculoId) {
            try {
              const res = await api.get(`/gps/trajectory/${s.ruta.vehiculoId}/active`);
              if (res.data?.id) actives.add(s.ruta.vehiculoId);
            } catch {}
          }

          // Fetch today's attendance
          try {
            const attRes = await api.get(`/attendance/student/${s.id}`);
            const todayRecords = (attRes.data || []).filter(
              (r: any) => r.timestamp?.startsWith(todayStr),
            );
            const abordaje = todayRecords.find((r: any) => r.evento === 'abordaje');
            const descenso = todayRecords.find((r: any) => r.evento === 'descenso');
            attMap[s.id] = {
              abordaje: abordaje?.timestamp || null,
              descenso: descenso?.timestamp || null,
            };
          } catch {
            attMap[s.id] = { abordaje: null, descenso: null };
          }
        }),
      );

      setActiveVehicles(actives);
      setAttendanceMap(attMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const goToTracking = (student: Student) => {
    if (!student.ruta?.vehiculoId) return;
    router.push({
      pathname: '/(padre)/tracking',
      params: {
        rutaId: student.ruta.id,
        vehiculoId: student.ruta.vehiculoId,
        studentName: `${student.nombre} ${student.apellido}`,
        placa: student.ruta.vehiculo?.placa || '',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const activeCount = students.filter(
    (s) => s.ruta?.vehiculoId && activeVehicles.has(s.ruta.vehiculoId)
  ).length;
  const withRoute = students.filter((s) => s.ruta).length;
  const recogidos = students.filter((s) => attendanceMap[s.id]?.abordaje && !attendanceMap[s.id]?.descenso).length;
  const entregados = students.filter((s) => attendanceMap[s.id]?.descenso).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Header saludo */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.nombre || 'Padre'}</Text>
          <Text style={styles.subtitle}>
            {activeCount > 0
              ? `${activeCount} bus${activeCount > 1 ? 'es' : ''} activo${activeCount > 1 ? 's' : ''}`
              : 'Sin buses activos ahora'}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeNum}>{students.length}</Text>
          <Text style={styles.headerBadgeLabel}>Hijos</Text>
        </View>
      </View>

      {/* Resumen rápido */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: COLORS.primaryBgLight }]}>
          <Text style={[styles.statNum, { color: COLORS.primary }]}>{withRoute}</Text>
          <Text style={styles.statLabel}>Con ruta</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: COLORS.successBg }]}>
          <Text style={[styles.statNum, { color: COLORS.success }]}>{recogidos}</Text>
          <Text style={styles.statLabel}>Recogidos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: COLORS.primaryBgLight }]}>
          <Text style={[styles.statNum, { color: COLORS.primary }]}>{entregados}</Text>
          <Text style={styles.statLabel}>Entregados</Text>
        </View>
      </View>

      {/* Lista de hijos */}
      <Text style={styles.sectionTitle}>Mis Hijos</Text>

      {students.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>Sin hijos registrados</Text>
          <Text style={styles.emptyText}>Contacta al administrador para asignar estudiantes.</Text>
        </View>
      ) : (
        students.map((student) => {
          const isActive = student.ruta?.vehiculoId
            ? activeVehicles.has(student.ruta.vehiculoId)
            : false;
          const att = attendanceMap[student.id];
          const hasAbordaje = !!att?.abordaje;
          const hasDescenso = !!att?.descenso;

          // Student status: entregado > recogido > en domicilio
          let statusLabel: string = 'En domicilio';
          let statusColor: string = COLORS.textMuted;
          let statusBg: string = COLORS.borderLight;
          if (hasDescenso) {
            statusLabel = 'Entregado';
            statusColor = COLORS.primary;
            statusBg = COLORS.primaryBgLight;
          } else if (hasAbordaje) {
            statusLabel = 'Recogido';
            statusColor = COLORS.success;
            statusBg = COLORS.successBg;
          } else if (isActive) {
            statusLabel = 'Bus en camino';
            statusColor = COLORS.warning;
            statusBg = COLORS.warningBg;
          }

          // Card accent color based on status
          const accentColor = hasDescenso
            ? COLORS.primary
            : hasAbordaje
            ? COLORS.success
            : isActive
            ? COLORS.warning
            : student.ruta
            ? COLORS.textMuted
            : COLORS.warning;

          return (
            <TouchableOpacity
              key={student.id}
              style={styles.card}
              onPress={() => goToTracking(student)}
              disabled={!student.ruta?.vehiculoId}
              activeOpacity={0.7}
            >
              {/* Barra lateral de color */}
              <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: hasAbordaje ? COLORS.successBg : COLORS.primaryBgLight }]}>
                    <Text style={[styles.avatarText, { color: hasAbordaje ? COLORS.success : COLORS.primary }]}>
                      {student.nombre.charAt(0)}{student.apellido.charAt(0)}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{student.nombre} {student.apellido}</Text>
                    <Text style={styles.studentGrade}>{student.grado}</Text>
                  </View>

                  {/* Status badge */}
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                {/* Attendance time info */}
                {(hasAbordaje || hasDescenso) && (
                  <View style={styles.attendanceRow}>
                    {hasAbordaje && (
                      <View style={[styles.infoChip, { backgroundColor: COLORS.successBg }]}>
                        <Ionicons name="checkmark-circle" size={14} color={COLORS.success} style={{ marginRight: 5 }} />
                        <Text style={[styles.chipText, { color: COLORS.success }]}>
                          Abordaje {new Date(att!.abordaje!).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                    {hasDescenso && (
                      <View style={[styles.infoChip, { backgroundColor: COLORS.primaryBgLight }]}>
                        <Ionicons name="home" size={14} color={COLORS.primary} style={{ marginRight: 5 }} />
                        <Text style={[styles.chipText, { color: COLORS.primary }]}>
                          Descenso {new Date(att!.descenso!).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Info de ruta */}
                <View style={styles.routeInfo}>
                  {student.ruta ? (
                    <>
                      <View style={styles.infoChip}>
                        <Ionicons name="map-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 5 }} />
                        <Text style={styles.chipText}>{student.ruta.nombre}</Text>
                      </View>
                      {student.ruta.vehiculo && (
                        <View style={styles.infoChip}>
                          <Ionicons name="bus-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 5 }} />
                          <Text style={styles.chipText}>{student.ruta.vehiculo.placa}</Text>
                        </View>
                      )}
                      {student.ruta.vehiculo?.conductor && (
                        <View style={styles.infoChip}>
                          <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 5 }} />
                          <Text style={styles.chipText}>{student.ruta.vehiculo.conductor.nombre}</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={[styles.infoChip, { backgroundColor: COLORS.warningBg }]}>
                      <Ionicons name="warning-outline" size={14} color={COLORS.warning} style={{ marginRight: 5 }} />
                      <Text style={[styles.chipText, { color: COLORS.warning }]}>Sin ruta asignada</Text>
                    </View>
                  )}
                </View>

                {/* Botón tracking */}
                {student.ruta?.vehiculoId && (
                  <View style={[styles.trackBtn, isActive && styles.trackBtnActive, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <Ionicons
                      name={isActive ? 'location' : 'map-outline'}
                      size={14}
                      color={isActive ? COLORS.white : COLORS.primary}
                    />
                    <Text style={[styles.trackBtnText, isActive && styles.trackBtnTextActive]}>
                      {isActive ? 'Ver ubicacion en vivo' : 'Ver ruta asignada'}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 15 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  headerBadge: {
    backgroundColor: COLORS.primaryBgLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  headerBadgeNum: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  headerBadgeLabel: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  statNum: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: '600' },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginLeft: 20, marginBottom: 12 },

  // Empty
  emptyCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  // Cards
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  cardAccent: { width: 5, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardContent: { flex: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  // Avatar
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 15, fontWeight: '800' },

  // Student info
  studentName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  studentGrade: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },

  // Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 5,
  },
  liveText: { fontSize: 10, fontWeight: '800', color: COLORS.success, letterSpacing: 0.5 },

  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // Attendance row
  attendanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },

  // Route info chips
  routeInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  // Track button
  trackBtn: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  trackBtnActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  trackBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  trackBtnTextActive: { color: COLORS.white },
});
