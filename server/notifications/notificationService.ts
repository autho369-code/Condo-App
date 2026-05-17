/**
 * Notification Service
 *
 * Handles creating in-app notifications and sending email alerts to owners
 * when a document is shared with them.
 *
 * Respects each owner's notification preferences (getNotificationPrefs):
 *  - docSharedInApp  → whether to create an in-app notification
 *  - docSharedEmail  → whether to send an email alert
 */

import {
  createOwnerNotification,
  getOwnersByProperty,
  getDocumentById,
  getPropertyById,
  markNotificationEmailSent,
  getNotificationPrefs,
  getUserById,
} from "../db";
import { ENV } from "../_core/env";

// ─── Email helper (uses Manus Forge API) ─────────────────────────────────────
async function sendEmailViaForge(to: string, subject: string, htmlBody: string): Promise<boolean> {
  if (!ENV.forgeApiKey || !ENV.forgeApiUrl) {
    console.warn("[Notifications] Forge API not configured — skipping email.");
    return false;
  }
  try {
    const res = await fetch(`${ENV.forgeApiUrl}/v1/notification/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({ to, subject, html: htmlBody }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[Notifications] Email send failed (${res.status}): ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Notifications] Email send error:", err);
    return false;
  }
}

// ─── Build email HTML for document-shared notification ────────────────────────
function buildDocumentSharedEmail(params: {
  ownerName: string;
  documentTitle: string;
  documentCategory: string;
  propertyName: string;
  portalUrl: string;
}): string {
  const { ownerName, documentTitle, documentCategory, propertyName, portalUrl } = params;
  const categoryLabel: Record<string, string> = {
    governing_document: "Governing Document",
    meeting_minutes: "Meeting Minutes",
    financial_report: "Financial Report",
    insurance: "Insurance",
    maintenance_record: "Maintenance Record",
    notice: "Notice",
    other: "Document",
  };
  const label = categoryLabel[documentCategory] ?? "Document";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Document Shared</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#2D4A3E;padding:32px 40px;">
              <p style="margin:0;color:#C9A84C;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:sans-serif;">Portier369</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:normal;">New Document Available</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#3d3d3d;font-size:16px;line-height:1.6;">
                Dear ${ownerName},
              </p>
              <p style="margin:0 0 24px;color:#3d3d3d;font-size:16px;line-height:1.6;">
                Your property management company has shared a new document with you for <strong>${propertyName}</strong>.
              </p>
              <!-- Document card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8f5;border:1px solid #e8e5de;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#888;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-family:sans-serif;">${label}</p>
                    <p style="margin:0;color:#1a1a1a;font-size:18px;font-weight:bold;">${documentTitle}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 32px;color:#3d3d3d;font-size:16px;line-height:1.6;">
                You can view and download this document from your owner portal.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#2D4A3E;border-radius:6px;">
                    <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-family:sans-serif;font-size:15px;font-weight:600;">
                      View Document in Portal →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e8e5de;">
              <p style="margin:0;color:#999;font-size:13px;font-family:sans-serif;line-height:1.5;">
                This notification was sent because you are registered as an owner on the Portier369 platform.
                To manage your notification preferences, visit your owner portal settings.
                If you have questions, please contact your property management company directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── Main trigger: notify all owners of a property when a document is shared ──
export async function notifyDocumentShared(documentId: number): Promise<void> {
  try {
    const doc = await getDocumentById(documentId);
    if (!doc) {
      console.warn(`[Notifications] Document ${documentId} not found — skipping.`);
      return;
    }
    if (!doc.isSharedWithOwners) {
      // Document is being un-shared — no notification needed
      return;
    }

    const property = await getPropertyById(doc.propertyId);
    if (!property) {
      console.warn(`[Notifications] Property ${doc.propertyId} not found — skipping.`);
      return;
    }

    const owners = await getOwnersByProperty(doc.propertyId);
    if (owners.length === 0) {
      console.info(`[Notifications] No owners found for property ${doc.propertyId} — no notifications sent.`);
      return;
    }

    const portalUrl = `${ENV.oauthPortalUrl}/portal?tab=documents&propertyId=${doc.propertyId}`;
    let notifiedCount = 0;

    for (const owner of owners) {
      // ── Load this owner's notification preferences ──────────────────────────
      const prefs = await getNotificationPrefs(owner.id);

      // 1. Create in-app notification (if owner has not opted out)
      let notifId: number | undefined;
      if (prefs.docSharedInApp) {
        try {
          const result = await createOwnerNotification({
            ownerId: owner.id,
            propertyId: doc.propertyId,
            companyId: doc.companyId,
            type: "document_shared",
            title: "New Document Shared",
            body: `"${doc.title}" has been shared with you for ${property.name}.`,
            documentId: doc.id,
            isRead: false,
            emailSent: false,
          });
          notifId = result?.id;
        } catch (err) {
          console.error(`[Notifications] Failed to create in-app notification for owner ${owner.id}:`, err);
        }
      } else {
        console.info(`[Notifications] Owner ${owner.id} has opted out of in-app document notifications.`);
      }

      // 2. Send email notification (if owner has not opted out and has an email)
      if (prefs.docSharedEmail && owner.email) {
        const ownerName = owner.name ?? "Owner";
        const html = buildDocumentSharedEmail({
          ownerName,
          documentTitle: doc.title,
          documentCategory: doc.category,
          propertyName: property.name,
          portalUrl,
        });
        const sent = await sendEmailViaForge(
          owner.email,
          `New Document Available: ${doc.title} — ${property.name}`,
          html,
        );
        if (sent && notifId) {
          await markNotificationEmailSent(notifId);
        }
      } else if (!prefs.docSharedEmail) {
        console.info(`[Notifications] Owner ${owner.id} has opted out of email document notifications.`);
      }

      notifiedCount++;
    }

    console.info(`[Notifications] Processed ${notifiedCount} owner(s) for document "${doc.title}" (id=${documentId}).`);
  } catch (err) {
    // Notification failures must never crash the main request
    console.error("[Notifications] Unexpected error in notifyDocumentShared:", err);
  }
}

// ─── Build email HTML for manager-reply notification ─────────────────────────
function buildManagerReplyEmail(params: {
  ownerName: string;
  managerName: string;
  propertyName: string;
  messagePreview: string;
  portalUrl: string;
}): string {
  const { ownerName, managerName, propertyName, messagePreview, portalUrl } = params;
  // Truncate preview to 200 chars for email safety
  const preview = messagePreview.length > 200
    ? messagePreview.slice(0, 200) + "…"
    : messagePreview;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Message from Your Property Manager</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#2D4A3E;padding:32px 40px;">
              <p style="margin:0;color:#C9A84C;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:sans-serif;">Portier369</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:normal;">New Message from Management</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#3d3d3d;font-size:16px;line-height:1.6;">
                Dear ${ownerName},
              </p>
              <p style="margin:0 0 24px;color:#3d3d3d;font-size:16px;line-height:1.6;">
                <strong>${managerName}</strong> from your property management team has replied to your message regarding <strong>${propertyName}</strong>.
              </p>
              <!-- Message preview card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8f5;border-left:4px solid #2D4A3E;border-radius:0 6px 6px 0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;color:#888;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-family:sans-serif;">${managerName} wrote:</p>
                    <p style="margin:0;color:#1a1a1a;font-size:15px;line-height:1.6;font-style:italic;">"${preview}"</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 32px;color:#3d3d3d;font-size:16px;line-height:1.6;">
                Log in to your owner portal to read the full message and continue the conversation.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#2D4A3E;border-radius:6px;">
                    <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-family:sans-serif;font-size:15px;font-weight:600;">
                      View Message in Portal →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e8e5de;">
              <p style="margin:0;color:#999;font-size:13px;font-family:sans-serif;line-height:1.5;">
                This notification was sent because your property manager replied to your message on the Portier369 platform.
                To manage your notification preferences, visit your owner portal settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── Trigger: notify an owner when a manager replies to their message ─────────
/**
 * Call this after a manager sends a reply via documents.replyToOwner.
 * Respects the owner's msgReceivedInApp and msgReceivedEmail preferences.
 *
 * @param ownerId       - The numeric ID of the owner who sent the original message
 * @param propertyId    - The property the conversation is about
 * @param companyId     - The management company
 * @param managerName   - Display name of the manager who replied
 * @param replyBody     - The text of the manager's reply (used for preview)
 * @param propertyName  - Human-readable property name for the notification body
 */
export async function notifyManagerReply(params: {
  ownerId: number;
  propertyId: number;
  companyId: number;
  managerName: string;
  replyBody: string;
  propertyName: string;
}): Promise<void> {
  const { ownerId, propertyId, companyId, managerName, replyBody, propertyName } = params;

  try {
    // Load owner record for name + email
    const owner = await getUserById(ownerId);
    if (!owner) {
      console.warn(`[Notifications] Owner ${ownerId} not found — skipping reply notification.`);
      return;
    }

    // Load this owner's notification preferences
    const prefs = await getNotificationPrefs(ownerId);

    const portalUrl = `${ENV.oauthPortalUrl ?? ""}/portal?tab=messages`;
    const notifTitle = `New reply from ${managerName}`;
    const notifBody = `${managerName} replied to your message about ${propertyName}: "${
      replyBody.length > 100 ? replyBody.slice(0, 100) + "…" : replyBody
    }"`;

    // 1. Create in-app notification (if owner has not opted out)
    let notifId: number | undefined;
    if (prefs.msgReceivedInApp) {
      try {
        const result = await createOwnerNotification({
          ownerId,
          propertyId,
          companyId,
          type: "message_received",
          title: notifTitle,
          body: notifBody,
          documentId: null,
          isRead: false,
          emailSent: false,
        });
        notifId = result?.id;
      } catch (err) {
        console.error(`[Notifications] Failed to create in-app reply notification for owner ${ownerId}:`, err);
      }
    } else {
      console.info(`[Notifications] Owner ${ownerId} has opted out of in-app message notifications.`);
    }

    // 2. Send email notification (if owner has not opted out and has an email)
    if (prefs.msgReceivedEmail && owner.email) {
      const ownerName = owner.name ?? "Owner";
      const html = buildManagerReplyEmail({
        ownerName,
        managerName,
        propertyName,
        messagePreview: replyBody,
        portalUrl,
      });
      const sent = await sendEmailViaForge(
        owner.email,
        `New message from ${managerName} — ${propertyName}`,
        html,
      );
      if (sent && notifId) {
        await markNotificationEmailSent(notifId);
      }
    } else if (!prefs.msgReceivedEmail) {
      console.info(`[Notifications] Owner ${ownerId} has opted out of email message notifications.`);
    }

    console.info(`[Notifications] Reply notification processed for owner ${ownerId} (property ${propertyId}).`);
  } catch (err) {
    // Notification failures must never crash the main request
    console.error("[Notifications] Unexpected error in notifyManagerReply:", err);
  }
}
