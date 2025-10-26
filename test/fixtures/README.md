# PipeWire Test Fixtures

These fixtures contain real `pw-dump` outputs captured in different microphone usage scenarios.

## Captured Fixtures

- **idle.json** - No microphone in use
- **mic-active-single.json** - One application using microphone (Zen browser)
- **mic-active-multiple.json** - Multiple applications using microphone (Zen + Helium)

## How to Recapture

Use the `capture-fixtures.ts` script in this directory:

```bash
bun test/fixtures/capture-fixtures.ts
```

The script will **automatically**:

1. Capture idle state (no microphone usage)
2. Start `arecord` and capture single mic usage
3. Start a second `arecord` and capture multiple mic usage
4. Kill all `arecord` processes
5. **Filter** fixtures to only include relevant PipeWire objects (mic streams + Core object)
6. **Sanitize** personal information (usernames, hostnames)

## Manual Capture

If you need to capture manually:

```bash
# 1. Idle state (no microphone usage)
pw-dump | jq -c '.' > test/fixtures/idle.json

# 2. Single app using microphone
# Start an app with mic access, then:
pw-dump | jq -c '.' > test/fixtures/mic-active-single.json

# 3. Multiple apps using microphone
# Start a second app with mic access, then:
pw-dump | jq -c '.' > test/fixtures/mic-active-multiple.json
```

## Verifying Fixtures

After capturing, verify the fixtures contain the expected streams:

```bash
# Should show no Stream/Input/Audio
jq '.[] | select(.info?.props?."media.class" == "Stream/Input/Audio")' test/fixtures/idle.json

# Should show one Stream/Input/Audio
jq '.[] | select(.info?.props?."media.class" == "Stream/Input/Audio")' test/fixtures/mic-active-single.json

# Should show multiple Stream/Input/Audio entries
jq '.[] | select(.info?.props?."media.class" == "Stream/Input/Audio")' test/fixtures/mic-active-multiple.json
```
