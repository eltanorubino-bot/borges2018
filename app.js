const CONFIG = {
  csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS3IIb-he7BSLhETSIBVNMN64umgVYJG33luwPJmWKTEb--El7282hOaAT0vXFY5pnJGnY20eKM-bFt/pub?gid=606239050&single=true&output=csv',
  passwordHash: '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
  refreshInterval: 300000,
  sessionDays: 30
};

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function checkAuth() {
  var stored = localStorage.getItem('borges_auth');
  if (!stored) return false;
  try {
    var data = JSON.parse(stored);
    if (data.hash === CONFIG.passwordHash) {
      var age = Date.now() - data.timestamp;
      if (age < CONFIG.sessionDays * 86400000) return true;
    }
  } catch (e) {}
  localStorage.removeItem('borges_auth');
  return false;
}

async function handleLogin() {
  var input = document.getElementById('passwordInput');
  var btn = document.getElementById('loginBtn');
  var errorMsg = document.getElementById('errorMsg');
  var pw = input.value.trim();
  if (!pw) return;
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  errorMsg.textContent = '';
  var hash = await sha256(pw);
  if (hash === CONFIG.passwordHash) {
    localStorage.setItem('borges_auth', JSON.stringify({ hash: hash, timestamp: Date.now() }));
    showApp();
  } else {
    errorMsg.textContent = 'Contrase\u00f1a incorrecta';
    input.value = '';
    input.focus();
  }
  btn.disabled = false;
  btn.textContent = 'Acceder';
}

function logout() {
  localStorage.removeItem('borges_auth');
  document.getElementById('app').style.display = 'none';
  document.querySelector('.modal-overlay').style.display = 'flex';
  document.getElementById('passwordInput').value = '';
}

function showApp() {
  document.querySelector('.modal-overlay').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadGuests();
}

async function loadGuests() {
  try {
    var resp = await fetch(CONFIG.csvUrl + '&t=' + Date.now());
    var text = await resp.text();
    var guests = parseCSV(text);
    renderGuests(guests);
    updateTimestamp();
  } catch (e) {
    document.getElementById('guestList').innerHTML = '<p style="color:#ff3b30;text-align:center;">Error al cargar datos. Intenta recargar la p\u00e1gina.</p>';
  }
}

