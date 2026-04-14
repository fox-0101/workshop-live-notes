// Vercel serverless function — proxy per leggere i blocchi visibili da Notion
// Endpoint: GET /api/blocks
// Risponde con: { blocks: { "cover": true, "ch01": false, ... } }

const NOTION_DB_ID = "fea19e85d50f4eb4a3a2cef2e442bcf4";

export default async function handler(req, res) {
  // CORS headers per il polling dal frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  if (!NOTION_TOKEN) {
    return res.status(500).json({ error: "NOTION_TOKEN not configured" });
  }

  try {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sorts: [{ property: "Ordine", direction: "ascending" }],
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: "Notion API error", details: err });
    }

    const data = await response.json();
    const blocks = {};

    for (const page of data.results) {
      const props = page.properties;

      // Estrai slug (rich_text)
      const slugArr = props.Slug?.rich_text;
      const slug = slugArr && slugArr.length > 0 ? slugArr[0].plain_text : null;

      // Estrai visibile (checkbox)
      const visible = props.Visibile?.checkbox ?? false;

      if (slug) {
        blocks[slug] = visible;
      }
    }

    return res.status(200).json({ blocks });
  } catch (err) {
    return res.status(500).json({ error: "Server error", message: err.message });
  }
}
