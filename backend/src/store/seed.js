/** Datos iniciales de demostración (UCI con 4 camas). */
import { Rol, EstadoBomba } from '../domain/entities.js';
import { EstadoMonitorizacion } from '../domain/monitoringStateMachine.js';

export function seedState() {
  const sensores = (pid) => [
    { id: `${pid}-S-FC`, tipo: 'FC', modelo: 'MG-ECG-01' },
    { id: `${pid}-S-SPO2`, tipo: 'SPO2', modelo: 'MG-OX-02' },
    { id: `${pid}-S-PA`, tipo: 'PA', modelo: 'MG-NIBP-03' },
    { id: `${pid}-S-TEMP`, tipo: 'TEMP', modelo: 'MG-TMP-04' }
  ];
  const paciente = (id, nombre, cama, edad, diagnostico, medicamento, velocidad) => ({
    id,
    nombre,
    cama,
    edad,
    diagnostico,
    estado: EstadoMonitorizacion.SIN_SENAL,
    sensores: sensores(id),
    bomba: {
      id: `${id}-BOMBA`,
      medicamento,
      velocidadMlH: velocidad,
      estado: EstadoBomba.INFUNDIENDO,
      actualizadoEn: new Date().toISOString()
    }
  });

  return {
    usuarios: [
      { id: 'U-001', nombre: 'Dra. Ana Torres', rol: Rol.MEDICO, rfid: 'RFID-MED-001', especialidad: 'Medicina Crítica' },
      { id: 'U-002', nombre: 'Dr. Luis Herrera', rol: Rol.MEDICO, rfid: 'RFID-MED-002', especialidad: 'Anestesiología' },
      { id: 'U-003', nombre: 'Enf. María López', rol: Rol.ENFERMERA, rfid: 'RFID-ENF-001', especialidad: 'Enfermería UCI' }
    ],
    pacientes: [
      paciente('P-001', 'Carlos Méndez Ruiz', 'UCI-01', 58, 'Neumonía grave', 'Ceftriaxona', 50),
      paciente('P-002', 'Laura Sánchez Díaz', 'UCI-02', 44, 'Postoperatorio cardíaco', 'Heparina', 18),
      paciente('P-003', 'Jorge Ramírez Peña', 'UCI-03', 71, 'Sepsis', 'Vancomicina', 125),
      paciente('P-004', 'Sofía Castillo Mora', 'UCI-04', 36, 'Politraumatismo', 'Amoxicilina-clavulánico', 100)
    ],
    lecturas: [],
    alarmas: [],
    incidentes: [],
    auditoria: [],
    configuracion: null
  };
}
