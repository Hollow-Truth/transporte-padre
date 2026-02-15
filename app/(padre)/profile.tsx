import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { getUser, logout, User } from '../../lib/auth';

interface Student {
  id: string;
  nombre: string;
  apellido: string;
  grado: string;
}

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const u = await getUser();
        setUser(u);

        if (u) {
          const res = await api.get(`/students/padre/${u.id}`);
          setStudents(res.data);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header del perfil */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.nombre?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>
          {user?.nombre} {user?.apellido}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.rolBadge}>
          <Text style={styles.rolText}>Padre de Familia</Text>
        </View>
      </View>

      {/* Hijos */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          👧 Mis Hijos ({students.length})
        </Text>
        {students.length > 0 ? (
          students.map((s) => (
            <View key={s.id} style={styles.studentRow}>
              <View style={styles.studentDot} />
              <View>
                <Text style={styles.studentName}>
                  {s.nombre} {s.apellido}
                </Text>
                <Text style={styles.studentGrade}>{s.grado}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noStudents}>
            No tienes hijos registrados
          </Text>
        )}
      </View>

      {/* Cerrar sesión */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  profileHeader: {
    backgroundColor: '#1e3a8a',
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 14,
    color: '#93c5fd',
    marginTop: 4,
  },
  rolBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 10,
  },
  rolText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eff6ff',
  },
  studentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1e3a8a',
    marginRight: 12,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  studentGrade: {
    fontSize: 12,
    color: '#94a3b8',
  },
  noStudents: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
  },
  logoutButton: {
    margin: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
});
