# STM MEXA mobile

The Expo app shares the web app's brand gradient, Ubuntu typeface, card colours,
status colours and light/dark palette. Appearance supports Light, Dark and System
and remembers the choice on the device.

Profile opens from the top-right account avatar on the main screens and machine
detail. Its back action returns to the previous screen; Profile is no longer a
bottom tab.

The Shop Floor list loads six machines at a time through the shared `/dashboard`
API. Scrolling near the bottom appends the next six, with a loading indicator
and retry on failure. A Load more button also supports accessible/manual loading
if live changes produce an overlapping page. Pull-to-refresh, search or a status
change starts again from the first six. Background refresh and live subscriptions cover visible
cards, so scrolling through a large fleet does not subscribe to every machine.
The web Live Dashboard keeps its existing six-card pagination.

## Company AI

The AI tab uses the existing authenticated backend `/assistant/status` and
`/assistant/chat` APIs. It appears only when:

- S&T Super Admin explicitly grants the company `page:assistant:view`.
- The person is a company admin or their role also holds that permission.
- The backend reports that the assistant is enabled for the company.

Removing the company/role grant or setting the company's AI allowance to zero
hides the tab, cancels pending chat work and clears the conversation. The setting
is checked on app foreground/return, when opening AI, and once per minute while
the main screens are active. Existing authorization refresh/socket revocation
also updates permission changes. Using up today's allowance keeps the AI tab and
shows its reset time; it does not mean Super Admin turned the feature off.

Chat history stays in session memory and is cleared on sign-out, company/plant
change or access revision changes. The mobile app uses the same company-scoped
backend answers, signed history, report sources and daily limits as the web app.
No provider key is stored in the mobile bundle. Source cards identify the report
and filters; web-only report opening/downloading is not offered as a mobile action.

## Verify and run

Use Node.js 22.13 or newer, matching Expo SDK 57, then:

```sh
npm ci
npm run typecheck
npm test
npm start
```

The API is configured through `EXPO_PUBLIC_API_BASE_URL` for builds or
`expo.extra.apiBaseUrl` in `app.json` for local development. The Expo web preview
uses localStorage for development fixtures; installed native apps use SecureStore.
