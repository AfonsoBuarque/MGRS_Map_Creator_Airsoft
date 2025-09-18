// Leaflet map
const map = L.map('map').setView([-23.55, -46.63], 12); // São Paulo default

// Multiple tile layer options
const tileLayers = {
  'Satélite (Google)': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '&copy; Google'
  }),
  'Satélite Híbrido': L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '&copy; Google'
  }),
  'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  })
};

// Add default satellite layer
tileLayers['Satélite (Google)'].addTo(map);

// Add layer control
L.control.layers(tileLayers).addTo(map);

// Global state
const markers = [];
const legendCategories = new Map();
const legendEl = document.getElementById('legend');
const history = [];
let historyIndex = -1;
let currentRoute = null;

// Theme management
const themeToggle = document.getElementById('theme-toggle');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function setTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const isDark = saved ? saved === 'dark' : prefersDark.matches;
  setTheme(isDark);
  if (themeToggle) themeToggle.checked = isDark;
}

// History management for undo/redo
function saveState() {
  const state = {
    markers: markers.map(m => {
      const ll = m.getLatLng();
      const popup = m.getPopup()?.getContent() || '';
      const name = /<h3>(.*?)<\/h3>/.exec(popup)?.[1] || 'Ponto';
      const mgrs = /MGRS:<\/strong>\s(.*?)<\/p>/.exec(popup)?.[1] || '';
      const category = /Categoria:<\/strong>\s(.*)/.exec(popup)?.[1] || 'Ponto';
      const iconType = m._iconType || 'circle';
      const color = m.options.icon.options.html.match(/--pin:(#[a-fA-F0-9]{6})/)?.[1] || '#3388ff';
      return {name, mgrs, category, iconType, lat: ll.lat, lon: ll.lng, color};
    }),
    timestamp: Date.now()
  };
  
  // Remove future history if we're not at the end
  if (historyIndex < history.length - 1) {
    history.splice(historyIndex + 1);
  }
  
  history.push(state);
  historyIndex = history.length - 1;
  
  // Limit history size
  if (history.length > 50) {
    history.shift();
    historyIndex--;
  }
  
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) undoBtn.disabled = historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = historyIndex >= history.length - 1;
}

function addLegend(category, color) {
  if (!category) return;
  if (!legendCategories.has(category)) {
    legendCategories.set(category, color);
    const item = document.createElement('div');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = color;
    const label = document.createElement('span');
    label.textContent = category;
    item.appendChild(swatch);
    item.appendChild(label);
    legendEl.appendChild(item);
  }
}

// Icon mapping for different marker types
const iconMap = {
  circle: { emoji: '', isCircle: true },
  target: { emoji: '🎯', isCircle: false },
  base: { emoji: '🏕️', isCircle: false },
  enemy: { emoji: '⚠️', isCircle: false },
  observation: { emoji: '👁️', isCircle: false },
  extraction: { emoji: '🚁', isCircle: false },
  medical: { emoji: '🏥', isCircle: false },
  supply: { emoji: '📦', isCircle: false },
  checkpoint: { emoji: '🚧', isCircle: false },
  sniper: { emoji: '🔭', isCircle: false }
};

function makeDivIcon(color, label, iconType = 'circle') {
  const iconData = iconMap[iconType] || iconMap.circle;
  
  let html;
  if (iconData.isCircle) {
    // Traditional circle pin
    html = `
      <div class="pin" style="--pin:${color}"></div>
      <div class="pin-label">${label || ''}</div>
    `;
  } else {
    // Emoji-based icon with colored background
    html = `
      <div class="emoji-pin" style="--pin:${color}">
        <span class="emoji-icon">${iconData.emoji}</span>
      </div>
      <div class="pin-label">${label || ''}</div>
    `;
  }
  
  return L.divIcon({
    html,
    className: 'div-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
}

function fitBoundsToMarkers() {
  if (markers.length === 0) return;
  const group = new L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(0.2));
}

// MGRS validation
function validateMGRS(mgrs) {
  const cleanMGRS = mgrs.replace(/\s/g, '').toUpperCase();
  
  // MGRS pattern: 1-2 digits + 1 letter + 2 letters + 2-10 digits (even number)
  const pattern = /^\d{1,2}[C-X][A-Z]{2}\d{2,10}$/;
  
  if (!pattern.test(cleanMGRS)) {
    return false;
  }
  
  // Find where numeric coordinates start (after grid zone + 100km square)
  let coordStart = 0;
  for (let i = 3; i < cleanMGRS.length; i++) {
    if (/\d/.test(cleanMGRS[i])) {
      coordStart = i;
      break;
    }
  }
  
  const coordPart = cleanMGRS.substring(coordStart);
  if (coordPart.length % 2 !== 0) {
    return false;
  }
  
  // Check if coordinate length is valid (2, 4, 6, 8, or 10 digits)
  const validLengths = [2, 4, 6, 8, 10];
  return validLengths.includes(coordPart.length);
}

// Get selected icon type
function getSelectedIcon(selectorId = '.icon-selector') {
  const activeIcon = document.querySelector(`${selectorId} .icon-option.active`);
  return activeIcon ? activeIcon.dataset.icon : 'circle';
}

// Enhanced point addition with validation
async function addPoint({name, mgrs, color, category, iconType}) {
  // Validate MGRS format
  const cleanMGRS = mgrs.replace(/\s/g, '').toUpperCase();
  if (!validateMGRS(cleanMGRS)) {
    showNotification('Formato MGRS inválido. Exemplo: 23KKP4014597230', 'error');
    return false;
  }

  const resp = await fetch('/convert', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({points: [{name, mgrs: cleanMGRS, color, category}]})
  });
  const data = await resp.json();
  const p = data.points[0];
  if (p.error) {
    showNotification(`${p.name}: ${p.error}`, 'error');
    return false;
  }
  
  const icon = makeDivIcon(p.color, '', iconType || 'circle');
  const marker = L.marker([p.lat, p.lon], {icon})
    .addTo(map)
    .bindPopup(`
      <div class="marker-popup">
        <h3>${p.name}</h3>
        <p><strong>MGRS:</strong> ${p.mgrs}</p>
        <p><strong>Coordenadas:</strong> ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</p>
        <p><strong>Categoria:</strong> ${p.category}</p>
        <p><strong>Ícone:</strong> ${getIconName(iconType || 'circle')}</p>
        <div class="popup-actions">
          <button onclick="editMarker('${markers.length}')">Editar</button>
          <button onclick="deleteMarker('${markers.length}')">Excluir</button>
        </div>
      </div>
    `);
  
  // Store icon type in marker for later reference
  marker._iconType = iconType || 'circle';
  
  markers.push(marker);
  addLegend(p.category, p.color);
  fitBoundsToMarkers();
  saveState();
  showNotification(`Ponto "${p.name}" adicionado com sucesso!`, 'success');
  return true;
}

// Get icon display name
function getIconName(iconType) {
  const names = {
    circle: 'Padrão',
    target: 'Alvo',
    base: 'Base',
    enemy: 'Inimigo',
    observation: 'Observação',
    extraction: 'Extração',
    medical: 'Médico',
    supply: 'Suprimentos',
    checkpoint: 'Checkpoint',
    sniper: 'Sniper'
  };
  return names[iconType] || 'Padrão';
}

// Notification system
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  const container = document.getElementById('notifications') || createNotificationContainer();
  container.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function createNotificationContainer() {
  const container = document.createElement('div');
  container.id = 'notifications';
  container.className = 'notifications-container';
  document.body.appendChild(container);
  return container;
}

// Search and filter functionality
function filterMarkers(searchTerm, categoryFilter) {
  markers.forEach(marker => {
    const popup = marker.getPopup()?.getContent() || '';
    const name = /<h3>(.*?)<\/h3>/.exec(popup)?.[1] || '';
    const category = /Categoria:<\/strong>\s(.*)/.exec(popup)?.[1] || '';
    
    const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || category === categoryFilter;
    
    if (matchesSearch && matchesCategory) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });
}

// Session management
function saveSession() {
  const session = {
    markers: markers.map(m => {
      const ll = m.getLatLng();
      const popup = m.getPopup()?.getContent() || '';
      const name = /<h3>(.*?)<\/h3>/.exec(popup)?.[1] || 'Ponto';
      const mgrs = /MGRS:<\/strong>\s(.*?)<\/p>/.exec(popup)?.[1] || '';
      const category = /Categoria:<\/strong>\s(.*)/.exec(popup)?.[1] || 'Ponto';
      const color = m.options.icon.options.html.match(/--pin:(#[a-fA-F0-9]{6})/)?.[1] || '#3388ff';
      return {name, mgrs, category, lat: ll.lat, lon: ll.lng, color};
    }),
    timestamp: Date.now(),
    mapCenter: map.getCenter(),
    mapZoom: map.getZoom()
  };
  
  const sessions = JSON.parse(localStorage.getItem('mgrsSessions') || '[]');
  const sessionName = prompt('Nome da sessão:', `Sessão ${new Date().toLocaleString()}`);
  
  if (sessionName) {
    session.name = sessionName;
    sessions.push(session);
    localStorage.setItem('mgrsSessions', JSON.stringify(sessions));
    showNotification('Sessão salva com sucesso!', 'success');
    updateSessionsList();
  }
}

function loadSession(sessionIndex) {
  const sessions = JSON.parse(localStorage.getItem('mgrsSessions') || '[]');
  const session = sessions[sessionIndex];
  
  if (!session) return;
  
  if (markers.length > 0 && !confirm('Isso irá substituir todos os pontos atuais. Continuar?')) {
    return;
  }
  
  clearAllMarkers();
  
  session.markers.forEach(point => {
    addPointFromData(point);
  });
  
  if (session.mapCenter && session.mapZoom) {
    map.setView([session.mapCenter.lat, session.mapCenter.lng], session.mapZoom);
  }
  
  showNotification(`Sessão "${session.name}" carregada!`, 'success');
}

function addPointFromData(point) {
  const iconType = point.iconType || 'circle';
  const icon = makeDivIcon(point.color, '', iconType);
  const marker = L.marker([point.lat, point.lon], {icon})
    .addTo(map)
    .bindPopup(`
      <div class="marker-popup">
        <h3>${point.name}</h3>
        <p><strong>MGRS:</strong> ${point.mgrs}</p>
        <p><strong>Coordenadas:</strong> ${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}</p>
        <p><strong>Categoria:</strong> ${point.category}</p>
        <p><strong>Ícone:</strong> ${getIconName(iconType)}</p>
        <div class="popup-actions">
          <button onclick="editMarker('${markers.length}')">Editar</button>
          <button onclick="deleteMarker('${markers.length}')">Excluir</button>
        </div>
      </div>
    `);
  
  // Store icon type in marker
  marker._iconType = iconType;
  
  markers.push(marker);
  addLegend(point.category, point.color);
}

// Utility functions
function clearAllMarkers() {
  markers.forEach(marker => map.removeLayer(marker));
  markers.length = 0;
  legendCategories.clear();
  legendEl.innerHTML = '';
  if (currentRoute) {
    map.removeLayer(currentRoute);
    currentRoute = null;
  }
}

function deleteMarker(index) {
  if (confirm('Tem certeza que deseja excluir este ponto?')) {
    const marker = markers[index];
    if (marker) {
      map.removeLayer(marker);
      markers.splice(index, 1);
      saveState();
      showNotification('Ponto excluído!', 'success');
    }
  }
}

// Global variable to track current editing marker
let currentEditingIndex = -1;

function editMarker(index) {
  const marker = markers[index];
  if (!marker) return;
  
  currentEditingIndex = index;
  
  // Extract current data from popup
  const popup = marker.getPopup()?.getContent() || '';
  const name = /<h3>(.*?)<\/h3>/.exec(popup)?.[1] || '';
  const mgrs = /MGRS:<\/strong>\s(.*?)<\/p>/.exec(popup)?.[1] || '';
  const category = /Categoria:<\/strong>\s(.*)/.exec(popup)?.[1] || '';
  
  // Get current color from marker icon
  const currentColor = marker.options.icon.options.html.match(/--pin:(#[a-fA-F0-9]{6})/)?.[1] || '#3388ff';
  
  // Get current icon type
  const currentIconType = marker._iconType || 'circle';
  
  // Populate modal fields
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-mgrs').value = mgrs;
  document.getElementById('edit-category').value = category;
  document.getElementById('edit-color').value = currentColor;
  
  // Set icon selection in modal
  const editSelector = document.getElementById('edit-icon-selector');
  editSelector.querySelectorAll('.icon-option').forEach(option => {
    option.classList.remove('active');
  });
  const currentIconOption = editSelector.querySelector(`[data-icon="${currentIconType}"]`);
  if (currentIconOption) {
    currentIconOption.classList.add('active');
  }
  
  // Show modal
  openEditModal();
}

function openEditModal() {
  const modal = document.getElementById('edit-modal');
  modal.classList.add('show');
  document.getElementById('edit-name').focus();
  
  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeEditModal();
    }
  });
}

function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  modal.classList.remove('show');
  currentEditingIndex = -1;
}

async function saveEditedMarker() {
  if (currentEditingIndex === -1) return;
  
  const name = document.getElementById('edit-name').value.trim();
  const mgrs = document.getElementById('edit-mgrs').value.trim();
  const category = document.getElementById('edit-category').value.trim() || 'Ponto';
  const color = document.getElementById('edit-color').value;
  const iconType = getSelectedIcon('#edit-icon-selector');
  
  if (!name || !mgrs) {
    showNotification('Nome e MGRS são obrigatórios', 'error');
    return;
  }
  
  // Validate MGRS format
  const cleanMGRS = mgrs.replace(/\s/g, '').toUpperCase();
  if (!validateMGRS(cleanMGRS)) {
    showNotification('Formato MGRS inválido. Exemplo: 23KKP4014597230', 'error');
    return;
  }
  
  try {
    // Convert MGRS to coordinates
    const resp = await fetch('/convert', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({points: [{name, mgrs: cleanMGRS, color, category}]})
    });
    
    const data = await resp.json();
    const point = data.points[0];
    
    if (point.error) {
      showNotification(`Erro: ${point.error}`, 'error');
      return;
    }
    
    // Update marker
    const marker = markers[currentEditingIndex];
    const newLatLng = L.latLng(point.lat, point.lon);
    
    // Update marker position
    marker.setLatLng(newLatLng);
    
    // Update marker icon with new color and icon type
    const newIcon = makeDivIcon(color, '', iconType);
    marker.setIcon(newIcon);
    
    // Store new icon type
    marker._iconType = iconType;
    
    // Update popup content
    marker.setPopupContent(`
      <div class="marker-popup">
        <h3>${name}</h3>
        <p><strong>MGRS:</strong> ${cleanMGRS}</p>
        <p><strong>Coordenadas:</strong> ${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}</p>
        <p><strong>Categoria:</strong> ${category}</p>
        <p><strong>Ícone:</strong> ${getIconName(iconType)}</p>
        <div class="popup-actions">
          <button onclick="editMarker('${currentEditingIndex}')">Editar</button>
          <button onclick="deleteMarker('${currentEditingIndex}')">Excluir</button>
        </div>
      </div>
    `);
    
    // Update legend if category changed
    addLegend(category, color);
    
    // Close modal and save state
    closeEditModal();
    saveState();
    showNotification('Ponto atualizado com sucesso!', 'success');
    
  } catch (error) {
    showNotification('Erro ao atualizar ponto: ' + error.message, 'error');
  }
}

