# Role and permission review matrix

| Role | Intended access | Audit evidence | Release status |
| --- | --- | --- | --- |
| Platform Operator | Cross-tenant platform administration | Explicit operator policies and security migration | Requires live RLS regression test |
| Company Admin | Portfolio administration | Company-admin portfolio migration and policies | Requires live RLS regression test |
| Manager/Finance | Assigned associations and accounting | manager scoping migration; sampled association report | Requires all-tenant test matrix |
| Board | Association governance and permitted read access | board read-expansion migrations | Requires live role test |
| Owner | Own occupancy, financial and portal data | owner portal policies | Requires live role test |
| Vendor | Assigned work/orders/bills only | vendor scoped-read policies | Requires live role test |

Security-definer functions are intentionally used for tightly scoped database operations. Production release requires applying the execution-boundary migration and testing each function as `anon`, `authenticated`, intended role, and service role. Never rely only on client-side filtering.