function parseCSV(text) {
  var lines = text.split('\n');
  var guests = [];
  for (var i = 1; i < lines.length; i++) {
    var row = lines[i].split(',');
    if (row.length >= 4 && row[1] && row[1].trim()) {
      guests.push({
        name: row[1].trim().replace(/"/g, ''),
        checkIn: row[2].trim().replace(/"/g, ''),
        checkOut: row[3].trim().replace(/"/g, ''),
        updated: row[0].trim().replace(/"/g, '')
      });
    }
  }
  return guests;
}

function formatDate(iso) {
  if (!iso) return '\u2014';
  var parts = iso.split('-');
  if (parts.length < 3) return iso;
  return parts[2] + '/' + parts[1];
}

function esc(str) {
  var el = document.createElement('div');
  el.textContent = str;
  return el.innerHTML;
}

function makeCard(guest, isCurrent) {
  var card = document.createElement('div');
  card.className = 'guest-card' + (isCurrent ? ' current' : '');
  var fmtIn = formatDate(guest.checkIn);
  var fmtOut = formatDate(guest.checkOut);
  card.innerHTML = '<div class="guest-name">' + esc(guest.name) + '</div>' +
    '<div class="guest-dates">' +
    '<div class="date-block"><label>Entrada</label><span>' + fmtIn + '</span></div>' +
    '<div class="date-block"><label>Salida</label><span>' + fmtOut + '</span></div>' +
    '</div>';
  return card;
}

function renderGuests(guests) {
  var container = document.getElementById('guestList');
  container.innerHTML = '';
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = today.toISOString().split('T')[0];
  var current = [];
  var upcoming = [];

  guests.forEach(function(g) {
    if (g.checkIn <= todayStr && g.checkOut > todayStr) {
      current.push(g);
    } else if (g.checkIn > todayStr) {
      upcoming.push(g);
    }
  });

  upcoming.sort(function(a, b) { return a.checkIn.localeCompare(b.checkIn); });

  if (current.length === 0 && upcoming.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#86868b;padding:40px 0;">No hay hu\u00e9spedes registrados actualmente.</p>';
    return;
  }

  if (current.length > 0) {
    var section = document.createElement('div');
    section.className = 'section';
    var label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = 'Hu\u00e9sped Actual';
    section.appendChild(label);
    current.forEach(function(g) { section.appendChild(makeCard(g, true)); });
    container.appendChild(section);
  }

  if (upcoming.length > 0) {
    var section2 = document.createElement('div');
    section2.className = 'section';
    var label2 = document.createElement('div');
    label2.className = 'section-label';
    label2.textContent = 'Pr\u00f3ximos Hu\u00e9spedes';
    section2.appendChild(label2);
    upcoming.forEach(function(g) { section2.appendChild(makeCard(g, false)); });
    container.appendChild(section2);
  }
}

function updateTimestamp() {
  var now = new Date();
  document.getElementById('lastUpdate').textContent =
    'Actualizado ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// Init
document.addEventListener('DOMContentLoaded', function() {
  if (checkAuth()) {
    showApp();
  }
  document.getElementById('passwordInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleLogin();
  });
  setInterval(function() {
    if (checkAuth()) loadGuests();
  }, CONFIG.refreshInterval);
});
// ═══════════════════════════════════════════════════════════
//  Configuración
// ═══════════════════════════════════════════════════════════
const CONFIG = {
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS3IIb-he7BSLhETSIBVNMN64umgVYJG33luwPJmWKTEb--El7282hOaAT0vXFY5pnJGnY20eKM-bFt/pub?gid=606239050&single=true&output=csv',
  PASSWORD_HASH: '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
  AUTH_DAYS: 30,
  REFRESH_MINUTES: 5,
  UPCOMING_DAYS: 60,
};

// ═══════════════════════════════════════════════════════════
//  Autenticación
// ═══════════════════════════════════════════════════════════
const AUTH_KEY = 'huespedes_auth';

function checkAuth() {
  const auth = localStorage.getItem(AUTH_KEY);
  if (auth) {
    try {
      const { expires } = JSON.parse(auth);
      if (expires > Date.now()) { showApp(); return; }
    } catch (e) {}
  }
  showLogin();
}

function showLogin() {
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('passwordInput').focus();
}

function showApp() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadGuests();
  setInterval(loadGuests, CONFIG.REFRESH_MINUTES * 60 * 1000);
}

async function handleLogin() {
  const input = document.getElementById('passwordInput').value;
  const btn = document.getElementById('loginBtn');
  const errorEl = document.getElementById('errorMsg');
  if (!input) { errorEl.textContent = 'Ingresá la contraseña'; return; }
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  errorEl.textContent = '';
  try {
    const hash = await sha256(input);
    if (hash === CONFIG.PASSWORD_HASH) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({
        expires: Date.now() + CONFIG.AUTH_DAYS * 24 * 60 * 60 * 1000
      }));
      showApp();
    } else {
      errorEl.textContent = 'Contraseña incorrecta';
      document.getElementById('passwordInput').value = '';
      document.getElementById('passwordInput').focus();
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Acceder';
  }
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  document.getElementById('passwordInput').value = '';
  document.getElementById('errorMsg').textContent = '';
  showLogin();
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('passwordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  checkAuth();
});

// ═══════════════════════════════════════════════════════════
//  Cargar y parsear datos del Google Sheet
// ═══════════════════════════════════════════════════════════
async function loadGuests() {
  try {
    const res = await fetch(CONFIG.SHEET_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar el sheet');
    const csv = await res.text();
    const guests = parseCSV(csv);
    renderGuests(guests);
    updateTimestamp();
  } catch (err) {
    console.error('Error cargando datos:', err);
    const list = document.getElementById('guestList');
    if (list.querySelector('.loading')) {
      list.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><h3>No se pudieron cargar los datos</h3><p>Verificá que el Google Sheet esté publicado correctamente.<br><button class="btn-primary" style="margin-top:16px;width:auto;padding:10px 24px;" onclick="loadGuests()">Reintentar</button></p></div>';
    }
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const guests = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 6) continue;
    const [updated, name, checkIn, checkOut, bookingId, status, notes] = fields.map(f => f.trim());
    if (!name || status.toLowerCase() === 'cancelled' || status.toLowerCase() === 'cancelado') continue;
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) continue;
    guests.push({ name, checkIn, checkOut, updated });
  }
  return guests.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'));
}

// ═══════════════════════════════════════════════════════════
//  Renderizado — Solo nombre + entrada + salida (DD/MM)
// ═══════════════════════════════════════════════════════════
function renderGuests(guests) {
  const container = document.getElementById('guestList');
  container.innerHTML = '';
  if (guests.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🏠</div><h3>Sin huéspedes registrados</h3><p>Cuando haya reservas, aparecerán acá automáticamente.</p></div>';
    return;
  }
  const today = todayStr();
  const current = guests.filter(g => g.checkIn <= today && g.checkOut > today);
  const upcoming = guests.filter(g => g.checkIn > today);

  if (current.length > 0) {
    container.appendChild(makeSection('Ahora en el edificio', current, true));
  } else {
    const div = document.createElement('div');
    div.className = 'section';
    div.innerHTML = '<div class="section-label">Ahora en el edificio</div><div style="background:#fff;border-radius:16px;padding:24px;text-align:center;color:#86868b;font-size:14px;">Sin huéspedes en este momento</div>';
    container.appendChild(div);
  }

  const upcomingFiltered = upcoming.filter(g => {
    const daysUntil = (new Date(g.checkIn) - new Date(today)) / 86400000;
    return daysUntil <= CONFIG.UPCOMING_DAYS;
  });
  if (upcomingFiltered.length > 0) {
    container.appendChild(makeSection('Próximos (' + upcomingFiltered.length + ')', upcomingFiltered, false));
  }
}

function makeSection(title, guests, isCurrent) {
  const section = document.createElement('div');
  section.className = 'section';
  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = title;
  section.appendChild(label);
  guests.forEach(g => section.appendChild(makeCard(g, isCurrent)));
  return section;
}

function makeCard(guest, isCurrent) {
  const card = document.createElement('div');
  card.className = 'guest-card' + (isCurrent ? ' current' : '');
  const fmtIn = formatDate(guest.checkIn);
  const fmtOut = formatDate(guest.checkOut);
  card.innerHTML = '<div class="guest-name">' + esc(guest.name) + '</div>' +
    '<div class="guest-dates">' +
    '<div class="date-block"><label>Entrada</label><span>' + fmtIn + '</span></div>' +
    '<div class="date-block"><label>Salida</label><span>' + fmtOut + '</span></div>' +
    '</div>';
  return card;
}

// ═══════════════════════════════════════════════════════════
//  Utilidades
// ═══════════════════════════════════════════════════════════
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDate(iso) {
  const parts = iso.split('-');
  return parts[2] + '/' + parts[1];
}

function esc(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}

function updateTimestamp() {
  const now = new Date();
  document.getElementById('lastUpdate').textContent =
    'Actualizado ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}// ═══════════════════════════════════════════════════════════
//  Configuración — Editar estos valores para tu setup
// ═══════════════════════════════════════════════════════════
const CONFIG = {
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS3IIb-he7BSLhETSIBVNMN64umgVYJG33luwPJmWKTEb--El7282hOaAT0vXFY5pnJGnY20eKM-bFt/pub?gid=606239050&single=true&output=csv',
  PASSWORD_HASH: 'f09898c57d2c74f58f08603a63922a20675dc36e81358348cb000b9cd0277e22',
  AUTH_DAYS: 30,
  REFRESH_MINUTES: 5,
  UPCOMING_DAYS: 60,
};

// ═══════════════════════════════════════════════════════════
//  Autenticación
// ═══════════════════════════════════════════════════════════
const AUTH_KEY = 'huespedes_auth';

function checkAuth() {
  const auth = localStorage.getItem(AUTH_KEY);
  if (auth) {
    try {
      const { expires } = JSON.parse(auth);
      if (expires > Date.now()) { showApp(); return; }
    } catch (e) { /* invalid JSON, show login */ }
  }
  showLogin();
}

function showLogin() {
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('passwordInput').focus();
}

function showApp() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadGuests();
  setInterval(loadGuests, CONFIG.REFRESH_MINUTES * 60 * 1000);
}

async function handleLogin() {
  const input = document.getElementById('passwordInput').value;
  const btn = document.getElementById('loginBtn');
  const errorEl = document.getElementById('errorMsg');
  if (!input) { errorEl.textContent = 'Ingresá la contraseña'; return; }
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  errorEl.textContent = '';
  try {
    const hash = await sha256(input);
    if (hash === CONFIG.PASSWORD_HASH) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({
        expires: Date.now() + CONFIG.AUTH_DAYS * 24 * 60 * 60 * 1000
      }));
      showApp();
    } else {
      errorEl.textContent = 'Contraseña incorrecta';
      document.getElementById('passwordInput').value = '';
      document.getElementById('passwordInput').focus();
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Acceder';
  }
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  document.getElementById('passwordInput').value = '';
  document.getElementById('errorMsg').textContent = '';
  showLogin();
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('passwordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  checkAuth();
});

