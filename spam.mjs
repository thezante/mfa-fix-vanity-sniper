import tls from 'tls';
import http2 from 'http2';
import axios from 'axios';

const token = "zante";
const password = 'zante';
const serverID = 'zante';
const webhookURL = '';
const targetVanity = 'zante'; // zante always fast
let mfaT = '';

class H2 {
  constructor() {
    this.s = http2.connect("https://canary.discord.com", {
      settings: {noDelay:true},
      secureContext: tls.createSecureContext({ciphers:'ECDHE-RSA-AES128-GCM-SHA256:AES128-SHA'})
    });
    this.s.on('error', () => setTimeout(() => this.constructor(), 5000));
    this.s.on('close', () => setTimeout(() => this.constructor(), 5000));
  }
  
  async executeRequest(m, p, h = {}, b = null) {
    return new Promise((rs, rj) => {
      const hs = {
        'Content-Type': 'application/json',
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36',
        'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJwdGIiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC4xMTMwIiwib3NfdmVyc2lvbiI6IjEwLjAuMTkwNDUiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoidHIiLCJoYXNfY2xpZW50X21vZHMiOmZhbHNlLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWxlIEdlY2tvKSBkaXNjb3JkLzEuMC4xMTMwIENocm9tZS8xMjguMC42NjEzLjE4NiBFbGVjdHJvbi8zMi4yLjcgU2FmYXJpLzUzNy4zNiIsImJyb3dzZXJfdmVyc2lvbiI6IjMyLjIuNyIsIm9zX3Nka192ZXJzaW9uIjoiMTkwNDUiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjozNjY5NTUsIm5hdGl2ZV9idWlsZF9udW1iZXIiOjU4NDYzLCJjbGllbnRfZXZlbnRfc291cmNlIjpudWxsfQ==',
        ...h,
        ":method": m,
        ":path": p,
        ":authority": "canary.discord.com",
        ":scheme": "https"
      };
      const s = this.s.request(hs);
      const c = [];
      s.on("data", d => c.push(d));
      s.on("end", async () => {
        const responseBody = Buffer.concat(c).toString();
        try {
            const responseJson = JSON.parse(responseBody || '{}');
            if (responseJson && responseJson.code && responseJson.code === targetVanity) {
                console.log(`[+] Vanity claimed: ${targetVanity}`);
                await sendWebhookAlert(targetVanity);
                process.exit(0);
            } else if (responseJson.message) {
                 console.log(`[-] Failed: ${responseJson.message} | Retrying...`);
            }
            rs(responseBody);
        } catch (e) {
            rj(e);
        }
    });
      s.on("error", (err) => {
          rj(err);
      });
      if (b) s.write(typeof b === 'string' ? b : JSON.stringify(b));
      s.end();
    });
  }
}

const c = new H2();

async function fetchMFAToken() {
    try {
      const r = await c.executeRequest('PATCH', '/api/v9/guilds/0/vanity-url');
      const d = JSON.parse(r || '{}');
      if (d.code === 60003 && d.mfa?.ticket) {
        const mr = await c.executeRequest('POST', '/api/v9/mfa/finish', {}, {
          ticket: d.mfa.ticket,
          mfa_type: 'password',
          data: password
        });
        const md = JSON.parse(mr || '{}');
        if (md.token) return md.token;
      }
    } catch (e) {}
    process.exit(1);
  }

async function sendVanityAttempt() {
  try {
     await c.executeRequest('PATCH', `/api/v9/guilds/${serverID}/vanity-url`, {'X-Discord-MFA-Authorization': mfaT}, {code: targetVanity});
  } catch (e) {
  }
}

async function sendWebhookAlert(v) {
    if (!webhookURL) return;
  try {
    await axios.post(webhookURL, {
      content: '@everyone',
      embeds: [{
        title: "Vanity Claimed!",
        description: '```SPAMMER```',
        color: 0x00ff00,
        fields: [
          {name: "Vanity", value: `\`${v}\``, inline: true},
        ],
        footer: {
          text: `Claimer | ${new Date().toLocaleTimeString('tr-TR')}`,
        },
        timestamp: new Date().toISOString()
      }]
    }, {timeout: 5000});
    console.log(`[+] Notification sent to webhook for ${v}.`);
  } catch (e) {
    console.error(`[-] wb gonderilemedi: ${e.message}`);
  }
}

async function startProcess() {
  if (!targetVanity || targetVanity === 'TARGET_VANITY_URL') {
      process.exit(1);
  }
   if (!token || !password || !serverID) {
      process.exit(1);
  }
  console.log(`[+] ${targetVanity} spam basliyor ${serverID}`);
  mfaT = await fetchMFAToken();

  if (mfaT) {
      console.log('[+] mfa tokeni ready');
      setInterval(sendVanityAttempt, 50);
  } else {
  }
}

startProcess();
