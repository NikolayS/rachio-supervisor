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
npm run dev stop        # Stop all active watering
```

## Planned

- Water usage reports (daily/weekly/monthly)
- Schedule enable/disable
- Zone runtime overrides
- Camera integration (visual leak/problem detection)
