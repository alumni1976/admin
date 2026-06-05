const configEl = document.getElementById("supabase-db");
const config = JSON.parse(configEl.textContent);

export const SUPABASE_URL = config.url;
export const SUPABASE_KEY = config.key;

export async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || text || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function encodeFilterValue(value) {
  return encodeURIComponent(value ?? "");
}

export async function getAdminMenuItems() {
  return supabaseFetch("/rest/v1/menuitemsadmin?select=id,item,url,sort_order,active&active=eq.true&order=sort_order.asc,item.asc");
}

export async function getAdminSubMenuItems() {
  return supabaseFetch("/rest/v1/menuitemsadmin1?select=id,item,url,menuitemsadminitem,sort_order,active&active=eq.true&order=menuitemsadminitem.asc,sort_order.asc,item.asc");
}

export async function verifyAdminLogin(email, password) {
  const safeEmail = encodeFilterValue(email.trim().toLowerCase());
  const safePassword = encodeFilterValue(password);
  const rows = await supabaseFetch(
    `/rest/v1/members?select=id,first_name,last_name,email,admin_password&email=ilike.${safeEmail}&admin_password=eq.${safePassword}&limit=1`
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;

  const admin = rows[0];
  if (!admin.admin_password) return null;

  return {
    id: admin.id,
    first_name: admin.first_name || "",
    last_name: admin.last_name || "",
    email: admin.email || email.trim(),
    full_name: `${admin.first_name || ""} ${admin.last_name || ""}`.trim() || admin.email
  };
}

export async function getEventRegistrations() {
  const eventforms = await supabaseFetch(
    "/rest/v1/eventforms?select=id,event_id,member_id,guests_count,meal_participation,comments,confirmation_sent,created_at,attendance_status&order=created_at.desc"
  );

  const memberIds = [...new Set((eventforms || []).map(row => row.member_id).filter(Boolean))];
  const eventIds = [...new Set((eventforms || []).map(row => row.event_id).filter(Boolean))];

  const members = memberIds.length
    ? await supabaseFetch(`/rest/v1/members?select=id,first_name,last_name,email,phone&イド=in.(${memberIds.join(",")})`.replace("イド", "id"))
    : [];

  const events = eventIds.length
    ? await supabaseFetch(`/rest/v1/alumnievents?select=id,title,event_date,event_time,location,description&id=in.(${eventIds.join(",")})`)
    : [];

  const memberMap = new Map(members.map(member => [member.id, member]));
  const eventMap = new Map(events.map(event => [event.id, event]));

  return (eventforms || []).map(row => ({
    ...row,
    member: memberMap.get(row.member_id) || null,
    event: eventMap.get(row.event_id) || null
  }));
}
