// Vercel serverless function — proxy per leggere blocchi + Q&A da Notion
// Endpoint: GET /api/blocks
// Risponde con: { blocks: { "cover": true, ... }, qa: [{ q, a, autore }, ...] }

const BLOCKS_DB_ID = "fea19e85d50f4eb4a3a2cef2e442bcf4";
const QA_DB_ID = "97d8499df6994a00bba4485b51ae1ab4";

const NOTION_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

async function fetchBlocks(token) {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${BLOCKS_DB_ID}/query`,
    {
      method: "POST",
      headers: NOTION_HEADERS(token),
      body: JSON.stringify({
        sorts: [{ property: "Ordine", direction: "ascending" }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Blocks DB: ${res.status}`);
  const data = await res.json();
  const blocks = {};
  for (const page of data.results) {
    const props = page.properties;
    const slugArr = props.Slug?.rich_text;
    const slug = slugArr && slugArr.length > 0 ? slugArr[0].plain_text : null;
    const visible = props.Visibile?.checkbox ?? false;
    if (slug) blocks[slug] = visible;
  }
  return blocks;
}

async function fetchQA(token) {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${QA_DB_ID}/query`,
    {
      method: "POST",
      headers: NOTION_HEADERS(token),
      body: JSON.stringify({
        sorts: [{ property: "Ordine", direction: "ascending" }],
        filter: { property: "Visibile", checkbox: { equals: true } },
      }),
    }
  );
  if (!res.ok) throw new Error(`QA DB: ${res.status}`);
  const data = await res.json();
  const qa = [];
  for (const page of data.results) {
    const props = page.properties;
    const domanda = props.Domanda?.title;
    const risposta = props.Risposta?.rich_text;
    const autore = props.Autore?.rich_text;
    qa.push({
      q: domanda && domanda.length > 0 ? domanda[0].plain_text : "",
      a: risposta && risposta.length > 0 ? risposta[0].plain_text : "",
      autore: autore && autore.length > 0 ? autore[0].plain_text : "",
    });
  }
  return qa;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return res.status(500).json({ error: "NOTION_TOKEN not configured" });

  try {
    const [blocks, qa] = await Promise.all([
      fetchBlocks(NOTION_TOKEN),
      fetchQA(NOTION_TOKEN),
    ]);
    return res.status(200).json({ blocks, qa });
  } catch (err) {
    return res.status(500).json({ error: "Server error", message: err.message });
  }
};
