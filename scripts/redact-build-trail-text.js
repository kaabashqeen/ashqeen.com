const SENSITIVE_QUERY_KEYS =
  "api[_-]?key|apikey|key|token|access[_-]?token|refresh[_-]?token|auth|authorization|code|secret|password|database(?:[_-]?url)?|db(?:[_-]?url)?|dsn|endpoint|host|hostname|server|signature|sig|webhook";

const CONFIG_KEY_PATTERN =
  "PASSWORD|PASSCODE|SECRET|TOKEN|API_KEY|APIKEY|AUTH|AUTHORIZATION|CLIENT_SECRET|PRIVATE_KEY|DATABASE|DATABASE_URL|DB|DB_URL|DATABASE_URI|DB_URI|DATABASE_DSN|DB_DSN|ENDPOINT|HOSTNAME|HOST|SERVER|WEBHOOK|SIGNING_SECRET|ACCESS_KEY|SECRET_ACCESS_KEY|ACCOUNT_ID|ZONE_ID";

const SECRET_WORD_PATTERN =
  "password|passcode|secret|api[_\\s-]?key|apikey|token|access[_\\s-]?token|refresh[_\\s-]?token|auth[_\\s-]?code|authorization|client[_\\s-]?secret|private[_\\s-]?key|database[_\\s-]?url|db[_\\s-]?url|database[_\\s-]?uri|db[_\\s-]?uri|database[_\\s-]?dsn|db[_\\s-]?dsn|endpoint|host|hostname|server|webhook|signing[_\\s-]?secret|access[_\\s-]?key|secret[_\\s-]?access[_\\s-]?key|account[_\\s-]?id|zone[_\\s-]?id";

function cleanText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPrivateHostname(hostname) {
  const host = String(hostname || "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();

  if (/^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|::1)$/.test(host)) return true;
  if (/^(?:10|192\.168)\.(?:\d{1,3}\.){2}\d{1,3}$/.test(host)) return true;
  if (/^172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^(?:fc|fd|fe80):/i.test(host)) return true;
  return false;
}

function redactUrls(text) {
  return text.replace(/\bhttps?:\/\/[^\s'"`<>]+/gi, (url) => {
    try {
      const parsed = new URL(url);
      if (isPrivateHostname(parsed.hostname)) return "[redacted local endpoint]";
      if (!/(^|\.)ygoplus\.com$/i.test(parsed.hostname)) return "[redacted external URL]";
      if (parsed.username || parsed.password) {
        parsed.username = "";
        parsed.password = "";
      }
      if (/\/(?:webhooks?|callback|oauth|authorize|login|billing|account)(?:\/|$)/i.test(parsed.pathname)) {
        parsed.pathname = "/[redacted path]";
      }
      if (parsed.search) parsed.search = "?[redacted query]";
      if (/token|secret|password|key|auth|code|database|endpoint|host|webhook|signature|sig/i.test(parsed.hash)) {
        parsed.hash = "#[redacted fragment]";
      }
      return parsed.toString();
    } catch {
      return url;
    }
  });
}

