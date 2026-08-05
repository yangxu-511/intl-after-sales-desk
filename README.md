# International Service Desk

A bilingual, mobile-friendly after-sales ticket form for international service
employees.

## Current scope

- English-first form with Chinese field references
- fields mapped to the SalesEasy `外贸线上服务工单` business type
- Supabase password authentication for pre-approved users
- automatic draft saving in the current browser
- local submission history and CSV export
- Supabase-backed pending queue with row-level access rules
- local Codex collection and explicit confirmation before SalesEasy CRM creation
- duplicate-prevention states and CRM readback recording
- no automatic CRM transfer or approval
- attachment filenames only; actual file contents are not uploaded

## Supabase queue setup

Apply the SQL migration in
`supabase/migrations/202608040001_create_ticket_submissions.sql` to the existing
Supabase project. The migration creates the queue table and row-level security
rules (database rules that restrict each signed-in employee to their own rows).

For the local collector, copy `config/ticket-queue.env.example` to
`config/ticket-queue.env` and add the Supabase service-role key. This file is
ignored by Git and must remain on the local Mac.

```bash
npm run queue:collect
```

The command only collects new rows for human confirmation. The controlled CRM
workflow is documented in `CRM_UPLOAD_RUNBOOK.md`.

## Local use

```bash
npm install
npm run dev
```

Open the local address shown by the development server.

## Validation

```bash
npm test
```

The tests build the deployable site and confirm that the core ticket form is
present in the rendered page.
