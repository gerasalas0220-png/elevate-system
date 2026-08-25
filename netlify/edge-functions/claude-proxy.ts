export default async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "Falta la variable ANTHROPIC_API_KEY en Netlify (Site configuration → Environment variables).",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prompt = body?.prompt;
  if (!prompt || typeof prompt !== "string") {
    return new Response(JSON.stringify({ error: "Falta el campo 'prompt'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 12000,
        stream: true, // keeps the connection actively sending data, avoiding
                      // the synchronous-function-style timeout that killed
                      // this same call on both Supabase and plain Netlify
                      // Functions when waiting for one huge non-streamed reply.
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthRes.ok) {
      let data: any = null;
      try {
        data = await anthRes.json();
      } catch {
        // ignore
      }
      const msg =
        (data && data.error && data.error.message) ||
        `Error de la API de Anthropic (${anthRes.status})`;
      return new Response(JSON.stringify({ error: msg }), {
        status: anthRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Relay the raw SSE stream straight through to the browser.
    return new Response(anthRes.body, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Error de red al llamar a Anthropic: " + (err as Error).message,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

export const config = {
  path: "/api/claude-proxy",
};
