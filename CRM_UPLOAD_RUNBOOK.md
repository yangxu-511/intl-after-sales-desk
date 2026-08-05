# Confirmed CRM upload runbook

This runbook is for the local Codex task that collects Supabase submissions and,
only after explicit user confirmation, creates SalesEasy work orders.

## Fixed targets

- CRM entity: `fieldJob`
- Business type: `外贸线上服务工单`
- Business type ID: `3632592021996271`
- Business type API key: `businessType12__c`
- Initial owner: `徐阳`
- Owner user ID: `3519520896402061`

Do not transfer a created record unless the user separately names the work-order
record, names the new owner, and explicitly confirms the transfer.

## Scheduled collection

Timezone: `Asia/Shanghai`. Run every calendar day at 13:30, 15:30, 17:30,
19:30, 21:30, and 00:00. The 00:00 run is the preceding day's 24:00 batch.
The five half-hour runs and the midnight run may be represented by two local
Codex heartbeat schedules. Do not enable either schedule until the Supabase
table exists and the local service-role key has passed a read-only collection
check.

Run from this project directory:

```bash
npm run queue:collect
```

Collection changes only `pending` rows to `awaiting_confirmation`. It must not
create, update, approve, submit, or transfer any CRM record. If the command
returns no rows, there is nothing to present.

For every returned row, show the local reference, reporter, customer, product,
issue title, requested Beijing-time appointment, and any missing lookup. Ask the
user to confirm the exact queue UUIDs that may be uploaded.

## Upload after confirmation

For each confirmed UUID, process sequentially:

1. Run `npm run queue -- get <uuid>` and confirm its status is
   `awaiting_confirmation`.
2. Resolve `CPMCWM__c` from the submitted product name using current CRM field
   metadata. Resolve `fCountry` from the submitted country when an exact option
   exists. Never guess an option code.
3. If a required value or exact product option cannot be resolved, run
   `npm run queue -- mark-needs-review <uuid> "<reason>"` and do not create CRM.
4. Run `npm run queue -- mark-processing <uuid>` immediately before CRM create.
5. Call CRM `entity.create` once with the `crm_preview` entity, business type,
   and fields. Add the resolved `CPMCWM__c` and optional `fCountry` codes.
6. If creation returns a definite failure, run
   `npm run queue -- mark-failed <uuid> "<error>"`.
7. If the network or tool result makes creation uncertain, run
   `npm run queue -- mark-uncertain <uuid> "<reason>"`. Do not retry creation.
8. After a successful create, call CRM `entity.detail` using the returned record
   ID. Verify the official work-order number, business type, and owner `徐阳`.
9. Only after successful readback run:

   ```bash
   npm run queue -- mark-uploaded <uuid> <crm-record-id> <work-order-number> 徐阳
   ```

The Supabase UUID and unique local reference are the duplicate-prevention keys.
An `uncertain` row must be reconciled by searching CRM before it can be resolved;
never create it again automatically.

## Field mapping

| Form value | CRM field | Rule |
| --- | --- | --- |
| Service address | `address` | Required text |
| Requested support time | `appointmentStartTime` | Beijing time converted to milliseconds |
| Issue and reporter context | `description` | Required composed text |
| Complaint case | `SFWTSL__c` | `1` yes, `2` no |
| Online service type | `XSFWLX__c` | Submitted CRM option code |
| Product category | `CPFL__c` | Submitted CRM option code |
| Product name | `CPMCWM__c` | Current CRM option lookup required |
| Model / reagent item | `XHSJXM__c` | Required text |
| Internal region | `wmqy__c` | Submitted CRM option code |
| Fault level | `customItem100__c` | Level 1/2/3 maps to `1/2/3` |
| Severity | `YZCD__c` | Severe/moderate/minor maps to `1/2/3` |
| Issue description | `KHWTMS__c` | Optional duplicate of customer issue text |
| Serial number | `serialNumber` | Include when present |
| Reagent lot | `SJPH__c` | Include when present |

Actual attachments are not uploaded in phase 1; only their filenames appear in
the description.
