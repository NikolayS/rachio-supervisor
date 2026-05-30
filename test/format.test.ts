import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatAlerts, formatSchedules, formatStatus, formatZones } from '../src/format';
import type { IrrigationSnapshot } from '../src/types';

const snapshot: IrrigationSnapshot = {
  account: { username: 'nik', email: 'nik@example.com' },
  devices: [
    {
      device: {
        id: 'dev-1',
        name: 'Front Controller',
        model: 'Gen 3',
        status: 'ONLINE',
        zones: [{ id: 'zone-1', zoneNumber: 1, name: 'Citrus', enabled: true }],
        scheduleRules: [
          {
            id: 'sched-1',
            name: 'Morning',
            enabled: true,
            days: ['MONDAY', 'WEDNESDAY'],
            startTime: '05:00',
          },
        ],
      },
      currentSchedule: {
        status: 'PROCESSING',
        zoneNumber: 1,
        remainingDuration: 600,
      },
    },
  ],
};

describe('formatters', () => {
  it('formats status for humans without needing API calls', () => {
    const status = formatStatus(snapshot);

    assert.match(status, /Account: nik/);
    assert.match(status, /Front Controller/);
    assert.match(status, /Running: Zone 1/);
  });

  it('formats zone and schedule listings as stable tabular text', () => {
    assert.equal(
      formatZones(snapshot),
      'Front Controller\t1\tCitrus\tzone-1'
    );
    assert.match(formatSchedules(snapshot), /Morning \[sched-1\]/);
  });

  it('formats an OK check and alert list', () => {
    assert.equal(formatAlerts([]), 'OK: no irrigation alerts');
    assert.equal(
      formatAlerts([
        {
          severity: 'critical',
          code: 'device_offline',
          message: 'Front Controller is OFFLINE',
        },
      ]),
      'CRITICAL device_offline: Front Controller is OFFLINE'
    );
  });
});
