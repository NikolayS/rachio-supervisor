import type { Alert, IrrigationSnapshot, WateringReview } from './types';

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
    const zonesById = new Map(device.zones.map((zone) => [zone.id, zone]));

    lines.push(`Device: ${device.name}`);
    for (const rule of device.scheduleRules) {
      const days = rule.days?.join(', ') ?? 'flexible';
      const summary = rule.summary ?? `${days}, start ${rule.startTime ?? 'unknown'}`;
      const totalMinutes = rule.totalDuration
        ? `${Math.round(rule.totalDuration / 60)}min`
        : 'unknown duration';
      const weatherSkip = rule.etSkip === undefined || rule.etSkip === null
        ? 'unknown'
        : rule.etSkip
          ? 'on'
          : 'off';

      lines.push(`  ${rule.name} [${rule.id}]`);
      lines.push(
        `     Enabled: ${rule.enabled}, Summary: ${summary}, Total: ${totalMinutes}, Weather skip: ${weatherSkip}`
      );

      const zoneRules = [...(rule.zones ?? [])].sort(
        (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
      );

      for (const zoneRule of zoneRules) {
        const zoneId = zoneRule.zoneId ?? zoneRule.id;
        const zone = zoneId ? zonesById.get(zoneId) : undefined;
        const duration = zoneRule.duration
          ? `${Math.round(zoneRule.duration / 60)}min`
          : 'unknown';
        const order = zoneRule.sortOrder ? `${zoneRule.sortOrder}. ` : '';
        lines.push(
          `       - ${order}Z${zone?.zoneNumber ?? '?'} ${zone?.name?.trim() ?? zoneId ?? 'unknown zone'}: ${duration}`
        );
      }
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

export function formatWateringReview(review: WateringReview): string {
  const lines: string[] = [
    `Watering health review: last ${review.days} day${review.days === 1 ? '' : 's'}`,
  ];

  for (const deviceReview of review.devices) {
    lines.push('');
    lines.push(`Device: ${deviceReview.device.name}`);
    lines.push(
      `  Events: ${deviceReview.eventCount} total, ${deviceReview.wateringEventCount} watering`
    );
    lines.push(
      `  Watered: ${deviceReview.completedZoneRuns} completed zone run(s), ${Math.round(deviceReview.estimatedWateringMinutes)} estimated min`
    );
    lines.push(
      `  Schedules: ${deviceReview.completedScheduleRuns} completed, ${deviceReview.weatherSkipCount} weather skip(s), ${deviceReview.weatherNotSkippedCount} not-skipped weather check(s)`
    );

    if (deviceReview.notes.length === 0) {
      lines.push('  Notes: no obvious watering-health issues');
    } else {
      lines.push(`  Notes: ${deviceReview.notes.join('; ')}`);
    }

    for (const summary of deviceReview.recentWateringSummaries.slice(0, 3)) {
      lines.push(`  - ${summary}`);
    }

    for (const summary of deviceReview.recentNonWateringSummaries.slice(0, 2)) {
      lines.push(`  - ${summary}`);
    }
  }

  return lines.join('\n');
}
