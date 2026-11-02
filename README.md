# PhD Compass — private personal research tracker

A free, mobile-first web app (PWA) created from your November 2026 PhD research spreadsheet.

## What's included

- 30 calendar dates preloaded for November 2026
- 92 scheduled research, ML/DL, lab/class and fitness activities
- 18 research milestones for ACEdge-Hampel, dynamic missing-value handling and optimal sensor placement
- 25 Python/ML course lessons (included among the 92 activities)
- Daily checklist and notes, progress charts, editable activities and actual-time logging
- Custom milestones, lessons, class sessions and tasks
- Local JSON backup/restore; CSV export for Google Sheets; `.ics` calendar export for Google Calendar
- No subscription, ads, account or third-party analytics

## Fast preview (no setup)

Open the separate file `PhD_Compass_Open_Directly.html` in a modern browser. It is a one-file version of the app. Browser behavior for local HTML files varies; **save a JSON backup** before clearing data or switching devices.

## Install on a phone as an app

This folder is an installable **Progressive Web App**. To install it, it must be hosted on HTTPS (or localhost for testing). It is not an Android APK or iOS App Store binary.

1. Extract the ZIP and keep the files together. `index.html`, `app.js`, `style.css`, `seed.js`, `manifest.webmanifest`, `service-worker.js`, and the `icons` directory should be in one directory.
2. Publish these files on any HTTPS static host (for example, GitHub Pages or a static-site host). For GitHub Pages, place all app files in the repository root and enable Pages for your branch. **Note:** a public repository makes the preloaded schedule and source code public; your later personal progress remains only in your browser unless you export it.
3. Open your deployed HTTPS app URL in **Chrome on Android**. Use the browser menu and choose **Install app** or **Add to Home screen**.
4. On **iPhone**, open the HTTPS URL in **Safari**, tap **Share**, then **Add to Home Screen**.
5. Open the app once while online after publishing; the service worker caches the app files for subsequent offline use.

## Using the app

- **Today:** check off activities and use `•••` to add actual minutes and research notes.
- **Calendar:** navigate dates, see completion indicators and add a class or an experiment.
- **Projects:** update research milestones, expected outputs and evidence links.
- **Learning:** mark Python/ML lessons complete and save notebook references.
- **Insights:** view completed activities and recorded research/learning time.
- **Settings:** export/restore your JSON backup; export tasks/milestones CSV; export `.ics` events for Google Calendar.

### How backup and synchronization work

Your progress is saved in **browser localStorage on the current device and browser**. It is not synchronized automatically to Google Sheets, Calendar or other devices. Use **Settings > Download backup (.json)** regularly, then **Settings > Restore backup** on another device if needed. CSV and calendar exports are one-way manual files.

Import the `.ics` file via your calendar app's *Import calendar* functionality. It contains planned November sessions with 10-minute reminders. Existing events are not read or checked; importing the file more than once can create duplicates in some calendars.

## Privacy and limits

- No backend, signup, paid API, cloud storage or telemetry.
- Browser storage can be cleared by browser privacy settings or device cleanup.
- Notifications are provided **only** through imported calendar events (the PWA itself does not send push notifications).
- Schedule and course topics are editable. After November 2026, add tasks for subsequent months; no further month is pre-populated.
- This is a functional personal PWA, not an APK/IPA and not a Google Sheets live integration.

## Files

`index.html` entrypoint; `style.css` design; `app.js` logic; `seed.js` data imported from spreadsheet; `manifest.webmanifest` install metadata; `service-worker.js` offline caching; `icons/` app icons.
