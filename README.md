# International Service Desk

A bilingual, mobile-friendly after-sales ticket form for international service
employees.

## Version 1 scope

- English-first form with Chinese field references
- fields mapped to the SalesEasy `外贸线上服务工单` business type
- automatic draft saving in the current browser
- local submission history and CSV export
- no account, shared database, file upload, approval, or SalesEasy CRM write-back

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