function redactSensitiveText(value) {
  let text = cleanText(value);

  text = text.replace(/Traceback \(most recent call last\):?[\s\S]*/gi, "[redacted stack trace]");
  text = text.replace(/\bFile\s+"[^"]+",\s+line\s+\d+[^\n]*/gi, "[redacted stack frame]");
  text = text.replace(/^.*\b(?:Debugger PIN|Running on all addresses|Running on https?:\/\/|sqlalchemy\.engine\.Engine|werkzeug\.exceptions|jinja2\.exceptions|flask\.debughelpers)\b.*$/gim, "[redacted dev/server log]");
  text = text.replace(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[^\s"]+/gi, (match) => {
    const method = match.split(/\s+/)[0];
    return `${method} [redacted route]`;
  });

  text = text.replace(/ydke:\/\/[^\s'"`<>]+/gi, "[redacted deck code]");
  text = text.replace(/data:[^\s'")]+/gi, "[redacted embedded data]");
  text = text.replace(/blob:[^\s'")]+/gi, "[redacted embedded data]");
  text = text.replace(
    /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss):\/\/[^\s'",;`]+/gi,
    "[redacted database url]",
  );
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]");
  text = text.replace(/mailto:\[redacted email\]/gi, "[redacted email]");
  text = text.replace(/\/Users\/[^/\s'")]+/g, "[local path]");
  text = text.replace(/\bkaabashqeen\b/gi, "[local user]");
  text = text.replace(/\b[A-Z0-9._%+-]*\[local user\][A-Z0-9._%+-]*@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]");
  text = text.replace(/\bhttps?:\/\/(?:[a-z0-9-]+\.)?ygoprodeck\.com[^\s'"`<>)]*/gi, "[redacted external URL]");
  text = text.replace(/\b(?:[a-z0-9-]+\.)?ygoprodeck\.com\b/gi, "[redacted external URL]");
  text = text.replace(/\bygoprodeck[_-]?url\b/gi, "external_card_url");
  text = text.replace(/\bygoprodeck[_-]?id\b/gi, "external_card_id");
  text = text.replace(/\bygoprodeck\b/gi, "external card database");
  text = text.replace(/\bygopro\s+deck\b/gi, "external deck site");
  text = text.replace(/\b[a-z0-9-]+\.onrender\.com\b/gi, "[redacted external host]");
  text = text.replace(
    /(^|[^\d.])(?:0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?=$|[^\d.])/g,
    "$1[redacted private ip]",
  );
  text = text.replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[redacted phone]");
  text = text.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted number]");
  text = text.replace(/\bWITH\s+PASSWORD\s+(['"`])[^'"`\s]+\1/gi, "WITH PASSWORD [redacted secret]");
  text = text.replace(new RegExp(`([?&](?:${SENSITIVE_QUERY_KEYS})=)[^&\\s]+`, "gi"), "$1[redacted]");
  text = text.replace(
    new RegExp(`\\b(?:[A-Z0-9_]*(?:${CONFIG_KEY_PATTERN})[A-Z0-9_]*)\\b\\s*[:=]\\s*(['"\`]?)(?:\\[[^\\]]+\\]|[^\\s'",;\`]+)`, "gi"),
    (match) => {
      const label = match.split(/[:=]/)[0].trim();
      return `${label}: [redacted config]`;
    },
  );
  text = redactUrls(text);
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/g, "Bearer [redacted secret]");
  text = text.replace(/\b(?:Basic|Digest)\s+[A-Za-z0-9._~+/=-]{10,}/gi, "[redacted auth header]");
  text = text.replace(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_*]{10,}\b/g, "[redacted api key]");
  text = text.replace(/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_*_-]{20,}\b/g, "[redacted api key]");
  text = text.replace(/\bsk-ant-[A-Za-z0-9_*_-]{20,}\b/g, "[redacted api key]");
  text = text.replace(/\bwhsec_[A-Za-z0-9_]{16,}\b/g, "[redacted webhook secret]");
  text = text.replace(/\bSG\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g, "[redacted token]");
  text = text.replace(/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, "[redacted token]");
  text = text.replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[redacted token]");
  text = text.replace(/\bglpat-[A-Za-z0-9_-]{20,}\b/g, "[redacted token]");
  text = text.replace(/\bnpm_[A-Za-z0-9_-]{20,}\b/g, "[redacted token]");
  text = text.replace(/\bhf_[A-Za-z0-9_-]{20,}\b/g, "[redacted token]");
  text = text.replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[redacted api key]");
  text = text.replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "[redacted access key]");
  text = text.replace(/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[redacted token]");
  text = text.replace(
    /\b(?:acct|cus|sub|evt|price|prod|in|pi|pm|seti|si|ch|py|txn)_[A-Za-z0-9]{8,}\b/g,
    "[redacted stripe id]",
  );
  text = text.replace(/\bcs_(?:test|live)_[A-Za-z0-9_]{8,}\b/g, "[redacted stripe id]");
  text = text.replace(/\b[A-Z0-9][A-Z0-9_-]{2,}-[A-Z0-9]{4,}\b/g, "[redacted code]");
  text = text.replace(
    new RegExp(`\\b(${SECRET_WORD_PATTERN})\\b\\s*[:=]\\s*(['"\`]?)(?:\\[[^\\]]+\\]|[^\\s'",;\`]+)`, "gi"),
    (_match, label) => `${label}: [redacted secret]`,
  );
  text = text.replace(
    new RegExp(`\\b(${SECRET_WORD_PATTERN})\\b\\s+(?:is|was|as|to|of)\\b\\s+(['"\`]?)(?:\\[[^\\]]+\\]|[^\\s'",;\`]+)`, "gi"),
    (_match, label) => `${label} is [redacted secret]`,
  );
  text = text.replace(
    /\b(?=[A-Za-z0-9_-]{32,}\b)(?=[A-Za-z0-9_-]*[A-Za-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{32,}\b/g,
    "[redacted secret]",
  );
  text = text.replace(/\bhttps?:\/\/\[redacted private ip\][^\s'"`<>)]*/gi, "[redacted local endpoint]");
  text = text.replace(/\bhttps?:\/\/\[redacted external host\][^\s'"`<>)]*/gi, "[redacted external URL]");

  return text.replace(/\[redacted secret\]\s+(?:config|secret|external URL)\]/gi, "[redacted secret]");
}

module.exports = {
  redactSensitiveText,
};
