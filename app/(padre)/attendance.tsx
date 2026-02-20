import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { getUser } from '../../lib/auth';
import { COLORS, SHADOWS } from '../../lib/constants';

interface Student {
  id: string;
  nombre: string;
  apellido: string;
  grado: string;
}

interface AbsenceNotice {
  id: string;
  estudianteId: string;
  fecha: string;
  motivo: string | null;
  activo: boolean;
}

interface AttendanceRecord {
  id: string;
  evento: 'abordaje' | 'descenso';
  timestamp: string;
  validadoGeofencing: boolean;
  distanciaDomicilio: number | null;
}

export default function AttendanceScreen() {
  const [students, setStudents] = useState<Student[]>([]);
  const [absences, setAbsences] = useState<Record<string, AbsenceNotice[]>>({});
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState<string | null>(null);
  const [absenceMode, setAbsenceMode] = useState<'today' | 'scheduled'>('today');
  const [absenceFecha, setAbsenceFecha] = useState('');
  const [absenceMotivo, setAbsenceMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const userData = await getUser();
      if (!userData) return;

      const studentsRes = await api.get(`/students/padre/${userData.id}`);
      const studentsList: Student[] = studentsRes.data;
      setStudents(studentsList);

      // Fetch absences and recent attendance for each student
      const absMap: Record<string, AbsenceNotice[]> = {};
      const attMap: Record<string, AttendanceRecord[]> = {};

      await Promise.all(
        studentsList.map(async (s) => {
          try {
            const [absRes, attRes] = await Promise.all([
              api.get(`/attendance/absences/student/${s.id}`),
              api.get(`/attendance/student/${s.id}`),
            ]);
            absMap[s.id] = absRes.data;
            attMap[s.id] = attRes.data;
          } catch {
            absMap[s.id] = [];
            attMap[s.id] = [];
          }
        }),
      );

      setAbsences(absMap);
      setAttendance(attMap);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const submitAbsence = async (estudianteId: string) => {
    let fecha: string;
    if (absenceMode === 'today') {
      fecha = new Date().toISOString().split('T')[0];
    } else {
      if (!absenceFecha) {
        Alert.alert('Error', 'Selecciona una fecha para la ausencia programada');
        return;
      }
      fecha = absenceFecha;
    }

    setSubmitting(true);
    try {
      await api.post('/attendance/absence', {
        estudianteId,
        fecha,
        motivo: absenceMotivo.trim() || undefined,
      });

      const msg = absenceMode === 'today'
        ? 'El conductor será notificado de que tu hijo no asistirá hoy.'
        : `Ausencia programada para ${fecha}. El conductor será notificado.`;
      Alert.alert('Ausencia registrada', msg);
      setShowAbsenceForm(null);
      setAbsenceMotivo('');
      setAbsenceFecha('');
      setAbsenceMode('today');
      await fetchData();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error al registrar ausencia';
      Alert.alert('Error', typeof msg === 'string' ? msg : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAbsence = async (absenceId: string) => {
    Alert.alert('Cancelar ausencia', '¿Reactivar la recogida para este día?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar ausencia',
        onPress: async () => {
          try {
            await api.delete(`/attendance/absence/${absenceId}`);
            await fetchData();
          } catch {
            Alert.alert('Error', 'No se pudo cancelar la ausencia');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando asistencia...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      <Text style={styles.sectionTitle}>Asistencia de mis hijos</Text>

      {students.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="clipboard-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>Sin hijos registrados</Text>
        </View>
      ) : (
        students.map((student) => {
          const studentAbsences = (absences[student.id] || []).filter((a) => a.activo);
          const studentAttendance = attendance[student.id] || [];
          const todayStr = new Date().toISOString().split('T')[0];
          const todayRecords = studentAttendance.filter(
            (r) => r.timestamp.startsWith(todayStr),
          );
          const todayAbordaje = todayRecords.find((r) => r.evento === 'abordaje');
          const todayDescenso = todayRecords.find((r) => r.evento === 'descenso');

          // Future absences
          const futureAbsences = studentAbsences.filter(
            (a) => a.fecha >= todayStr,
          );

          return (
            <View key={student.id} style={styles.card}>
              {/* Student header */}
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {student.nombre.charAt(0)}{student.apellido.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>
                    {student.nombre} {student.apellido}
                  </Text>
                  <Text style={styles.studentGrade}>{student.grado}</Text>
                </View>
              </View>

              {/* Today's attendance status */}
              <View style={styles.todaySection}>
                <Text style={styles.todayLabel}>Hoy</Text>
                <View style={styles.todayRow}>
                  <View style={[styles.statusChip, todayAbordaje ? styles.statusActive : styles.statusInactive]}>
                    <Ionicons name={todayAbordaje ? 'checkmark-circle' : 'time-outline'} size={14} color={todayAbordaje ? COLORS.success : COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.statusText, todayAbordaje && { color: COLORS.success }]}>
                      {todayAbordaje
                        ? `Abordó ${new Date(todayAbordaje.timestamp).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Sin abordar'}
                    </Text>
                  </View>
                  <View style={[styles.statusChip, todayDescenso ? styles.statusActive : styles.statusInactive]}>
                    <Ionicons name={todayDescenso ? 'checkmark-circle' : 'time-outline'} size={14} color={todayDescenso ? COLORS.success : COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.statusText, todayDescenso && { color: COLORS.success }]}>
                      {todayDescenso
                        ? `Bajó ${new Date(todayDescenso.timestamp).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Sin descenso'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Active absences */}
              {futureAbsences.length > 0 && (
                <View style={styles.absenceSection}>
                  <Text style={styles.absenceLabel}>Ausencias programadas</Text>
                  {futureAbsences.map((ab) => (
                    <View key={ab.id} style={styles.absenceRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.absenceDate}>{ab.fecha}</Text>
                        {ab.motivo && <Text style={styles.absenceMotivo}>{ab.motivo}</Text>}
                      </View>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => cancelAbsence(ab.id)}
                      >
                        <Text style={styles.cancelBtnText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Mark absence button / form */}
              {showAbsenceForm === student.id ? (
                <View style={styles.absenceForm}>
                  {/* Mode selector */}
                  <View style={styles.modeRow}>
                    <TouchableOpacity
                      style={[styles.modeBtn, absenceMode === 'today' && styles.modeBtnActive]}
                      onPress={() => setAbsenceMode('today')}
                    >
                      <Text style={[styles.modeBtnText, absenceMode === 'today' && styles.modeBtnTextActive]}>
                        Hoy
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeBtn, absenceMode === 'scheduled' && styles.modeBtnActive]}
                      onPress={() => setAbsenceMode('scheduled')}
                    >
                      <Text style={[styles.modeBtnText, absenceMode === 'scheduled' && styles.modeBtnTextActive]}>
                        Fecha programada
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {absenceMode === 'scheduled' && (
                    <>
                      <Text style={styles.formLabel}>Fecha:</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="YYYY-MM-DD (ej: 2026-02-15)"
                        placeholderTextColor={COLORS.textMuted}
                        value={absenceFecha}
                        onChangeText={setAbsenceFecha}
                      />
                    </>
                  )}

                  <Text style={styles.formLabel}>Motivo (opcional):</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ej: Enfermedad, cita médica..."
                    placeholderTextColor={COLORS.textMuted}
                    value={absenceMotivo}
                    onChangeText={setAbsenceMotivo}
                  />
                  <View style={styles.formActions}>
                    <TouchableOpacity
                      style={[styles.formBtn, styles.formBtnCancel]}
                      onPress={() => {
                        setShowAbsenceForm(null);
                        setAbsenceMotivo('');
                        setAbsenceFecha('');
                        setAbsenceMode('today');
                      }}
                    >
                      <Text style={styles.formBtnCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.formBtn, styles.formBtnSubmit]}
                      onPress={() => submitAbsence(student.id)}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.formBtnSubmitText}>
                          {absenceMode === 'today' ? 'No recoger hoy' : 'Programar ausencia'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.markAbsentBtn}
                  onPress={() => setShowAbsenceForm(student.id)}
                >
                  <Text style={styles.markAbsentText}>
                    Marcar ausencia
                  </Text>
                </TouchableOpacity>
              )}

              {/* Recent history */}
              {studentAttendance.length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.historyLabel}>Últimos registros</Text>
                  {studentAttendance.slice(0, 6).map((rec) => (
                    <View key={rec.id} style={styles.historyRow}>
                      <Ionicons name={rec.evento === 'abordaje' ? 'bus' : 'home'} size={14} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
                      <Text style={styles.historyText}>
                        {rec.evento === 'abordaje' ? 'Abordó' : 'Descendió'}{' '}
                        {new Date(rec.timestamp).toLocaleDateString('es-BO')}{' '}
                        {new Date(rec.timestamp).toLocaleTimeString('es-BO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Ionicons name={rec.validadoGeofencing ? 'checkmark-circle' : 'warning-outline'} size={12} color={rec.validadoGeofencing ? COLORS.success : COLORS.warning} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 24,
  },
  loadingText: { marginTop: 12, color: COLORS.textMuted },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  // Card
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryBgLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  studentName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  studentGrade: { fontSize: 12, color: COLORS.textSecondary },

  // Today
  todaySection: { marginBottom: 12 },
  todayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  statusActive: { backgroundColor: COLORS.successBg },
  statusInactive: { backgroundColor: COLORS.borderLight },
  statusText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  // Absences
  absenceSection: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  absenceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
    marginBottom: 6,
  },
  absenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  absenceDate: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  absenceMotivo: { fontSize: 11, color: COLORS.textSecondary },
  cancelBtn: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  cancelBtnText: { fontSize: 11, color: COLORS.danger, fontWeight: '600' },

  // Mark absent
  markAbsentBtn: {
    backgroundColor: COLORS.warningBg,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  markAbsentText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.warning,
  },

  // Mode selector
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  modeBtnTextActive: { color: '#fff' },

  // Form
  absenceForm: {
    backgroundColor: COLORS.borderLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  formLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  formInput: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  formActions: { flexDirection: 'row', gap: 8 },
  formBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  formBtnCancel: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  formBtnCancelText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  formBtnSubmit: { backgroundColor: COLORS.danger },
  formBtnSubmitText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // History
  historySection: { borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 10 },
  historyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  historyText: { flex: 1, fontSize: 12, color: COLORS.text },
});
