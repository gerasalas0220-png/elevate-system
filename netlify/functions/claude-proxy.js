// Classic Netlify Functions handler format (CommonJS, no bundler required).
// Works with plain drag-and-drop / manual deploys and with the Netlify CLI.
// Netlify's standard Functions runtime allows much longer execution time
// than Supabase's Edge Functions (which were killing this request mid-way
// through streaming a long AI-generated report due to CPU-time limits).
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Método no permitido" }),
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error:
          "Falta la variable de entorno ANTHROPIC_API_KEY en Netlify. Andá a Site configuration → Environment variables y agregala con tu clave de console.anthropic.com.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Body inválido" }),
    };
  }

  const prompt = payload && payload.prompt;
  if (!prompt || typeof prompt !== "string") {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Falta el campo 'prompt'" }),
    };
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
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await anthRes.json();

    if (!anthRes.ok) {
      const msg =
        (data && data.error && data.error.message) ||
        "Error de la API de Anthropic (" + anthRes.status + ")";
      return {
        statusCode: anthRes.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: msg }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Error de red al llamar a Anthropic: " + err.message,
      }),
    };
  }
};
