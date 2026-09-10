# Section X Live Audio Architecture

## Goal

Allow approved Section X contributors to broadcast audio-only game coverage directly from a phone while fans listen on the Section X Scoreboard website.

The product must remain portable. Cloudflare RealtimeKit is the first live-audio provider, not a permanent dependency of the application model.

## Architecture

```text
Mobile broadcaster / listener
          |
          v
      Section X UI
          |
          v
   Section X API/service layer
       |             |
       v             v
 Broadcast DB     LiveAudioProvider
   repository          |
       |               v
       v        CloudflareRealtimeKitProvider
      D1               |
                       v
               Cloudflare RealtimeKit
```

Application code should depend on `LiveAudioProvider`, never directly on RealtimeKit outside the provider adapter.

## Core data model

- `broadcasts`: one game may have one or more historical broadcasts.
- `broadcast_assignments`: Section X-owned permissions for producers and broadcasters.
- `broadcast_participant_sessions`: lightweight listener/publisher join history.
- `broadcast_events`: provider-neutral operational log.

Provider-specific IDs are stored only as generic `provider_*` fields.

## Roles

Application roles and media permissions are separate concerns.

Section X assignment roles:

- `producer`
- `broadcaster`
- `color`
- `sideline`
- `scorekeeper`

Realtime media roles:

- `publisher`: microphone publishing enabled
- `listener`: receive audio only, no microphone publishing

## Cloudflare setup

Create one RealtimeKit app and two reusable Voice presets:

### `section-x-broadcaster`

- Meeting type: Voice
- Can publish audio: yes
- Camera/video: disabled
- Screen sharing: disabled
- Chat/polls/reactions: disabled unless later intentionally enabled
- Kick participant permission: producer/admin only if using client-side end-session controls

### `section-x-listener`

- Meeting type: Voice
- Can publish audio: no
- Receive audio: yes
- Camera/video: disabled
- Screen sharing: disabled

Required Worker secrets/environment values:

```text
CLOUDFLARE_ACCOUNT_ID
REALTIMEKIT_APP_ID
REALTIMEKIT_API_TOKEN
REALTIMEKIT_PUBLISHER_PRESET=section-x-broadcaster
REALTIMEKIT_LISTENER_PRESET=section-x-listener
```

The API token must remain server-side and needs Realtime or Realtime Admin permission.

## Broadcast lifecycle

1. Admin creates/enables a broadcast for a game.
2. Backend creates the provider meeting and stores the provider session/meeting ID.
3. Broadcaster authentication resolves to an internal Section X `subject_id`.
4. Backend verifies an active broadcast assignment.
5. Backend creates a RealtimeKit participant using the broadcaster preset and returns only the participant token to the browser.
6. Browser initializes the RealtimeKit Core SDK with audio enabled and video disabled.
7. Broadcaster performs mic check and presses Go Live.
8. Public listener endpoint creates anonymous/ephemeral listener participants using the listener preset.
9. Fans receive audio in the website player without an account.
10. End Broadcast kicks active participants and marks the RealtimeKit meeting inactive.
11. Section X marks the broadcast ended and writes an operational event.

## Phone microphone support

The web UI should use standard browser media-device discovery and RealtimeKit device selection. Any microphone exposed by the phone/browser can be used, including the phone microphone and compatible wired, USB-C, or Bluetooth audio interfaces.

The broadcaster console must include:

- microphone permission state
- selected microphone
- live input level meter
- network/connection state
- Go Live / Mute / End controls
- elapsed time
- listener count when available
- strong reconnect behavior when mobile service changes

## Security

- Never expose the Cloudflare API token to the browser.
- Broadcaster participant tokens are issued only after server-side authorization.
- Public listeners receive listener-only presets.
- Finished meetings are made inactive so old participant tokens cannot restart a broadcast.
- Broadcast roles live in Section X data, not in an auth vendor's role table.
- Rate-limit listener token issuance before public launch.

## Portability rules

1. TypeScript application logic must depend on interfaces, not Cloudflare APIs.
2. Use standard SQL/SQLite-compatible schema where possible.
3. Keep provider-specific metadata behind generic provider fields.
4. Auth resolves to an application-owned `subject_id`.
5. Storage, live audio, database and notification integrations use adapters.
6. Public API response shapes must remain Section X-owned and provider-neutral.

A future provider replacement should require a new `LiveAudioProvider` implementation, not a rewrite of game pages or broadcast UI.

## Delivery phases

### Phase 1

- D1 schema
- provider abstraction
- RealtimeKit backend adapter
- Cloudflare app/preset configuration

### Phase 2

- `/broadcast` mobile console
- mic selector and level meter
- authenticated publisher-token endpoint
- Go Live / Mute / End controls

### Phase 3

- public Listen Live player
- live badges on game cards and game pages
- anonymous listener-token endpoint
- listener count

### Phase 4

- optional recording/archive
- multiple broadcasters
- producer controls
- analytics and health dashboard
- automated recovery/reconnect telemetry
