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
