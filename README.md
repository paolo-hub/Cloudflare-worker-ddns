# Cloudflare Worker DDNS
![alt text](https://badgen.net/badge/release/v.1.0/green?) ![alt text](https://badgen.net/badge/platform/Cloudflare/orange?) ![alt text](https://badgen.net/badge/code/JS/pink?) ![alt text](https://badgen.net/badge/license/MIT/blue?)

A **Cloudflare Worker** that automatically updates DNS records (A/AAAA) when your public IP changes.  
Ideal if your ISP does not provide a static IP and you want to keep your self-hosted services reachable with your Cloudflare domain.

---

## 🚀 Features
- Update **multiple DNS records** in a single request (root + subdomains).
- Works with **any router/NAS** that supports **custom DDNS providers** (Omada, OpenWrt, Fritz!Box, pfSense, Synology, etc.).
- Secure:
  - **Basic Auth** between router and Worker.
  - **Scoped Cloudflare API Token** with minimal permissions (`DNS:Edit` + `Zone:Read`).
- DDNS-style responses (`good ip`, `nochg ip`) for compatibility and easy debugging.

---

## 🔧 Setup

### 1. Create a Cloudflare API Token
- Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens).  
- **Create Token → Edit DNS Template**.  
- Permissions:  
  - `Zone → Zone → Read`  
  - `Zone → DNS → Edit`  
- Scope: restrict to your zone (e.g., `example.com`).  
- Save the token → this is your `CF_API_TOKEN`.

### 2. Retrieve Zone ID and Record IDs
- Zone ID: available on the Cloudflare Dashboard, **Overview** tab of your domain.  
- Record IDs: list them with `curl` + `jq`:
  ```bash
  curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?per_page=100" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
  | jq '.result[] | {id, type, name, content}'
  ```

### 3. Deploy the Worker
- Go to Workers & Pages → Create Worker.
- Remove the “Hello World” snippet and paste the content of worker.js
- In Settings → Variables and Secrets add:
  - CF_API_TOKEN
  - CF_ZONE_ID
  - BASIC_USER
  - BASIC_PASS

### 4. Map a custom domain
- Settings → Domains & Routes → Add Custom Domain
- Example: ddns.example.com
- Your endpoint will be:
  `[curl](https://ddns.example.com/update?hostname=example.com)`

### 5. Configure your Router / NAS
Use the Worker as a custom DDNS provider. Example URL:
`https://[USERNAME]:[PASSWORD]@ddns.example.com/update?hostname=[DOMAIN]`
Where [DOMAIN] is the DNS record you want to update (e.g. vpn.example.com).
Some routers allow only one DDNS entry per WAN. In that case, configure hostname=example.com and the Worker will update all records defined in its map.

---

## 🧪 Test with curl
```bash
# Update all records defined in the map
curl -u USER:PASS "https://ddns.example.com/update?hostname=example.com&ip=203.0.113.42&verbose=1"
# Update a single record
curl -u USER:PASS "https://ddns.example.com/update?hostname=dns1.example.com&ip=203.0.113.42"
```
Expected output:
- good 203.0.113.42 → IP updated
- nochg 203.0.113.42 → IP unchanged

