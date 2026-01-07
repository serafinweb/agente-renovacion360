export const config = {
  runtime: "nodejs",
};

import * as cheerio from "cheerio";

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Falta el parámetro ?url=" });
    }

    if (!SCRAPINGBEE_API_KEY) {
      return res.status(500).json({
        error: "Falta SCRAPINGBEE_API_KEY en las variables de entorno",
      });
    }

    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(
      url
    )}&render_js=true`;

    const response = await fetch(scrapingBeeUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({
        error: "Error al llamar a ScrapingBee",
        status: response.status,
        body: text,
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $("title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "";

    const metaDescription =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    const h1 = $("h1")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

    const h2 = $("h2")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

    const h3 = $("h3")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

    const bodyText = $("body").text().replace(/\s+/g, " ");
    const phoneRegex =
      /(\+34)?\s?(\d{3}[\s-]?\d{2,3}[\s-]?\d{2,3}|\d{9})/g;

    const phones = Array.from(
      new Set(
        (bodyText.match(phoneRegex) || [])
          .map((p) => p.trim())
          .filter((p) => p.replace(/\D/g, "").length >= 9)
      )
    );

    const emailRegex =
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    const emails = Array.from(
      new Set((bodyText.match(emailRegex) || []).map((e) => e.trim()))
    );

    const socialSelectors = [
      'a[href*="facebook.com"]',
      'a[href*="instagram.com"]',
      'a[href*="twitter.com"]',
      'a[href*="x.com"]',
      'a[href*="tiktok.com"]',
      'a[href*="linkedin.com"]',
      'a[href*="youtube.com"]',
      'a[href*="wa.me"]',
      'a[href*="api.whatsapp.com"]',
    ];

    const socialLinks = {};

    socialSelectors.forEach((sel) => {
      $(sel).each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        if (href.includes("facebook.com")) socialLinks.facebook = href;
        if (href.includes("instagram.com")) socialLinks.instagram = href;
        if (href.includes("twitter.com") || href.includes("x.com"))
          socialLinks.twitter = href;
        if (href.includes("tiktok.com")) socialLinks.tiktok = href;
        if (href.includes("linkedin.com")) socialLinks.linkedin = href;
        if (href.includes("youtube.com")) socialLinks.youtube = href;
        if (href.includes("wa.me") || href.includes("api.whatsapp.com"))
          socialLinks.whatsapp = href;
      });
    });

    const serviceKeywords = [
      "servicio",
      "servicios",
      "qué hacemos",
      "especialidades",
      "nuestros trabajos",
      "reparación",
      "instalación",
      "mantenimiento",
      "urgencias",
    ];

    const possibleServiceBlocks = [];

    $("section, div, ul").each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (serviceKeywords.some((kw) => text.includes(kw))) {
        possibleServiceBlocks.push($(el).text());
      }
    });

    let services = [];

    possibleServiceBlocks.forEach((block) => {
      const lines = block
        .split(/\n|·|•|-|●/)
        .map((l) => l.trim())
        .filter((l) => l.length > 3 && l.length < 120);

      services = services.concat(lines);
    });

    services = Array.from(new Set(services)).slice(0, 15);

    const addressCandidates = [];
    $('*[class*="direccion"], *[class*="address"], address').each(
      (_, el) => {
        const t = $(el).text().trim();
        if (t.length > 10) addressCandidates.push(t);
      }
    );

    const address = addressCandidates[0] || "";

    let logo =
      $('img[alt*="logo" i]').attr("src") ||
      $('img[src*="logo"]').attr("src") ||
      "";

    if (logo && logo.startsWith("//")) {
      const normalizedUrl = new URL(url);
      logo = `${normalizedUrl.protocol}${logo}`;
    } else if (logo && logo.startsWith("/")) {
      const normalizedUrl = new URL(url);
      logo = `${normalizedUrl.origin}${logo}`;
    }

    const mainText = $("body").text().replace(/\s+/g, " ").trim();

    const sectorKeywords = [
      { key: "cristal", sector: "Cristalería" },
      { key: "ventana", sector: "Cristalería" },
      { key: "fontan", sector: "Fontanería" },
      { key: "cerraj", sector: "Cerrajería" },
      { key: "abogado", sector: "Abogacía" },
      { key: "clínica", sector: "Clínica" },
      { key: "dental", sector: "Dentista" },
      { key: "taller", sector: "Taller mecánico" },
      { key: "neumático", sector: "Taller mecánico" },
      { key: "peluquer", sector: "Peluquería" },
      { key: "restaurante", sector: "Restaurante" },
      { key: "bar ", sector: "Restaurante / Bar" },
      { key: "cafetería", sector: "Cafetería" },
    ];

    const lowerAll = (title + " " + mainText).toLowerCase();
    let detectedSector = "";

    for (const { key, sector } of sectorKeywords) {
      if (lowerAll.includes(key)) {
        detectedSector = sector;
        break;
      }
    }

    res.status(200).json({
      sourceUrl: url,
      title,
      metaDescription,
      h1,
      h2,
      h3,
      phones,
      emails,
      socialLinks,
      services,
      address,
      logo,
      mainText,
      detectedSector,
    });
  } catch (error) {
    console.error("Error en /api/scrape:", error);
    res.status(500).json({
      error: "Error interno en el backend de scraping",
      details: error.message,
    });
  }
}