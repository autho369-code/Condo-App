# Role and permission review matrix

| Role | Intended access | Current staging evidence | Remaining release test |
| --- | --- | --- | --- |
| Platform Operator | Cross-tenant platform administration | Correct role home; cross-portfolio role verifier pass. | Create/disable/impersonation lifecycle and audit verification. |
| Company Admin | Own-portfolio administration | Portfolio-A-only home/data; manager assignment form; tenant-B route and direct API mutations denied; stale token revoked. | Invite/disable/reassign browser lifecycle and invitation/reset abuse. |
| Manager/Finance | Assigned associations and accounting | Association-A dashboard/reports/bills; tenant-B IDs and API mutations denied; service-only report RPC denied; admin/operator homes denied; stale token revoked. | Remaining write workflows and per-workflow signed-upload isolation. |
| Board | Association governance and permitted read access | Scoped dashboard/financials/delinquencies; manager bills/report run and association mutation denied; stale token revoked. | Approval/signature browser lifecycle and cross-entity signed-upload attack. |
| Owner | Own occupancy, financial, and portal data | Scoped dashboard/ledger/communications; staff/report-run access and charge mutation denied; two-owner isolation and stale-token revocation pass. | Multi-unit, payment/request/upload lifecycle, signed-capability cross-entity, and reset abuse. |
| Vendor | Assigned work/orders/bills only | Scoped dashboard/payments/work orders; staff/report-run access and payable mutation denied; two-vendor isolation and stale-token revocation pass. | Assigned-work/upload lifecycle, Vendor B signed-capability denial, and reset abuse. |
| Tenant | Defined launch behavior required | No distinct end-to-end tenant persona has been proven. | Define, implement, and test the role or remove it from launch scope. |

Security-definer functions are intentionally used for tightly scoped database operations. Staging includes the execution-boundary migrations and the tested role/RLS matrix passes, but production release still requires an approved migration plan plus explicit `anon`, ordinary authenticated, intended-role, and service-role call-path tests for every elevated function used by launch workflows.
