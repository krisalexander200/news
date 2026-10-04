# NewsDrip content rights audit

Audit date: October 3, 2026. Scope: all 25 configured source entries in server.js, web and mobile display behavior, and server-side headline rewriting. The developer confirms there are no separate publisher licenses or permissions. This is a documented terms-and-implementation audit, not a legal opinion about copyright exceptions or contract enforceability. A source marked unresolved is not proven prohibited, but is not cleared for release by this audit.

## Decision

No configured source is cleared here for NewsDrip's entire current combination of shared backend aggregation, rewritten headlines, feed-derived short summaries, and externally hosted images. Several have explicit incompatible restrictions; others require clarification or could not be verified. An available feed or API is not a blanket content license. A free app is not automatically a personal-use feed reader.

Do not submit an assertion to Apple that all content is licensed. Do not change production or submit a build as part of this audit. Existing pending implementation changes remain local per the developer's instruction.

## Actual usage reviewed

- The backend fetches preset feeds for all users, caches aggregated results, deduplicates stories, and distributes a shared feed.
- `tldrFrom` takes the first sentence of feed descriptions and truncates it to 18 words, or truncates the source headline to 14 words. These are feed excerpts, not independently reported summaries.
- `extractImage` obtains images from feed media, enclosures, or embedded description images. Clients display image URLs directly. Hotlinking does not establish image permission. The current payload does not track image rightsholders or license requirements.
- With OPENAI_API_KEY configured, source headlines are sent to OpenAI for a more dramatic rewrite. Repository support is established; production configuration was not inspected in this audit. This is inference/rewriting, not evidence of model training; terms prohibiting modification may still apply.
- TLDR mode hides source detail text while leaving headlines visible. Required prominent attribution may therefore be missing in that mode and at the featured headline.
- Article taps open source links. Linking does not establish permission for displaying the copied text or images before the tap.

## Source-by-source findings

Legend: **Restricted** = published terms contain restrictions incompatible with current usage absent broader permission. **Unresolved** = no verified grant covers current usage, including where access failed. **Conditional** = some reuse is described, but the app's exact use is not cleared.

The text, summary, image, and rewrite conclusions below are release recommendations based on the cited terms, not rulings about every possible statutory exception.

