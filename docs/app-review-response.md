# NewsDrip — App Review response draft

Do not send until the replacement signed build is selected, deployed behavior is verified, and the physical-device recording is attached. This response describes the revised implementation, not rejected build 8.

Hello App Review,

Thank you for reviewing NewsDrip. Below is the requested information.

## 1. Physical-device demonstration

Device provided by developer: iPhone 17 Pro, iOS 27.2. Supplied Settings screenshots show Software Update reporting “iOS is up to date”; the selected update channel is iOS 27 Developer Beta. This confirms the displayed device/OS configuration, not completed app testing or the latest public release.

[PENDING: replacement-build recording URL or attachment, build number, and successful physical-device testing. Describe the actual tested OS accurately when submitting.]

## 2. Purpose and audience

NewsDrip helps readers discover independently published news by scanning original headlines grouped by topic. Readers can switch between compact headlines and publication details, open the original article, and refresh the feed. Source credits and license links remain visible in both display modes.

## 3. Setup and features

An internet connection is required. No account, credentials, subscription, payment, or sample files are needed. Launch the app, scroll through topic sections, toggle TLDR to change display density, tap a headline to open its original website, return to NewsDrip, and pull down to refresh. Sources & licenses and Privacy policy are available at the bottom of the feed.

There is no registration, login, account deletion, user-generated content, or in-app purchase. External websites have their own access conditions.

## 4. External services

The app uses Expo / React Native and an HTTPS Node backend hosted on Render at https://news-8ih0.onrender.com. The backend retrieves eligible Global Voices RSS headlines and queries the Wikinews public API. Wikinews is now an archive; its articles are excluded when older than 30 days, so currently it contributes no headlines. Global Voices supplies the current feed. Stories are deduplicated and cached for three minutes. Article text, excerpts, and photographs are not reproduced. No AI service is used. No advertising, account service, or payment processor is integrated.

## 5. Regions

The same English-language feed and features are provided across regions. NewsDrip does not request device location or select content by location. External website availability can vary.

## 6. Content authorization

The revised build uses original headlines with author/source credit, direct article links, and applicable Creative Commons license links. It relies on published reuse licenses rather than separate private publisher agreements.

Global Voices-created content is licensed under CC BY 3.0 unless otherwise stated. Guest and visibly restricted partner entries are excluded; no third-party media are included. Policy: https://globalvoices.org/about/global-voices-attribution-policy/ . License: https://creativecommons.org/licenses/by/3.0/ .

Wikinews text created from December 16, 2024 is CC BY 4.0; eligible earlier text from September 25, 2005 is CC BY 2.5. The backend verifies the creation revision and attaches the applicable license. Policy: https://en.wikinews.org/wiki/Wikinews:Copyright . Current freshness filtering excludes its archived stories.

Headline wording is preserved; feed markup is converted to plain text. Credits and license links remain visible in both modes. The prior unverified publisher feeds, image reproduction, feed summaries, and AI headline rewriting have been removed from the release pipeline. Public source documentation is at https://news-8ih0.onrender.com/content-sources .

Thank you.

## Device recording checklist

Use the replacement TestFlight build, not rejected build 8 or a simulator. Begin on the Home Screen, launch NewsDrip, let headlines load, scroll, toggle TLDR, open an original article, return, and pull down to refresh. Include device model, iOS version, and build number. A continuous 30–45 second recording should cover these flows. Share a review-accessible link if attachment size is a problem.

The previously supplied 7.38-second clip shows the old app already open and article navigation. It does not establish launch, display toggling, return, refresh, current build, or device/OS details.

## Shared recording inspection — October 4, 2026

Developer provided https://photos.icloud.com/shared/album/0542IGMhnTCpCCdozCGMXRlbw . The album was accessible without signing in and displayed one video of approximately 43 seconds, with expiration November 3. Browser player reports 43.14 seconds. Download attempts did not complete; inspection used the browser player.

Observed: recording begins on the iPhone Home Screen; NewsDrip is visible by approximately three seconds in detailed mode, and later appears in compact mode. TASS and BBC source pages load, and NewsDrip is visible again at the end. A pull-to-refresh interaction was not verified. No build number is shown. The video contains the legacy publisher feeds and excerpts, so it does not verify the revised attribution-only implementation or replacement signed build. Retain it as evidence of the existing app flow; do not label it as the new build demonstration.
