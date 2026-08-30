// Auth email sender.
//
// Supabase Auth normally posts these through SMTP, but SMTP to Resend fails
// here: three configurations were tried and Resend's logs recorded no inbound
// connection at all, so the failure is between Supabase and the SMTP endpoint.
// The Resend HTTP API works from this project — a test send through it arrived.
//
// Registered as a Send Email Hook, Supabase calls this function instead of
// connecting to an SMTP server, and it sends over that working API path.
// Password resets, confirmations and magic links all arrive here.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
}

interface HookPayload {
  user: { email: string };
  email_data: EmailData;
}

/**
 * Verifies the Standard Webhooks signature Supabase sends.
 *
 * Without this the endpoint would send an email to any address a caller named,
 * which is both a spam relay and a way to send convincing phishing from this
 * project's domain.
 */
async function verifySignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  // Supabase stores the secret as "v1,whsec_<base64>"; the signing key is the
  // base64 payload after that prefix.
  const base64Secret = secret.replace(/^v1,\s*/, "").replace(/^whsec_/, "");

  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(base64Secret), (c) => c.charCodeAt(0));
  } catch {
    console.error("[send-auth-email] Hook secret is not valid base64");
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const mac = await crypto.subtle.sign("HMAC", key, signed);
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // The header may carry several space-separated versioned signatures.
  return signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1] ?? part)
    .some((candidate) => candidate === expected);
}

/** The link the recipient clicks, built from Supabase's verification endpoint. */
function buildActionLink(data: EmailData, supabaseUrl: string): string {
  const params = new URLSearchParams({
    token: data.token_hash,
    type: data.email_action_type,
    redirect_to: data.redirect_to,
  });
  return `${supabaseUrl}/auth/v1/verify?${params}`;
}

/** Copy per action, so a reset does not arrive worded as a signup. */
function composeEmail(data: EmailData, link: string): { subject: string; html: string } {
  const button = `
    <a href="${link}" style="display:inline-block;background:#10b981;color:#ffffff;
       padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      %%LABEL%%
    </a>`;

  const shell = (heading: string, body: string, label: string) => `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;
                margin:0 auto;padding:32px 24px;color:#111827;">
      <h1 style="font-size:20px;margin:0 0 16px;">📈 UnifiedMarket</h1>
      <h2 style="font-size:17px;margin:0 0 12px;font-weight:600;">${heading}</h2>
      <p style="font-size:14px;line-height:1.6;color:#4b5563;margin:0 0 24px;">${body}</p>
      ${button.replace("%%LABEL%%", label)}
      <p style="font-size:12px;color:#6b7280;margin:24px 0 0;line-height:1.6;">
        If the button does not work, paste this into your browser:<br>
        <span style="word-break:break-all;">${link}</span>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;">
        Didn't request this? You can ignore this email — nothing will change.
      </p>
    </div>`;

  switch (data.email_action_type) {
    case "recovery":
      return {
        subject: "Reset your UnifiedMarket password",
        html: shell(
          "Choose a new password",
          "Use the link below to set a new password. It expires in an hour.",
          "Set a new password",
        ),
      };
    case "signup":
    case "email_change":
      return {
        subject: "Confirm your email for UnifiedMarket",
        html: shell(
          "Confirm your email",
          "Confirm this address to finish setting up your account.",
          "Confirm email",
        ),
      };
    case "magiclink":
      return {
        subject: "Your UnifiedMarket sign-in link",
        html: shell("Sign in", "Use the link below to sign in.", "Sign in"),
      };
    default:
      return {
        subject: "UnifiedMarket",
        html: shell("Continue", "Use the link below to continue.", "Continue"),
      };
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!hookSecret || !resendKey || !supabaseUrl) {
    console.error("[send-auth-email] Missing SEND_EMAIL_HOOK_SECRET, RESEND_API_KEY or SUPABASE_URL");
    return new Response(JSON.stringify({ error: "not configured" }), { status: 500 });
  }

  const body = await req.text();
  const id = req.headers.get("webhook-id") ?? "";
  const timestamp = req.headers.get("webhook-timestamp") ?? "";
  const signature = req.headers.get("webhook-signature") ?? "";

  if (!(await verifySignature(hookSecret, id, timestamp, body, signature))) {
    console.error("[send-auth-email] Signature verification failed");
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "invalid payload" }), { status: 400 });
  }

  const recipient = payload.user?.email;
  const data = payload.email_data;
  if (!recipient || !data) {
    return new Response(JSON.stringify({ error: "payload missing user or email_data" }), { status: 400 });
  }

  const { subject, html } = composeEmail(data, buildActionLink(data, supabaseUrl));
  const from = Deno.env.get("AUTH_EMAIL_FROM") ?? "UnifiedMarket <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [recipient], subject, html }),
  });

  if (!response.ok) {
    // Returning the provider's message surfaces the real reason in Supabase's
    // auth logs, rather than the opaque "Error sending recovery email" that
    // SMTP failures produced.
    const detail = await response.text();
    console.error(`[send-auth-email] Resend ${response.status}: ${detail.slice(0, 300)}`);
    return new Response(
      JSON.stringify({ error: { http_code: response.status, message: `Email provider rejected the send: ${detail.slice(0, 200)}` } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  console.log(`[send-auth-email] Sent ${data.email_action_type} to ${recipient.slice(0, 3)}***`);
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
