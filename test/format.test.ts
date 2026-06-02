import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatAlerts,
  formatSchedules,
  formatStatus,
  formatWateringReview,
  formatZones,
} from '../src/format';
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
            summary: 'Every Monday and Wednesday at 5:00 AM',
            totalDuration: 600,
            etSkip: true,
            zones: [
              {
                zoneId: 'zone-1',
                duration: 600,
                sortOrder: 1,
              },
            ],
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
    const schedules = formatSchedules(snapshot);
    assert.match(schedules, /Morning \[sched-1\]/);
    assert.match(schedules, /Summary: Every Monday and Wednesday at 5:00 AM/);
    assert.match(schedules, /Total: 10min/);
    assert.match(schedules, /Weather skip: on/);
    assert.match(schedules, /Z1 Citrus: 10min/);
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

  it('formats a recent watering health review', () => {
    const review = formatWateringReview({
      days: 2,
      startTs: 0,
      endTs: 1,
      devices: [
        {
          device: { id: 'dev-1', name: 'Front Controller' },
          startTs: 0,
          endTs: 1,
          eventCount: 4,
          wateringEventCount: 2,
          completedZoneRuns: 1,
          stoppedZoneRuns: 0,
          startedZoneRuns: 1,
          completedScheduleRuns: 1,
          estimatedWateringMinutes: 12,
          weatherSkipCount: 1,
          weatherNotSkippedCount: 1,
          seasonalAdjustmentCount: 0,
          recentWateringSummaries: ['Citrus completed watering for 12 minutes.'],
          recentNonWateringSummaries: ['Morning was not skipped because weather looked fine.'],
          notes: [],
        },
      ],
    });

    assert.match(review, /Watering health review: last 2 days/);
    assert.match(review, /Watered: 1 completed zone run\(s\), 12 estimated min/);
    assert.match(review, /no obvious watering-health issues/);
    assert.match(review, /Citrus completed watering/);
  });
});
