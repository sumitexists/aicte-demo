# AICTE Approval Workflow Monitor — frontend prototype

A demo of the approval-processing and compliance-monitoring platform. Frontend only: no backend, no
database, no auth. All state is seeded in memory; a demo clock drives every deadline.

```bash
npm install
npm run dev     # http://127.0.0.1:5199
npm run build   # type-check + production bundle
```

## What is in the build

- **50 cases** — exactly 10 of each application type, spread across five regions and every stage.
  About 20% are already overdue, the rest sit inside their allocated window or are about to fall due.
- **Signed-in identity** top-right: the person and designation for each role, and the institution name +
  registrar when signing in as the institution.
- **Institution portal** — the signed-in institution (Sahyadri Institute of Technology, Pune) sees only its
  own five filings, and lands straight on each case's audit log.
- **Inbox, addressed per role** — every alert carries a recipient. Switching role swaps the bell count,
  the dashboard feed and the floating alert window to that desk's notifications; nobody sees another
  desk's noise.
- **New application is an institution act** — the sidebar entry exists only in the institution role, and
  the dashboard carries a *New application* button there. An officer landing on the form is bounced
  back to their dashboard.
- **Record stage outcome** — any officer holding the current stage can mark it *completed* (forward) or
  *not completed*, which requires deficiencies and returns the case to the institution.
- **Guided demo** — the *Guide* button walks seven steps and drives the role, page and clock itself
  (arrow keys work).

## The four things this demonstrates

1. **Routing is data, not code.** The five application types follow different pipelines because
   `APH Table-2.3` says so — including self-disclosure skipping scrutiny entirely, and closure
   skipping the EVC. Pick a type on *New application* and the route redraws.
2. **Deadlines are computed, scaled and labelled by source.** Every due date carries `REGULATION`,
   `DERIVED` or `ADMIN`. The APH fixes the calendar anchors and the 7-day appeal but prescribes no
   per-stage durations, so each stage deadline is **allocated from the time remaining**, on an
   exponential curve:

   ```
   raw    = daysLeft / sum(remaining stage weights)
   factor = clamp( raw ^ 1.7, 0.2 .. 3.0 )
   due    = stageStart + weight(stage) × factor
   ```

   Slack is rewarded and shortage is punished harder than a straight ratio: a comfortable case gets
   due dates pushed out to 3× the baseline, a case short on time is squeezed to 0.2×, and one that
   cannot fit even then is flagged **cannot meet 30 April**. The Rules page shows the curve at three
   horizons (today, +30d, +60d) so the asymmetry is visible. The factor is applied when a stage
   starts and again on every move — but never continuously, so a fixed due date still shows as
   overdue when work slips.
3. **The lease gate is a rule, not a date.** `APH cl. 2.4(e)`: EoA is withheld from the year the
   live lease equals the maximum course duration. Advance the clock and watch the verdict flip.
4. **Every change is attributable.** The per-application audit log records actor, role, action,
   timestamp and a mandatory reason for returns and rejections.
5. **Alerts are addressed, not broadcast.** A stage alert goes to whoever holds that stage; past that
   it climbs Bureau → EC → Council, and the alert body says who inherits it and on what date — so an
   unattended item visibly hands itself upward as the clock advances.

## Six-month demo script

The clock starts **16 Feb 2026** (mid-cycle, all histories present) and runs to **31 Aug 2026**.

| Step | Action | What to point at |
|---|---|---|
| 1 | Land on Dashboard as Bureau | 10 of 32 open cases already overdue; region × stage matrix |
| 2 | Open `AP/2026/1104` → Audit history | Actor, time, reason for every movement |
| 3 | Switch role to **Scrutiny** | Inbox drops to the 2 alerts addressed to that desk |
| 4 | Recommend — no shortcomings | Case moves to EC; new audit row appears |
| 5 | Switch to **EC** → approve | Approval creates obligations, opens the 7-day appeal window |
| 6 | Drag the clock to 28 Apr | Escalations climb to L4; lease gate flips to “EoA withheld”; 28 cases flagged as unable to meet the wall |
| 7 | Press ▶ | Plays the season: one week per tick to 31 Aug |

## Structure

```
src/lib/types.ts        domain types
src/lib/workflow.ts     8 roles, 5 types, routing matrix, stage actions
src/lib/deadlines.ts    anchors, back-planning, exponential pace, ladder, lease gate, obligations
src/lib/seed.ts         50 seeded cases + their audit histories + seeded alerts
src/lib/store.tsx       reducer, transition engine, clock, role-scoped alert routing
src/pages/              Dashboard, Applications, NewApplication, CaseDetail, Rules
src/components/ui/      sidebar shell + primitives (incl. SourceBadge)
```

## Honest limits

- No persistence — refresh resets the demo. `Reset` does the same deliberately.
- Notifications are recorded, not delivered; there is no email/SMS integration.
- Per-stage `slaDays` are assumed processing durations, flagged `ADMIN` throughout the UI.
- Five of the APH's twenty-two application types are modelled.