// ═══════════════════════════════════════════════════════════
//  Cargar y parsear datos del Google Sheet
// ═══════════════════════════════════════════════════════════
async function loadGuests() {
  try {
    const res = await fetch(CONFIG.SHEET_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar el sheet');
    const csv = await res.text();
    const guests = parseCSV(csv);
    renderGuests(guests);
    updateTimestamp();
  } catch (err) {
    console.error('Error cargando datos:', err);
    const list = document.getElementById('guestList');
    if (list.querySelector('.loading')) {
      list.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><h3>No se pudieron cargar los datos</h3><p>Verificá que el Google Sheet esté publicado correctamente.<br><button class="btn-primary" style="margin-top:16px;width:auto;padding:10px 24px;" onclick="loadGuests()">Reintentar</button></p></div>';
    }
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const guests = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 6) continue;
    const [updated, name, checkIn, checkOut, bookingId, status, notes] = fields.map(f => f.trim());
    if (!name || status.toLowerCase() === 'cancelled' || status.toLowerCase() === 'cancelado') continue;
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) continue;
    guests.push({ name, checkIn, checkOut, bookingId, status: status || 'confirmed', notes: notes || '', updated });
  }
  return guests.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'));
}

// ═══════════════════════════════════════════════════════════
//  Renderizado
// ═══════════════════════════════════════════════════════════
function renderGuests(guests) {
  const container = document.getElementById('guestList');
  container.innerHTML = '';
  if (guests.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🏠</div><h3>Sin huéspedes registrados</h3><p>Cuando haya reservas, aparecerán acá automáticamente.</p></div>';
    return;
  }
  const today = todayStr();
  const current = guests.filter(g => g.checkIn <= today && g.checkOut > today);
  const upcoming = guests.filter(g => g.checkIn > today);

  if (current.length > 0) {
    container.appendChild(makeSection('Ahora en el edificio', current, true));
  } else {
    const div = document.createElement('div');
    div.className = 'section';
    div.innerHTML = '<div class="section-label">Ahora en el edificio</div><div style="background:#fff;border-radius:16px;padding:24px;text-align:center;color:#86868b;font-size:14px;">Sin huéspedes en este momento</div>';
    container.appendChild(div);
  }

  const upcomingFiltered = upcoming.filter(g => {
    const daysUntil = (new Date(g.checkIn) - new Date(today)) / 86400000;
    return daysUntil <= CONFIG.UPCOMING_DAYS;
  });
  if (upcomingFiltered.length > 0) {
    container.appendChild(makeSection('Próximos (' + upcomingFiltered.length + ')', upcomingFiltered, false));
  }
  checkFreshness(guests);
}

