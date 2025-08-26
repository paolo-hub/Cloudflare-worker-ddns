export default {
  async fetch(request, env, ctx) {
    try {
      // ======= Config modificabile: mappa host → record_id =======
      const RECORDS = {
        "example.com":        "RECORD_ID_ROOT",
        "www.example.com":    "RECORD_ID_WWW",
        "dns1.example.com":   "RECORD_ID_DNS1",
        "dns2.example.com":    "RECORD_ID_DNS2",
      };
      // Root che attiva l'aggiornamento "batch"
      const ROOT_BATCH_HOST = "minilan.xyz";
      // ===========================================================

      // ======= Secrets necessari =======
      const CF_API_TOKEN = env.CF_API_TOKEN;
      const CF_ZONE_ID   = env.CF_ZONE_ID;
      const BASIC_USER   = env.BASIC_USER;
      const BASIC_PASS   = env.BASIC_PASS;
      // =================================

      // --- 1) Basic Auth ---
      const auth = request.headers.get("Authorization") || "";
      if (!checkBasicAuth(auth, BASIC_USER, BASIC_PASS)) {
        return new Response("badauth", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="ddns"' }
        });
      }

      // --- 2) Parametri ---
      const url = new URL(request.url);
      const hostname = url.searchParams.get("hostname"); // richiesto da Omada
      const queryIp  = url.searchParams.get("ip");
      const verbose  = url.searchParams.get("verbose") === "1";

      if (!hostname) return respText("nohost", 400);

      const clientIp = queryIp || request.headers.get("CF-Connecting-IP");
      if (!clientIp) return respText("noip", 400);

      const ipType = isIPv6(clientIp) ? "AAAA" : isIPv4(clientIp) ? "A" : null;
      if (!ipType) return respText("badip", 400);

      // --- 3) Modalità: batch se hostname == ROOT_BATCH_HOST, altrimenti singolo ---
      if (hostname === ROOT_BATCH_HOST) {
        // BATCH: aggiorna tutti i record mappati (filtrati per tipo coerente)
        const entries = Object.entries(RECORDS); // [ [host, id], ... ]
        const results = [];
        for (const [host, id] of entries) {
          const out = await updateOne(CF_ZONE_ID, CF_API_TOKEN, host, id, clientIp, ipType);
          results.push({ host, ...out });
        }

        const anyGood     = results.some(r => r.status === "good");
        const anyNochg    = results.some(r => r.status === "nochg");
        const ddnsSummary = anyGood ? `good ${clientIp}` : (anyNochg ? `nochg ${clientIp}` : `ok ${clientIp}`);

        if (verbose) {
          const lines = results.map(r => `${r.host} -> ${r.status}${r.msg ? " ("+r.msg+")" : ""}`);
          return respText(ddnsSummary + "\n" + lines.join("\n"), 200);
        }
        return respText(ddnsSummary, 200);
      }

      // SINGOLO: comportamento come prima
      const recordId = RECORDS[hostname];
      if (!recordId) return respText(`notfqdn ${hostname}`, 404);

      const single = await updateOne(CF_ZONE_ID, CF_API_TOKEN, hostname, recordId, clientIp, ipType);
      if (single.status === "good")  return respText(`good ${clientIp}`, 200);
      if (single.status === "nochg") return respText(`nochg ${clientIp}`, 200);
      if (single.status === "badtype") return respText(`badtype (record/ip mismatch)`, 409);
      if (single.status === "911")   return respText("911 (update failed)", 502);
      return respText(`ok ${clientIp}`, 200);

    } catch (err) {
      return respText("911 (exception)", 500, String(err));
    }
  }
};

// ---------- Helpers ----------
function isIPv4(ip) {
  const m = ip.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (!m) return false;
  return ip.split(".").every(oct => Number(oct) >= 0 && Number(oct) <= 255);
}
function isIPv6(ip) { return ip.includes(":"); }

function checkBasicAuth(authHeader, user, pass) {
  if (!authHeader.startsWith("Basic ")) return false;
  const b64 = authHeader.slice(6);
  try {
    const [u, p] = atob(b64).split(":");
    return u === user && p === pass;
  } catch { return false; }
}

async function updateOne(zoneId, token, host, recordId, newIp, ipType) {
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`;

  // Leggi record corrente
  const getRes = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  const getData = await getRes.json();
  if (!getData?.success) return { status: "911", msg: "fetch record failed" };

  const cur = getData.result; // {type,name,content,ttl,proxied,...}

  // Aggiorna solo se il tipo coincide con l'IP chiamante (A per IPv4, AAAA per IPv6)
  if (cur.type !== ipType) {
    return { status: "badtype", msg: `record ${cur.type}, ip ${ipType}` };
  }

  if (cur.content === newIp) {
    return { status: "nochg" };
  }

  const body = {
    type: ipType,
    name: host,
    content: newIp,
    ttl: cur.ttl ?? 1,          // 1 = Auto
    proxied: cur.proxied ?? true
  };

  const putRes = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const putData = await putRes.json();
  if (!putData?.success) return { status: "911", msg: "update failed" };

  return { status: "good" };
}

function respText(text, status = 200, detail) {
  const payload = detail ? `${text}\n${detail}` : text;
  return new Response(payload, { status, headers: { "Content-Type": "text/plain" } });
}
