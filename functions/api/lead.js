// functions/api/lead.js

// 1) Webhook for your Google Sheet / CRM (Make.com / Zapier)
const WEBHOOK_URL =
  "https://hook.us2.make.com/tdx7es2m32nuyblj5hsdk8entd9laoge";

// 2) Base URL where your R2 files are publicly visible
// Example: "https://pub-xxxxxx.r2.dev/startup409a-files"
const FILE_BASE_URL =
  "https://pub-4fc511a90a3d415cbf9dd56bf85f50bf.r2.dev";

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
    return new Response(
      JSON.stringify({ ok: false, error: "Server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
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
  const fileNames = [];
  const fileUrls = [];

  // Use form_type (if present) for folder name in R2
  const folder = formData.get("form_type") || "files";

  // Go through all fields
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      // It's a file
      if (value.size > 0 && env.R2_BUCKET) {
        const objectKey = `${folder}/${Date.now()}-${value.name}`;

        // Upload to R2
        await env.R2_BUCKET.put(objectKey, value.stream());

        // Collect info
        fileNames.push(value.name);
        fileUrls.push(`${FILE_BASE_URL}/${objectKey}`);
      }
    } else {
      // Normal text field
      payload[key] = value;
    }
  }

  // Add file fields to payload for Make / Google Sheet
  if (fileNames.length > 0) {
    payload.file_name = fileNames.join(", ");
  }
  if (fileUrls.length > 0) {
    payload.file_url = fileUrls.join(", ");
    // (optional) keep old field if you ever used it
    payload.file_urls = fileUrls.join(", ");
  }

  return payload;
}