function makeSection(title, guests, isCurrent) {
  const section = document.createElement('div');
  section.className = 'section';
  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = title;
  section.appendChild(label);
  guests.forEach(g => section.appendChild(makeCard(g, isCurrent)));
  return section;
}

function makeCard(guest, isCurrent) {
  const card = document.createElement('div');
  card.className = 'guest-card' + (isCurrent ? ' current' : '');
  const nights = Math.ceil((new Date(guest.checkOut) - new Date(guest.checkIn)) / 86400000);
  const fmtIn = formatDate(guest.checkIn);
  const fmtOut = formatDate(guest.checkOut);
  card.innerHTML = '<div class="guest-name">' + esc(guest.name) + '</div>' +
    '<div class="guest-dates">' +
    '<div class="date-block"><label>Entrada</label><span>' + fmtIn + '</span></div>' +
    '<div class="date-block"><label>Salida</label><span>' + fmtOut + '</span></div>' +
    '<div class="date-block"><label>Noches</label><span>' + nights + '</span></div>' +
    '</div>' +
    (guest.notes ? '<div class="guest-notes">' + esc(guest.notes) + '</div>' : '');
  return card;
}

// ═══════════════════════════════════════════════════════════
//  Utilidades
// ═══════════════════════════════════════════════════════════
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function esc(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}

function updateTimestamp() {
  const now = new Date();
  document.getElementById('lastUpdate').textContent =
    'Actualizado ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function checkFreshness(guests) {
  const banner = document.getElementById('warningBanner');
  if (!guests.length || !guests[0].updated) { banner.style.display = 'none'; return; }
  try {
    const last = new Date(guests[guests.length - 1].updated);
    const hours = (Date.now() - last) / 3600000;
    if (hours > 72) {
      banner.textContent = '⚠️ Los datos no se actualizan hace ' + Math.round(hours / 24) + ' días. Puede haber un problema con la sincronización.';
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  } catch (e) { banner.style.display = 'none'; }
}
