// ============================================
// Configuración centralizada - App Padres
// ============================================

// ====== CONFIGURACIÓN DE SERVIDOR ======
// LOCAL: Descomentar para desarrollo local
// export const API_URL = 'http://192.168.100.241:3000/api';
// export const SOCKET_URL = 'http://192.168.100.241:3000';

// RAILWAY: Producción
export const API_URL = 'https://transporte-api-production-0096.up.railway.app/api';
export const SOCKET_URL = 'https://transporte-api-production-0096.up.railway.app';

// Tema de colores - Unificado con web y app conductor (#1e3a8a azul)
export const COLORS = {
  // Primarios (azul - mismo que web y conductor)
  primary: '#1e3a8a',
  primaryLight: '#3b82f6',
  primaryDark: '#1e2a5e',
  primaryBg: '#eff6ff',
  primaryBgLight: '#dbeafe',

  // Neutros
  white: '#ffffff',
  bg: '#f8fafc',
  bgCard: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // Estados
  success: '#16a34a',
  successBg: '#dcfce7',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  warning: '#f59e0b',
  warningBg: '#fef3c7',

  // Marcadores del mapa
  markerStart: '#16a34a',
  markerEnd: '#dc2626',
  markerSchool: '#1e3a8a',
  markerStudent: '#f97316',
  markerBus: '#7c3aed',
  route: '#3b82f6',
} as const;

// Coordenadas del colegio
export const SCHOOL = {
  latitude: -17.38914530406023,
  longitude: -66.31402713529513,
  name: 'Colegio Adventista de Bolivia',
} as const;

// Estilos de tipografía reutilizables
export const FONTS = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: COLORS.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: COLORS.text },
  h3: { fontSize: 16, fontWeight: '700' as const, color: COLORS.text },
  body: { fontSize: 14, color: COLORS.textSecondary },
  caption: { fontSize: 12, color: COLORS.textMuted },
  label: { fontSize: 13, fontWeight: '600' as const, color: COLORS.textSecondary },
} as const;

// Estilos de sombra reutilizables
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
