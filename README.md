# Rachio Supervisor

Control and monitor Rachio irrigation systems via the Rachio API.

## Setup

1. Get your API key: Rachio app → Account Settings → API Access
2. Copy `.env.example` → `.env` and add your key
3. Install: `npm install`

## Commands

```bash
npm run dev status      # Show all devices, zones, current schedule
npm run dev zones       # List all zones with IDs
npm run dev schedules   # Show all schedule rules
npm run dev check       # Exit non-zero on critical irrigation alerts
npm run dev stop        # Stop all active watering
npm run dev schedule-start "<schedule-id-or-name>"  # Start a schedule manually
npm run dev schedule-skip "<schedule-id-or-name>"   # Skip the next schedule run
npm test                # Run offline unit tests
```

Schedule editing is intentionally app-first for now. The public API supports
safe operational controls such as start, skip, stop, and custom manual zone
queues; enable/disable/edit operations are underdocumented and should not be
automated until tested behind explicit guardrails.

## Planned

- Water usage reports (daily/weekly/monthly)
- Safe schedule review and guarded edit workflows
- Zone runtime overrides
- Camera integration (visual leak/problem detection)

## License

Apache-2.0. See [LICENSE](LICENSE).