function updateSessionsList() {
  const sessions = JSON.parse(localStorage.getItem('mgrsSessions') || '[]');
  const select = document.getElementById('sessions-list');
  if (!select) return;
  
  select.innerHTML = '<option value="">Selecione uma sessão...</option>';
  sessions.forEach((session, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${session.name} (${session.markers.length} pontos)`;
    select.appendChild(option);
  });
}

// Undo/Redo functions
function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    restoreState(history[historyIndex]);
    updateUndoRedoButtons();
    showNotification('Ação desfeita', 'info');
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    restoreState(history[historyIndex]);
    updateUndoRedoButtons();
    showNotification('Ação refeita', 'info');
  }
}

function restoreState(state) {
  clearAllMarkers();
  state.markers.forEach(point => {
    addPointFromData(point);
  });
}

// Import functionality
function importFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      let data;
      
      if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
        data = JSON.parse(content);
        importGeoJSON(data);
      } else if (file.name.endsWith('.csv')) {
        importCSV(content);
      } else {
        showNotification('Formato de arquivo não suportado', 'error');
      }
    } catch (error) {
      showNotification('Erro ao processar arquivo: ' + error.message, 'error');
    }
  };
  reader.readAsText(file);
}

function importGeoJSON(data) {
  if (data.type === 'FeatureCollection' && data.features) {
    let imported = 0;
    data.features.forEach(feature => {
      if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates;
        const props = feature.properties || {};
        const point = {
          name: props.name || 'Ponto Importado',
          mgrs: props.mgrs || '',
          category: props.category || 'Importado',
          lat: lat,
          lon: lon,
          color: props.color || '#3388ff'
        };
        addPointFromData(point);
        imported++;
      }
    });
    showNotification(`${imported} pontos importados do GeoJSON`, 'success');
    saveState();
  }
}

function importCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  let imported = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (values.length >= headers.length && values[0]) {
      const point = {
        name: values[headers.indexOf('name')] || `Ponto ${i}`,
        mgrs: values[headers.indexOf('mgrs')] || '',
        category: values[headers.indexOf('category')] || 'Importado',
        lat: parseFloat(values[headers.indexOf('latitude')]),
        lon: parseFloat(values[headers.indexOf('longitude')]),
        color: values[headers.indexOf('color')] || '#3388ff',
        iconType: values[headers.indexOf('iconType')] || 'circle'
      };
      
      if (!isNaN(point.lat) && !isNaN(point.lon)) {
        addPointFromData(point);
        imported++;
      }
    }
  }
  
  showNotification(`${imported} pontos importados do CSV`, 'success');
  saveState();
}

// Event Listeners
document.getElementById('point-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const mgrs = document.getElementById('mgrs').value.trim();
  const color = document.getElementById('color').value;
  const category = document.getElementById('category').value.trim() || 'Ponto';
  const iconType = getSelectedIcon();
  
  if (!name || !mgrs) {
    showNotification('Nome e MGRS são obrigatórios', 'error');
    return;
  }
  
  const success = await addPoint({name, mgrs, color, category, iconType});
  if (success) {
    e.target.reset();
    document.getElementById('color').value = '#ff3b30';
    // Reset icon selection to default
    document.querySelectorAll('.icon-selector .icon-option').forEach(option => {
      option.classList.remove('active');
    });
    document.querySelector('.icon-selector .icon-option[data-icon="circle"]').classList.add('active');
  }
});

// Export helpers
function download(filename, content, mime) {
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('export-geojson').addEventListener('click', () => {
  const feats = [];
  markers.forEach(m => {
    const ll = m.getLatLng();
    const popup = m.getPopup()?.getContent() || '';
    const name = /<b>(.*?)<\/b>/.exec(popup)?.[1] || 'Ponto';
    const mgrs = /MGRS:\s(.*?)<br>/.exec(popup)?.[1] || '';
    const category = /Categoria:\s(.*)/.exec(popup)?.[1] || 'Ponto';
    feats.push({ type:"Feature", properties:{name, mgrs, category}, geometry:{type:"Point", coordinates:[ll.lng, ll.lat]} });
  });
  const gj = {type:"FeatureCollection", features:feats};
  download("marcadores.geojson", JSON.stringify(gj, null, 2), "application/geo+json");
});

document.getElementById('export-csv').addEventListener('click', () => {
  let rows = [["name","mgrs","category","latitude","longitude"]];
  markers.forEach(m => {
    const ll = m.getLatLng();
    const popup = m.getPopup()?.getContent() || '';
    const name = /<b>(.*?)<\/b>/.exec(popup)?.[1] || 'Ponto';
    const mgrs = /MGRS:\s(.*?)<br>/.exec(popup)?.[1] || '';
    const category = /Categoria:\s(.*)/.exec(popup)?.[1] || 'Ponto';
    rows.push([name, mgrs, category, ll.lat, ll.lng]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  download("marcadores.csv", csv, "text/csv");
});

document.getElementById('export-kml').addEventListener('click', async () => {
  const points = markers.map(m => {
    const ll = m.getLatLng();
    const popup = m.getPopup()?.getContent() || '';
    const name = /<h3>(.*?)<\/h3>/.exec(popup)?.[1] || 'Ponto';
    const mgrs = /MGRS:<\/strong>\s(.*?)<\/p>/.exec(popup)?.[1] || '';
    const category = /Categoria:<\/strong>\s(.*)/.exec(popup)?.[1] || 'Ponto';
    const iconType = m._iconType || 'circle';
    
    // Get color from marker icon
    const color = m.options.icon.options.html.match(/--pin:(#[a-fA-F0-9]{6})/)?.[1] || '#3388ff';
    
    return {
      name, 
      mgrs, 
      category, 
      iconType,
      color,
      lat: ll.lat, 
      lon: ll.lng
    };
  });
  if (points.length === 0) {
    alert('Nenhum ponto para exportar');
    return;
  }
  
  const connectRoute = confirm('Deseja conectar os pontos com uma rota?');
  
  const resp = await fetch('/export_kml', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({points, connectRoute})
  });
  
  if (resp.ok) {
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marcadores_export.kml';
    a.click();
    URL.revokeObjectURL(url);
  } else {
    showNotification('Erro ao exportar KML', 'error');
  }
});

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  updateSessionsList();
  updateUndoRedoButtons();
  
  // Save initial state
  saveState();
  
  // Setup icon selector event listeners
  document.querySelectorAll('.icon-selector').forEach(selector => {
    selector.addEventListener('click', (e) => {
      const iconOption = e.target.closest('.icon-option');
      if (iconOption) {
        // Remove active class from all options in this selector
        selector.querySelectorAll('.icon-option').forEach(option => {
          option.classList.remove('active');
        });
        // Add active class to clicked option
        iconOption.classList.add('active');
      }
    });
  });
  
  // Setup event listeners
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const fileInput = document.getElementById('file-input');
  const themeToggle = document.getElementById('theme-toggle');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const clearBtn = document.getElementById('clear-all-btn');
  const saveSessionBtn = document.getElementById('save-session-btn');
  const sessionsList = document.getElementById('sessions-list');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const categoryValue = categoryFilter ? categoryFilter.value : '';
      filterMarkers(e.target.value, categoryValue);
    });
  }
  
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      const searchValue = searchInput ? searchInput.value : '';
      filterMarkers(searchValue, e.target.value);
    });
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        importFile(file);
        e.target.value = ''; // Reset input
      }
    });
  }
  
  if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
      setTheme(e.target.checked);
    });
  }
  
  if (undoBtn) undoBtn.addEventListener('click', undo);
  if (redoBtn) redoBtn.addEventListener('click', redo);
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja limpar todos os pontos?')) {
        clearAllMarkers();
        saveState();
        showNotification('Todos os pontos foram removidos', 'info');
      }
    });
  }
  
  if (saveSessionBtn) {
    saveSessionBtn.addEventListener('click', saveSession);
  }
  
  if (sessionsList) {
    sessionsList.addEventListener('change', (e) => {
      if (e.target.value) {
        loadSession(parseInt(e.target.value));
      }
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Close modal with ESC key
    if (e.key === 'Escape') {
      const modal = document.getElementById('edit-modal');
      if (modal && modal.classList.contains('show')) {
        closeEditModal();
        return;
      }
    }
    
    if (e.ctrlKey || e.metaKey) {
      switch(e.key) {
        case 'z':
          if (e.shiftKey) {
            e.preventDefault();
            redo();
          } else {
            e.preventDefault();
            undo();
          }
          break;
        case 'y':
          e.preventDefault();
          redo();
          break;
        case 's':
          e.preventDefault();
          saveSession();
          break;
      }
    }
  });
});
