# NewsDrip resubmission readiness

Status: prepared locally; not ready to resubmit.

## Verified on October 3, 2026

- All 25 legacy publisher routes inventoried in content-rights-audit.md.
- Original-headline pipeline with author/source/article/license attribution implemented in web and iOS source.
- Article images, snippets, and AI rewriting removed.
- Related headlines require substantial original-title overlap.
- Topic matching uses word boundaries; current feed excludes articles older than 30 days.
- Eight content-policy tests passed; live check returned eight Global Voices headlines without source errors.
- Web feed and display toggle checked in browser; attribution remains visible.
- Final iOS JavaScript bundle exported successfully. This is not a signed binary or physical-device test.

## Required before resubmission

1. Complete Expo CLI browser authentication on the build computer.
2. Build a new signed production iOS binary, with a build number newer than 8.
3. Coordinate backend deployment with the replacement build. Rejected build 8 lacks the revised permanent attribution; verify compatibility before switching production content.
4. Verify production health, real headlines, source/license page, refresh, source links, and graceful failure states.
5. Upload the signed build to TestFlight and test on a physical iPhone on the latest OS. Test supported iPad layout as well.
6. Capture replacement screenshots and the continuous physical-device video; provide device model, OS, and build number.
7. Replace inaccurate store claims about summaries/AI/photos; select the replacement build and complete App Review Notes and reply using app-review-response.md.
8. Check store territory, age rating, privacy answers, and metadata against actual release behavior. Submit only after these checks are complete.

## Proposed store description

NewsDrip helps you discover independent reporting through a compact feed of original headlines. Browse stories by topic, switch display density with TLDR, and open the original publisher website to read more. Pull down to refresh.

Each headline includes author and publisher credit, a source link, and its applicable reuse license. The current feed uses eligible Global Voices reporting. NewsDrip does not reproduce article photographs or full text. No NewsDrip account or subscription is required. Publisher websites have their own privacy and access conditions.

## Outstanding access

The existing Expo CLI account is logged out. Browser login was opened on the build computer; the developer is currently on a phone. No production deployment, TestFlight upload, App Review message, or resubmission has been performed in this remediation pass.

## Device details supplied

Developer screenshots identify an iPhone 17 Pro running iOS 27.2. Software Update reports it is up to date on the selected iOS 27 Developer Beta channel. Do not infer that this establishes the latest public release or successful testing of the replacement build. No device name or serial number is needed in review documentation.

## Shared video received October 4

The developer supplied an anonymously accessible iCloud album with a 43.14-second current-app recording: https://photos.icloud.com/shared/album/0542IGMhnTCpCCdozCGMXRlbw . The album displays expiration November 3. Home Screen, both display modes, external source pages, and return to NewsDrip were observed. Refresh and exact build number remain unverified. The clip displays legacy feeds, so a final recording of the replacement build is still pending.
