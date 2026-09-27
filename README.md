# ServiceNow Order Device E2E

Playwright + TypeScript end-to-end test for the ServiceNow "Order New Device" flow:
order a Verizon Samsung Galaxy S24+ from My Assets & Services, follow it through
REQ → RITM → Telecom Fulfillment Task, complete the task, and confirm the Mobile Device record.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

Fill in `SN_USERNAME` and `SN_PASSWORD` in `.env`. Put the password in single quotes if it
contains `#`: dotenv treats everything after an unquoted `#` as a comment.

## Run

```bash
npm test                  # headless
npm run test:ui           # Playwright UI mode
npm run test:headed       # visible browser
npm run report            # HTML report (trace, screenshot and video on failure)
npm run typecheck
```

`SN_CLEANUP=false npm test` keeps the created records for manual review.

## How it works

- **Page objects** live in `pages/`. `ClassicFormPage` locates classic fields by their
  data-model ids (`<table>.<field>`) and implements Save through the form header context menu.
- **Fixtures** are in `fixtures/test.ts`: test data, a REST client, the current user, page
  objects, record cleanup and a guard that fails the test on any 5xx response.
- **Login** is a worker-scoped fixture: one login per worker, the session stays in memory
  and is injected into every test, so it works the same in the CLI, UI mode and VS Code.
- **Cleanup**: the test registers its records by run-unique keys (REQ number, IMEI). Teardown
  deletes them through the Table API even when the test fails: Mobile Device, TFT, then REQ.
  The RITM is removed by the REQ cascade.
- **REST** reuses the UI session with its `X-UserToken`, because Basic auth is disabled for
  the test user.

## Network checks

- The REQ number comes from the catalog API response of the submit, not from page text.
- Every Save is checked on the posted form: `sys_action` must be the Save action
  (`sysverb_update_and_stay`), and the posted `state` must match the chosen value.
- The Set TFT Details data must be posted in the same submit as the Completed state.
- No 5xx responses from the instance during the run.
- REQ, TFT (`process_data_json`) and Mobile Device are cross-checked through `/api/now/table`.

## Known issue: Set TFT Details saves the ship date one day early east of UTC

The main flow runs with `timezoneId: 'UTC'` (see `playwright.config.ts`), where the shift
does not happen, so it stays green. The bug is covered by
`tests/tft-ship-date-timezone.spec.ts`: it runs in `Europe/Kyiv`, is tagged `@bug`, and fails
on `output_ship_by` until the bug is fixed. `npm run test:stable` runs everything except `@bug`.

**Environment:** dev216365, Chromium, browser timezone UTC+1 (system default).

**Steps to reproduce**

1. Set the OS or browser timezone to any zone east of UTC, for example UTC+1.
2. Open a Telecom Fulfillment Task in the *With Carrier* state.
3. Click **Set TFT Details**, set **Ship By** to `09/27/2026`, fill the other required fields
   and submit.
4. Set **State** to *Completed*, then right-click the form header and choose **Save**.
5. Read `process_data_json` of the task, for example
   `/api/now/table/x_mobi_p_telecom_fulfillment_task?sysparm_query=number=<TEL number>&sysparm_fields=process_data_json`.

**Expected:** `"output_ship_by": "2026-09-27"`, the date that was entered.

**Actual:** `"output_ship_by": "2026-09-26"`, one day earlier.

**Likely cause:** local midnight of the entered date is converted to UTC before the date part
is taken (for example `toISOString()`), which moves it to the previous day for any UTC+ offset.
