// Cloudflare Pages Function for https://dueagain.com/invite/<token>.
//
// When Due Again is installed, the OS resolves this path as a universal link
// (see /.well-known/apple-app-site-association) and opens the app directly —
// this function never runs. Otherwise the browser lands here and we
// server-render a preview of the shared task plus an install CTA, with dynamic
// Open Graph tags so the link unfurls as a rich card in Messages/WhatsApp.
//
// Preview data comes from the public `invite_preview` RPC (security definer,
// minimal fields). Requires Pages env vars SUPABASE_URL and SUPABASE_ANON_KEY
// (the anon key is public-safe).

const APP_STORE_URL = "https://apps.apple.com/app/id6779137593";
const APP_STORE_ID = "6779137593";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORY = {
  home: { label: "Home", emoji: "🏠" },
  car: { label: "Car", emoji: "🚗" },
  garden: { label: "Garden", emoji: "🌱" },
  personal: { label: "Personal", emoji: "👤" },
  other: { label: "Other", emoji: "📋" },
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roleVerb(role) {
  return role === "viewer" ? "view" : "view and complete";
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const token = params.token;

  let preview = null;
  if (UUID_RE.test(token)) {
    try {
      const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/rpc/invite_preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ invite_token: token }),
        },
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) preview = rows[0];
      }
    } catch (_e) {
      // Fall through to the invalid state — never block the install path.
    }
  }

  const valid =
    preview && preview.status === "pending" && preview.is_expired === false;

  const html = valid ? validPage(preview, token) : invalidPage();
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Short cache: a revoked invite should stop previewing quickly, while
      // link unfurlers can still cache briefly.
      "Cache-Control": "public, max-age=300",
    },
  });
}

function shell({ title, description, body }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} · Due Again</title>
  <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}" />
  <meta property="og:site_name" content="Due Again" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="https://dueagain.com/images/app-icon.png" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <style>
    :root { --primary: #6d4fd6; color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center;
      justify-content: center; padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        'Helvetica Neue', Arial, sans-serif;
      background: #f5f6f8; color: #1c1c1e;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #000; color: #f2f2f7; }
      .card { background: #1c1c1e !important; }
      .task { background: #2c2c2e !important; }
    }
    .card {
      background: #fff; border-radius: 20px; padding: 32px 28px;
      max-width: 420px; width: 100%; text-align: center;
      box-shadow: 0 8px 30px rgba(0,0,0,0.08);
    }
    .icon { width: 84px; height: 84px; border-radius: 19px; margin-bottom: 18px; }
    .lead { font-size: 17px; line-height: 1.45; margin: 0 0 20px; }
    .task {
      background: #f0f2f5; border-radius: 14px; padding: 18px 16px;
      margin: 0 0 24px; text-align: left;
    }
    .task .chip {
      display: inline-block; font-size: 13px; font-weight: 600;
      color: var(--primary); margin-bottom: 6px;
    }
    .task h2 { font-size: 20px; margin: 0; line-height: 1.3; }
    .cta {
      display: inline-block;
      background: linear-gradient(135deg, #6d4fd6 0%, #9a6ff0 55%, #c4a4f4 100%);
      color: #fff;
      text-decoration: none; font-weight: 600; font-size: 17px;
      padding: 14px 28px; border-radius: 999px;
      box-shadow: 0 10px 24px rgba(109, 79, 214, 0.35);
    }
    .muted { color: #8e8e93; font-size: 13px; margin-top: 18px; }
  </style>
</head>
<body>
  <div class="card">
    <img class="icon" src="https://dueagain.com/images/app-icon.png" alt="Due Again" />
    ${body}
  </div>
</body>
</html>`;
}

function validPage(preview, token) {
  const cat = CATEGORY[preview.task_category] || CATEGORY.other;
  const inviter = escapeHtml(preview.inviter_name || "Someone");
  const verb = roleVerb(preview.role);
  const title = escapeHtml(preview.task_title || "a task");
  const ogTitle = preview.task_title || "a task";
  const ogDesc = `${preview.inviter_name || "Someone"} invited you to ${verb} this task on Due Again.`;

  const body = `
    <p class="lead">${inviter} invited you to <strong>${verb}</strong> this task on Due&nbsp;Again.</p>
    <div class="task">
      <span class="chip">${cat.emoji} ${cat.label}</span>
      <h2>${title}</h2>
    </div>
    <a class="cta" href="${APP_STORE_URL}">Get Due Again</a>
    <p class="muted">Install the app, then re-open this link to join. Invite valid for 14&nbsp;days.</p>`;

  return shell({ title: ogTitle, description: ogDesc, body });
}

function invalidPage() {
  const body = `
    <p class="lead">This invite link is no longer valid.</p>
    <p class="muted" style="margin-top:0;margin-bottom:24px;">It may have expired, been revoked, or already been used. Ask whoever shared it to send a new one.</p>
    <a class="cta" href="${APP_STORE_URL}">Get Due Again</a>`;

  return shell({
    title: "Due Again",
    description: "Shared reminders for household upkeep.",
    body,
  });
}
