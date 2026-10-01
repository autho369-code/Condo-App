-- Vendors could make themselves compliant by typing future expiration dates:
-- vendor_compliance (vendor-writable) was copied straight onto
-- vendors.*_expiration by trg_vendor_compliance_sync, including the management
-- company's own contract_expiration. Vendor-entered dates are now only claims;
-- the official dates change when staff approve the uploaded document
-- (review_vendor_document_request) or edit the vendor.
alter table public.vendor_compliance disable trigger trg_vendor_compliance_sync;
