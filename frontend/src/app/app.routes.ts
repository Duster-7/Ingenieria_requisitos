import { Routes } from '@angular/router';
import { authGuard, invitadoGuard, medicoGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './pages/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [invitadoGuard], title: 'MediGuard IoT · Acceso RFID' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard.component').then((m) => m.DashboardComponent), title: 'MediGuard IoT · Central' },
      { path: 'bedside/:id', loadComponent: () => import('./pages/bedside.component').then((m) => m.BedsideComponent), title: 'MediGuard IoT · Bedside' },
      { path: 'historial', loadComponent: () => import('./pages/history.component').then((m) => m.HistoryComponent), title: 'MediGuard IoT · Historial' },
      { path: 'alarmas', loadComponent: () => import('./pages/alarms.component').then((m) => m.AlarmsComponent), title: 'MediGuard IoT · Alarmas' },
      { path: 'incidentes', loadComponent: () => import('./pages/incidents.component').then((m) => m.IncidentsComponent), title: 'MediGuard IoT · Incidentes' },
      { path: 'reporte/:id', canActivate: [medicoGuard], loadComponent: () => import('./pages/report.component').then((m) => m.ReportComponent), title: 'MediGuard IoT · Reporte' },
      { path: 'sistema', loadComponent: () => import('./pages/system.component').then((m) => m.SystemComponent), title: 'MediGuard IoT · Sistema' }
    ]
  },
  { path: '**', redirectTo: '' }
];
