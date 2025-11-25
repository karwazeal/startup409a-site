// functions/api/lead.js

// 1) Webhook for your Google Sheet / CRM (Make.com / Zapier)
const WEBHOOK_URL = "https://hook.us2.make.com/tdx7es2m32nuyblj5hsdk8entd9laoge";

// 2) Base URL where your R2 files are publicly visible
// Example: "https://pub-xxxxxx.r2.dev/startup409a-files"
const FILE_BASE_URL = "https://pub-4fc511a90a3d415cbf9dd56bf85f50bf.r2.dev";


// ------------------------
// CORS Preflight Handler for OPTIONS
// ------------------------
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ------------------------
// Main handler for POST /api/lead
// ------------------------
export async function onRequestPost(context) {
  const { request, env } = context;
  const contentType = request.headers.get("content-type") || "";

  try {
    let payload;

    if (contentType.includes("multipart/form-data")) {
      // 🔹 Valuation form with file upload
      payload = await handleMultipartLead(request, env);
    } else {
      // 🔹 Contact + sample_report JSON forms
      payload = await handleJsonLead(request);
    }

    // Send to your webhook (Google Sheet / CRM)
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Success response expected by contact.html
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Important for CORS
      },
    });
  } catch (err) {
    console.error("Error in /api/lead handler:", err);
    // Return a 500 error, which contact.html will handle
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

// ------------------------
// 🛠️ Helper: Handle standard JSON-encoded leads (e.g., contact form)
// ------------------------
async function handleJsonLead(request) {
  // Read the JSON body from the request
  return await request.json();
}

// ------------------------
// 🛠️ Helper: Handle multipart/form-data leads with files (e.g., valuation form)
// ------------------------
async function handleMultipartLead(request, env) {
  const formData = await request.formData();
  const payload = {};
  const fileUrls = [];

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0 && env.R2_BUCKET) {
        // Use form_type or a default to create a clean folder structure in R2
        const objectKey = `${payload.form_type || 'files'}/${Date.now()}-${value.name}`;
        await env.R2_BUCKET.put(objectKey, value.stream());
        fileUrls.push(`${FILE_BASE_URL}/${objectKey}`);
      }
    } else {
      payload[key] = value;
    }
  }

  if (fileUrls.length > 0) {
    payload.file_urls = fileUrls.join(', ');
  }

  return payload;
}