| Configured source | Feed route | Status and evidence | Headlines / summaries | Images | AI rewriting | Required next action |
|---|---|---|---|---|---|---|
| BBC | Direct BBC RSS | Unresolved current terms; official 2022 terms restrict business feed use and metadata and prohibit changing feeds in the personal website allowance. [Official dated terms](https://downloads.bbc.co.uk/usingthebbc/bbc_terms_of_use_31March2022english.pdf), section 15. Current terms page could not be fetched. | Do not treat website/social personal-use allowance as a grant for this app. | No general image grant established. | Modification conflicts with dated feed conditions. | Obtain current app-specific feed/metadata permission; verify imagery and edits separately. |
| CNN | Direct CNN RSS | Unresolved current terms. Official RSS page was robots-blocked. Historical official CNNMoney feed terms limit private noncommercial use and prohibit edits; not sufficient current evidence for CNN edition feed. [CNN RSS page](https://www.cnn.com/services/rss/), [historical official page archived by Library of Congress](https://webarchive-beta.loc.gov/playback-services/general/20161205184958mp_/money.cnn.com/services/rss/). | Current app redistribution grant not verified. | Not verified. | Not verified; historical restriction is adverse. | Request current RSS/app rights; do not rely on historic terms as clearance. |
| NPR | Direct NPR RSS | Unresolved; [official terms](https://www.npr.org/about-npr/179876898/terms-of-use) robots-blocked. A broadcaster mirror was found but not used as authoritative clearance. | Not verified. | Not verified. | Not verified. | Obtain official current terms or written permission for app distribution and edits. |
| NYTimes | Direct NYT RSS | Unresolved; [official RSS](https://www.nytimes.com/rss) and [official terms](https://help.nytimes.com/hc/en-us/articles/115014893428-Terms-of-Service) inaccessible. Search copies were not accepted as verified current permissions. | Not verified. | Not verified. | Not verified. | Ask NYT for app feed/redistribution rights. |
| DEADLINE | Direct Deadline RSS | Restricted under [PMC terms](https://www.pmc.com/terms-of-use), sections 3–4, 14 and 29, subject to any source-specific override. | Personal-use limit; distribution and modification require broader rights. | Image reuse/hotlinking restricted; Getty rights separately limited. | Editing/repurposing restriction applies to current rewrites. | Obtain written permission from the applicable rights holder or replace. |
| NEW YORK POST | Direct NYPost RSS | Unresolved; [publisher terms](https://nypost.com/terms/) inaccessible. Similar-domain or third-party copies were not used as substitutes. | Not verified. | Not verified. | Not verified. | Request app redistribution and image/editing rights. |
| Al Jazeera | Direct RSS | Restricted: [terms](https://terms.aljazeera.net/index.html), section 6, personal noncommercial access; reproduction, distribution and modification require prior written permission. | Broader permission needed for this shared app feed. | Permission needed; licensors may hold rights. | Modification/automated-use conditions require clearance. | Request written feed/app permission covering exact uses or replace. |
| HACKER NEWS | Direct HN RSS | Unresolved: [official API documentation](https://github.com/HackerNews/API) supports client access; [YC legal terms](https://www.ycombinator.com/legal/) reserve rights. API repository MIT license is not proven to license all submitted or linked content. | Client metadata use may be supportable; exact RSS redistribution scope unconfirmed. | No rights to images on linked publishers established. | No explicit grant established. | Clarify RSS/client title rights with HN; avoid borrowing article images or assuming the MIT code license covers content. |
| AGENCE FRANCE-PRESSE | Google News RSS search | Restricted: [AFP terms](https://www.afp.com/en/useful-links/terms-use), sections 2–3, limit unaltered extracts to specified private/educational uses; other distribution, modification and automated aggregation require consent. | Written permission needed for current use. | No blanket permission for included third-party material. | Modification/automation restrictions are adverse. | Obtain AFP rights covering app distribution and transformation or replace. |
| AP TOP | Google News RSS search | Unresolved exact feed grant; [AP content licensing](https://www.ap.org/content/) provides a licensing route. AP.org college subscriber terms are not a grant to NewsDrip; APNews general terms were inaccessible. | No verified app grant. | No verified app grant. | No verified grant. | Request an AP license matching the app; Google search results do not grant AP rights. |
| AP RADIO | Google News RSS search | Same AP evidence; configured route is a search for AP audio pages, not proof of licensed audio access. | No verified app grant. | No verified app grant. | No verified grant. | Include this entry in AP permission request; no audio redistribution rights inferred. |
| BLOOMBERG | Direct RSS | Restricted: [terms](https://www.bloomberg.com/tos), General Terms 2–3. | Personal-use restriction; broader display/distribution requires written permission. | Not cleared. | Not cleared. | Obtain permission or replace. |
| DEUTSCHE PRESSE-AGENTUR | Google News RSS search | Restricted: [dpa FAQ](https://www.dpa.com/en/faq), copyright section, requires permission for text, photos and graphics. | Permission required; no blanket snippet grant verified. | dpa/Picture Alliance permissions as applicable. | No editing grant established. | Contact internationalsales@dpa.com; specify iOS/web, snippets, images and edits. |
| DEUTCHE WELLE | Direct DW RSS | Conditional/unresolved: [German News Service](https://amp.dw.com/en/benefit-from-smart-content-made-in-germany/a-19470839) offers partner access; [B2B terms](https://b2b.dw.com/page/dw-terms-conditions) concern an audiovisual distribution platform, not a grant for this general RSS feed. | Exact general-feed app rights not established. | Not established for current feed. | Not established. | Ask gns@dw.com for app-specific RSS terms; potential partner route, not current clearance. |
| DRUDGE REPORT | FeedPress-hosted feed | Unresolved: [Drudge site](https://www.drudgereport.com/) supplies links; no applicable redistribution/editing grant located. Feed hosting itself supplies no demonstrated downstream publisher rights. | Ownership and feed authorization need clarification. | Underlying destination publisher rights not established. | No verified grant. | Verify feed operator authorization and applicable title rights; do not assume Drudge grants rights to linked articles. |
| INTERFAX | Google News RSS search | Unresolved: [terms-and-conditions page](https://interfax.com/terms-and-conditions/) retrieved mainly privacy/service processing provisions, not a usable redistribution grant. | Not verified. | Not verified. | Not verified. | Request news syndication/app terms, not fax-service terms from unrelated Interfax domains. |
| ITAR-TASS | Direct TASS RSS | Restricted for current use: [terms](https://tass.com/terms-of-use), sections 3–4, allow limited noncommercial text use under conditions but prohibit free-use revisions and restrict redistribution/database uses. | Conditional text-only use; app attribution, excerpt limits and scope not established as compliant. | Separate permission needed. | Free-use revisions prohibited. | Obtain permission for exact app use or replace; do not treat limited text allowance as whole-feed clearance. |
| KYODO | Google News RSS search | Unresolved; [actual publisher](https://english.kyodonews.net/) robots-blocked. kyodonews.org result describes another operator and was excluded. | Not verified. | Not verified. | Not verified. | Request terms from the actual Kyodo agency/operator. |
| MCCLATCHY [DC] | Google News RSS search | Restricted: [McClatchy terms](https://mcclatchy.com/terms-of-service), effective April 14, 2026, sections 4.1–4.4. Feed allowance is for a personal website/blog; redistribution and edits need permission. | Native shared feed is not established as within personal-site allowance. | No general image grant; third-party content may need separate clearance. | Modification and AI derivative-use restrictions expressly included. | Request republication/app rights through McClatchy; verify third-party rights separately. |
| NHK | Direct NHK RSS | Unresolved; [NHK rules](https://www.nhk.or.jp/rules/) inaccessible. The configured feed is Japanese; English filtering may discard entries, but filtering is not rights clearance. | Not verified. | Not verified. | Not verified. | Obtain correct NHK feed/app terms or exclude source. |
| PRAVDA | Google News RSS search | Conditional/unresolved: [English publisher footer](https://english.pravda.ru/) requires a hyperlink for reproduction; configured search targets pravda.ru and can return other language/site material. No full app/image/editing grant verified. | Attribution condition found; exact grant and domain scope unclear. | Not verified. | Not verified. | Clarify actual publisher/domain, app use, imagery and edits in writing. |
| PRESS TRUST INDIA | Google News RSS search | Unresolved: [PTI website](https://www.ptinews.com/) returned no usable terms; no authoritative app grant located. | Not verified. | Not verified. | Not verified. | Request PTI syndication/app permission. |
| REUTERS POLITICS WORLD | Google News RSS search | Unresolved exact free feed grant; [Reuters licensing](https://reutersagency.com/license-reuters-content/) offers licensing, not permission to NewsDrip. | No verified app grant. | No verified grant. | No verified grant. | Request license specifying app/Web, distribution, caching and transformations. |
| XINHUA | Direct Xinhua RSS | Unresolved: [publisher site](https://english.news.cn/) reserves rights; no applicable public RSS reuse grant located. | Not verified. | Not verified. | Not verified. | Ask Xinhua for applicable feed/app permission. |
| YONHAP | Direct Yonhap RSS | Unresolved: [publisher](https://en.yna.co.kr/) robots-blocked; no authoritative applicable grant verified. | Not verified. | Not verified. | Not verified. | Request Yonhap redistribution, image and editing permissions. |

## Intermediary rights

Google News search feeds account for 10 configured entries. Google's [terms](https://policies.google.com/terms?hl=en-US), Content in Google services, explicitly distinguish other organizations' content and require their permission or another lawful basis. These feeds do not establish a sublicense to AP, Reuters, AFP, dpa, or other publishers. Checking Google terms does not substitute for checking the original publisher.

FeedPress hosting likewise is not evidence that the Drudge feed operator can sublicense content or that destination publishers permit reuse. NewsDrip is not cleared just because the FeedPress URL responds.

## Recommended remediation, prepared but not implemented

1. Replace the preset source pool with an allowlist of sources whose written/public terms explicitly cover this app's use. Exclude unresolved sources until cleared. Keep a copy/date of every applicable grant.
2. Disable third-party images unless an image-specific license or provider agreement covers display, attribution, territory and duration. Do not extract arbitrary image URLs as a substitute for rights metadata.
3. Disable headline rewriting unless permissions expressly cover modifications and sending source text to an AI service. Public API access and attribution do not establish this right.
4. Preserve unmodified source titles and permitted feed excerpts where required; do not assume truncation or paraphrasing eliminates permissions questions.
5. Show publisher attribution and a source article link in every display mode, including the featured headline and TLDR mode. Meet each provider's specified attribution placement and branding requirements.
6. For a low-budget launch, investigate a smaller pool with explicit syndication or open-content terms. Audit candidates before replacing feeds. DW partner content may be worth exploring; it is not cleared by this audit. An API subscription must expressly include downstream app display and any images/rewrites; API access alone is insufficient.
7. If intending to rely on statutory exceptions rather than permission, obtain a qualified assessment for the exact jurisdictions and usage. This audit does not determine fair use or similar exceptions.

## Permission request draft — not sent

Subject: Permission for NewsDrip iOS and web news discovery app

Hello,

I develop NewsDrip, a news discovery app. Please confirm whether you permit it to fetch your feed through a shared backend and display source headlines, short feed excerpts and links to original articles in an iOS app and website. Please specify required attribution, caching limits, territory, duration, permitted audience size, and fees, if any.

Please separately confirm whether the permission includes feed-supplied photographs/thumbnails and their required credits, and whether we may send source headlines to an AI service for rewriting and display the rewritten versions. If those uses are excluded, please identify the permitted text-only, unmodified alternative. Please confirm coverage for third-party or agency materials included in your feed.

The current app has no account registration, paid features or in-app purchases. Please specify any restrictions that would apply if advertising or paid features were introduced later.

Thank you.

## App Review handling

Apple's [guidelines 5.2.1–5.2.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property) require appropriate rights and compliance with third-party service terms. The actual rejection is still Guideline 2.1 information needed, not a specific finding of infringement. Do not overstate that Apple rejected the app for licenses.

Developer confirmed no separate licenses. Section 6 of the response must remain incomplete until a substantiated rights explanation exists. Do not state that permissions were obtained, sources were removed, images were disabled or all rights are covered unless that work is actually completed and verified. If remediation is chosen, it may require changing the submitted app/backend before approval; the previous hold on deploying changes must be addressed with the developer first.

## Verification limits

Live publisher terms were attempted using web search and direct opens. Some were blocked or inaccessible, and some search results were unrelated domains or third-party mirrors. These were recorded as unresolved rather than used as clearance. BBC's retrieved official document is dated 2022; CNN evidence is historical. Current terms must be obtained before relying on them. This audit inventories configured sources, not whether each supplied an item to the live service today. Production environment, all individual image origins, and the exact submitted binary were not inspected. No publisher contacted; no fees agreed; no permissions accepted; no production changes made.

## Remediation implementation — October 3, 2026

The developer authorized remediation after the earlier deployment hold. The revised allowlist uses Global Voices original headlines under its published CC BY 3.0 policy and Wikinews text under its date-specific CC BY licenses. All 25 legacy source routes, summaries, image extraction, and AI rewriting were removed. Source/author credits, original links, and license links now appear in both display modes. Guest and visibly restricted Global Voices items are excluded. Wikinews is now archived; a 30-day freshness rule excludes its current inventory. This means the verified current feed has eight Global Voices items, not 25 publishers.

Content policy tests and a live source check passed. iOS bundle export passed before the final freshness/topic refinements; repeat export before build. Signed build, deployed production behavior, physical-device recording, and App Store metadata still require completion. The audit does not assert blanket clearance for every third-party work on a source website. No publishers were contacted and no private agreements were obtained.
