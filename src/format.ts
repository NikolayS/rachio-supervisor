import type { Alert, IrrigationSnapshot } from './types';

export function formatStatus(snapshot: IrrigationSnapshot): string {
  const lines: string[] = [
    `Account: ${snapshot.account.username} (${snapshot.account.email})`,
  ];

  for (const { device, currentSchedule } of snapshot.devices) {
    lines.push('');
    lines.push(`Device: ${device.name} [${device.id}]`);
    lines.push(`  Model: ${device.model ?? 'unknown'}, Status: ${device.status}`);
    lines.push(`  Zones (${device.zones.length}):`);

    for (const zone of device.zones) {
      const enabled = zone.enabled ? 'enabled' : 'disabled';
      lines.push(
        `    ${zone.zoneNumber}. ${zone.name || 'Unnamed'} [${zone.id}] ${enabled}`
      );
    }

    if (currentSchedule.status === 'PROCESSING') {
      const minutes = Math.round((currentSchedule.remainingDuration ?? 0) / 60);
      lines.push(
        `  Running: Zone ${currentSchedule.zoneNumber ?? '?'} — ${minutes}min remaining`
      );
    } else {
      lines.push('  Not currently running');
    }
  }

  return lines.join('\n');
}

export function formatZones(snapshot: IrrigationSnapshot): string {
  return snapshot.devices
    .flatMap(({ device }) =>
      device.zones.map(
        (zone) =>
          `${device.name}\t${zone.zoneNumber}\t${zone.name || 'Unnamed'}\t${zone.id}`
      )
    )
    .join('\n');
}

export function formatSchedules(snapshot: IrrigationSnapshot): string {
  const lines: string[] = [];

  for (const { device } of snapshot.devices) {
    lines.push(`Device: ${device.name}`);
    for (const rule of device.scheduleRules) {
      const days = rule.days?.join(', ') ?? 'flexible';
      lines.push(`  ${rule.name} [${rule.id}]`);
      lines.push(
        `     Enabled: ${rule.enabled}, Days: ${days}, Start: ${rule.startTime ?? 'unknown'}`
      );
    }
  }

  return lines.join('\n');
}

export function formatAlerts(alerts: Alert[]): string {
  if (alerts.length === 0) {
    return 'OK: no irrigation alerts';
  }

  return alerts
    .map((alert) => `${alert.severity.toUpperCase()} ${alert.code}: ${alert.message}`)
    .join('\n');
}
