# Cloudflare Worker DDNS
![release](https://badgen.net/badge/release/v1.0/green?) ![platform](https://badgen.net/badge/platform/Cloudflare/orange?) ![code](https://badgen.net/badge/code/JS/pink?) ![license](https://badgen.net/badge/license/MIT/blue?)

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

### 2. Retrieve Zone ID
- Zone ID: available in the Cloudflare Dashboard, **Overview** tab of your domain.  
- Save the Zone ID → this is your `CF_ZONE_ID`.

### 3. Find Record IDs
- Record IDs: list them with `curl` + `jq`:
  ```bash
  curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?per_page=100" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
  | jq '.result[] | {id, type, name, content}'
  ```
- Save the record IDs of your domains, you will need them to complete the `worker.js` file.

### 4. Deploy the Worker
- Go to **Workers & Pages → Create Worker → Start from “Hello World”**.  
- Deploy the code as-is.  
- Open the code editor, remove the “Hello World” snippet, and paste the content of [`worker.js`](https://raw.githubusercontent.com/paolo-hub/Cloudflare-worker-ddns/main/worker.js).  
- Complete the `const RECORDS = {};` section with your domains and record IDs.  
- In **Settings → Variables and Secrets** add:  
  - `CF_API_TOKEN` (Secret)  
  - `CF_ZONE_ID` (Text)  
  - `BASIC_USER` (Text)  
  - `BASIC_PASS` (Secret, strong password recommended)  

### 5. Map a custom domain
- **Settings → Domains & Routes → Add Custom Domain**  
- Example: `ddns.example.com`  
- Your endpoint will be:  
  ```
  https://ddns.example.com/update?hostname=example.com
  ```

### 6. Configure your Router / NAS
Use the Worker as a **custom DDNS provider**.  
Example URL:  
```
https://[USERNAME]:[PASSWORD]@ddns.example.com/update?hostname=[DOMAIN]
```
Where `[DOMAIN]` is the DNS record you want to update (e.g. `dns1.example.com`).  

It is also possible to update all records together: in that case, configure `hostname=example.com` (the root domain) and the Worker will update all records defined in its map.

---

## 🧪 Test with curl

### Test a single record
```bash
curl -u USER:PASS "https://ddns.example.com/update?hostname=dns1.example.com&ip=203.0.113.42"
```
Expected output:
- `good 203.0.113.42` → IP updated  
- `nochg 203.0.113.42` → IP unchanged  

### Test all records
```bash
curl -u USER:PASS "https://ddns.example.com/update?hostname=example.com&ip=203.0.113.42&verbose=1"
```
Expected output (example):
```
good 203.0.113.42
example.com -> good
www.example.com -> good
dns1.example.com -> good
dns2.example.com -> good
```

---

## 📜 License
MIT — free to use, modify and share.
