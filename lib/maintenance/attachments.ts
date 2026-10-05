import 'server-only';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export interface MaintenanceAttachmentView {
  id: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  uploader_role: 'staff' | 'resident' | 'vendor';
  uploaded_by: string | null;
  created_at: string;
  url: string | null;
}

/**
 * Files on a service request and/or work order that the CALLER may see (RLS
 * decides), each with a one-hour signed URL. For a work order pass both ids:
 * the resident's photos on the parent request are included.
 */
export async function loadMaintenanceAttachments(opts: { serviceRequestId?: string | null; workOrderId?: string | null }): Promise<MaintenanceAttachmentView[]> {
  const { serviceRequestId, workOrderId } = opts;
  if (!serviceRequestId && !workOrderId) return [];
  const db = (await createClient()) as any;
  let query = db.from('maintenance_attachments')
    .select('id, file_name, file_path, content_type, size_bytes, uploader_role, uploaded_by, created_at')
    .order('created_at', { ascending: true });
  if (workOrderId && serviceRequestId) {
    query = query.or(`work_order_id.eq.${workOrderId},and(service_request_id.eq.${serviceRequestId},work_order_id.is.null)`);
  } else if (workOrderId) {
    query = query.eq('work_order_id', workOrderId);
  } else {
    query = query.eq('service_request_id', serviceRequestId);
  }
  const { data: rows, error } = await query;
  if (error) throw new Error(`Attachments could not be loaded: ${error.message}`);
  return sign(rows ?? []);
}

/** Files on several service requests at once (portal list), keyed by request id. */
export async function loadRequestAttachmentsByRequest(serviceRequestIds: string[]): Promise<Map<string, MaintenanceAttachmentView[]>> {
  const byRequest = new Map<string, MaintenanceAttachmentView[]>();
  if (!serviceRequestIds.length) return byRequest;
  const db = (await createClient()) as any;
  const rows: any[] = [];
  // Request-level files plus the work-order files RLS lets this viewer see
  // (for residents: vendor before/after photos). Chunked by request and paged
  // so no file is dropped by the API's row limit.
  const PAGE = 1000;
  for (let i = 0; i < serviceRequestIds.length; i += 50) {
    const chunk = serviceRequestIds.slice(i, i + 50);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from('maintenance_attachments')
        .select('id, service_request_id, file_name, file_path, content_type, size_bytes, uploader_role, uploaded_by, created_at')
        .in('service_request_id', chunk)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Attachments could not be loaded: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
  }
  for (const item of await sign(rows)) {
    const key = (item as any).service_request_id as string;
    byRequest.set(key, [...(byRequest.get(key) ?? []), item]);
  }
  return byRequest;
}

async function sign(rows: any[]): Promise<MaintenanceAttachmentView[]> {
  if (!rows.length) return [];
  const svc = createServiceClient() as any;
  const { data: signed, error } = await svc.storage.from('association-documents')
    .createSignedUrls(rows.map((r: any) => r.file_path), 3600);
  if (error) throw new Error(`Attachment links could not be created: ${error.message}`);
  const urlByPath = new Map<string, string>((signed ?? []).filter((s: any) => s.signedUrl).map((s: any) => [s.path, s.signedUrl]));
  return rows.map(({ file_path, ...rest }: any) => ({ ...rest, url: urlByPath.get(file_path) ?? null }));
}
