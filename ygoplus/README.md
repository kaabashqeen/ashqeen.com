# YGOPlus

An independent Yu-Gi-Oh! web application connecting deck building, opening-hand probability analysis, and interactive combo boards.

## View this portfolio

Open `index.html` directly in a browser, or serve this directory with a static HTTP server. The portfolio needs no database, secrets, accounts, package installation, or paid application server. All media uses relative local paths. The folder can be placed on static hosting independently of the full application.

The walkthrough is assembled from earlier product recordings. October 2026 screenshots show public examples. Card artwork is third-party game material, not original project artwork.

## Application capabilities

- Search and organize card collections into deck lists with role annotations.
- Import/export decks; inspect sample hands and basic opening-hand probabilities.
- Run Monte Carlo simulations for configurable hand conditions.
- Build, save, search, and replay interactive boards connected to decks.
- Manage content visibility and user accounts.
- Offer optional Supporter subscriptions through Stripe, with server-side resource limits.

Boards document user-authored sequences; they do not automatically validate all game rules.

## Architecture

| Layer | Implementation |
| --- | --- |
| Web application | Python, Flask, server-rendered templates and JavaScript |
| Persistence | PostgreSQL / SQLAlchemy |
| Execution | Gunicorn on Render; multiple application workers |
| Card media | Cloudflare R2, with a local-image fallback |
| Billing | Stripe Checkout, webhook handling and customer portal |
| Resource protection | Database-backed counters, role budgets and a PostgreSQL advisory lock |

The application repository contains `app.py`, route modules, `models.py`, `templates/`, `static/`, and focused regression tests in `dev_tests/`. This portfolio folder is a standalone presentation, not the complete application source distribution.

## Selected engineering work

### Memory footprint

The card search index retained fields it never needed. Removing that nested data reduced median RSS in three isolated local Python 3.13 measurements from **186.53 MiB to 149.75 MiB (19.7%)**. Response comparisons checked **15,220 outputs**. This is a local component benchmark, not a production-wide memory result.

### Media delivery

Seven original showcase recordings totaled **227,829,956 bytes**; compressed MP4 versions totaled **8,213,104 bytes**, a **96.4% reduction**. Lazy image posters and click-to-play behavior replaced automatic playback. The portfolio montage is a separate export. Reduced asset size is not the same as a measured reduction in hosting bills.

### Resource controls

Free Monte Carlo runs use 1,537 iterations; Supporter precision runs use 38,416. These are configured sample counts, not guarantees of accuracy for every rare event. Request bursts, daily budgets and a cross-worker simulation lock constrain server load. Tests exercised shared counters and concurrent requests against PostgreSQL.

### Billing and access

The membership model was consolidated into Free and optional Supporter access. Core content tools remain available with appropriate account verification and resource limits. Checkout and webhook handling guard against duplicate subscriptions and inconsistent customer state. Test-mode purchase/cancellation flows were exercised; live charges were not used for validation.

## Validation record

Recent changes were checked using focused regression suites, PostgreSQL concurrency tests, Stripe test-mode flows, and desktop/mobile browser checks. The latest homepage release passed 15 focused tests and production asset/destination checks. This does not establish comprehensive coverage or high-volume production performance.

## Outcomes and limitations

The application was deployed and maintained, but did not establish a sustainable paying audience. The case study therefore emphasizes shipped functionality, engineering decisions and measured improvements. No adoption, revenue or scaling results are claimed.

The next product iteration would begin with a narrower user problem and early feedback. Current board replay is a documentation tool, and the card dataset requires ongoing maintenance.

## Rights and source availability

Yu-Gi-Oh! images, card text and related materials belong to their respective rights holders. This project is not affiliated with Konami. Do not assume the accompanying media or game dataset is covered by an open-source license.

Production backups, user records, credentials and repository history are stored separately and must never be uploaded with this portfolio.
