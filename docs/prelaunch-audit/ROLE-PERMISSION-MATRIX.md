# Role and permission review matrix

| Role | Intended access | Current staging evidence | Remaining release test |
| --- | --- | --- | --- |
| Platform Operator | Cross-tenant platform administration | Correct role home; cross-portfolio role verifier pass. | Create/disable/impersonation lifecycle and audit verification. |
| Company Admin | Own-portfolio administration | Portfolio-A-only home/data; manager assignment form; tenant-B manager routes redirect. | Invite/disable/reassign and forged API mutation matrix. |
| Manager/Finance | Assigned associations and accounting | Association-A dashboard/reports/bills; tenant-B Association/Owner/Vendor IDs return 404; Company Admin/Operator homes denied. | Remaining write workflows, direct API mutation, and upload isolation. |
| Board | Association governance and permitted read access | Scoped dashboard/financials/delinquencies; manager bills/report run denied. | Approval/signature browser lifecycle and mutation-denial matrix. |
| Owner | Own occupancy, financial, and portal data | Scoped dashboard/ledger/communications; staff home and manager report run denied; two-owner database isolation passes. | Multi-unit, payment/request/upload, and stale-session tests. |
| Vendor | Assigned work/orders/bills only | Scoped dashboard/payments/work orders; staff home and manager report run denied; two-vendor database isolation passes. | Assigned-work mutation, upload, Vendor B, and stale-session tests. |
| Tenant | Defined launch behavior required | No distinct end-to-end tenant persona has been proven. | Define, implement, and test the role or remove it from launch scope. |

Security-definer functions are intentionally used for tightly scoped database operations. Staging includes the execution-boundary migrations and the tested role/RLS matrix passes, but production release still requires an approved migration plan plus explicit `anon`, ordinary authenticated, intended-role, and service-role call-path tests for every elevated function used by launch workflows.
