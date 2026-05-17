const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

function appDataFolder(){
  return path.join(app.getPath('documents'), 'Constru Presupuestos PRO');
}

function updateFolder(){
  return path.join(appDataFolder(), 'Actualizaciones');
}

function githubConfigPath(){
  return path.join(appDataFolder(), 'github-update.json');
}

function ensureFolders(){
  fs.mkdirSync(updateFolder(), { recursive: true });
}

function ensureGithubConfig(){
  ensureFolders();
  const file = githubConfigPath();
  if(!fs.existsSync(file)){
    fs.writeFileSync(file, JSON.stringify({
      owner: 'TU_USUARIO_GITHUB',
      repo: 'constru-presupuestos-pro',
      enabled: false
    }, null, 2));
  }
  return file;
}

function readGithubConfig(){
  const file = ensureGithubConfig();
  try {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    if(!cfg.enabled || !cfg.owner || !cfg.repo || cfg.owner === 'TU_USUARIO_GITHUB') return null;
    return cfg;
  } catch {
    return null;
  }
}

function parseVersion(v){
  return String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}

function compareVersions(a, b){
  const av = parseVersion(a);
  const bv = parseVersion(b);
  for(let i = 0; i < Math.max(av.length, bv.length); i++){
    const diff = (av[i] || 0) - (bv[i] || 0);
    if(diff) return diff;
  }
  return 0;
}

function requestJson(url){
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Constru-Presupuestos-PRO',
        'Accept': 'application/vnd.github+json'
      }
    }, res => {
      if(res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
        requestJson(res.headers.location).then(resolve, reject);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if(res.statusCode < 200 || res.statusCode >= 300){
          reject(new Error(`GitHub respondio ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, target){
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(target);
    https.get(url, { headers: { 'User-Agent': 'Constru-Presupuestos-PRO' } }, res => {
      if(res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
        file.close();
        fs.rmSync(target, { force: true });
        downloadFile(res.headers.location, target).then(resolve, reject);
        return;
      }
      if(res.statusCode < 200 || res.statusCode >= 300){
        file.close();
        fs.rmSync(target, { force: true });
        reject(new Error(`Descarga respondio ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(target)));
    }).on('error', err => {
      file.close();
      fs.rmSync(target, { force: true });
      reject(err);
    });
  });
}

function findLocalUpdate(){
  ensureFolders();
  const current = app.getVersion();
  const rx = /Constru Presupuestos PRO Setup ([0-9]+(?:\.[0-9]+){1,3})\.exe$/i;
  return fs.readdirSync(updateFolder())
    .map(name => {
      const match = name.match(rx);
      if(!match) return null;
      return { name, version: match[1], file: path.join(updateFolder(), name) };
    })
    .filter(Boolean)
    .filter(item => compareVersions(item.version, current) > 0)
    .sort((a, b) => compareVersions(b.version, a.version))[0] || null;
}

async function findGithubUpdate(){
  const cfg = readGithubConfig();
  if(!cfg) return null;
  const release = await requestJson(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases/latest`);
  const version = String(release.tag_name || release.name || '').replace(/^v/i, '');
  if(compareVersions(version, app.getVersion()) <= 0) return null;
  const asset = (release.assets || []).find(a => /Constru Presupuestos PRO Setup .*\.exe$/i.test(a.name))
    || (release.assets || []).find(a => /\.exe$/i.test(a.name));
  if(!asset) return null;
  return { version, name: asset.name, url: asset.browser_download_url };
}

async function installUpdate(update){
  if(update.file){
    await shell.openPath(update.file);
    app.quit();
    return;
  }
  const target = path.join(updateFolder(), update.name || `Constru Presupuestos PRO Setup ${update.version}.exe`);
  await downloadFile(update.url, target);
  await shell.openPath(target);
  app.quit();
}

async function promptUpdate(update, source){
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Actualizar ahora', 'Despues'],
    defaultId: 0,
    cancelId: 1,
    title: 'Actualizacion disponible',
    message: `Hay una version nueva: ${update.version}`,
    detail: `Origen: ${source}\nVersion instalada: ${app.getVersion()}\n\nLa app descargara/abrira el instalador y se cerrara para actualizar.`
  });
  if(result.response === 0) await installUpdate(update);
}

async function checkForUpdates(showNoUpdate = true){
  try {
    const githubUpdate = await findGithubUpdate();
    if(githubUpdate){
      await promptUpdate(githubUpdate, 'GitHub');
      return;
    }
  } catch (err) {
    if(showNoUpdate) {
      dialog.showMessageBox({
        type: 'warning',
        title: 'GitHub',
        message: 'No se pudo revisar GitHub.',
        detail: `${err.message}\n\nSe revisara la carpeta local como respaldo.`
      });
    }
  }

  let localUpdate = null;
  try {
    localUpdate = findLocalUpdate();
  } catch (err) {
    if(showNoUpdate) dialog.showErrorBox('Actualizaciones', 'No se pudo revisar la carpeta local de actualizaciones.');
    return;
  }

  if(localUpdate){
    await promptUpdate(localUpdate, 'Carpeta local');
    return;
  }

  if(showNoUpdate) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Actualizaciones',
      message: 'No hay actualizaciones disponibles.',
      detail: `GitHub: ${readGithubConfig() ? 'configurado' : 'pendiente de configurar'}\nCarpeta local:\n${updateFolder()}`
    });
  }
}

function openUpdateFolder(){
  ensureFolders();
  shell.openPath(updateFolder());
}

function openGithubConfig(){
  const file = ensureGithubConfig();
  shell.showItemInFolder(file);
}

function createWindow(){
  const win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1000,
    minHeight: 650,
    title: 'Constru Presupuestos PRO',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.loadFile('index.html');
  win.once('ready-to-show', () => setTimeout(() => checkForUpdates(false), 1500));
  return win;
}

const template = [
  { label: 'Archivo', submenu: [ { role: 'reload', label: 'Recargar' }, { type:'separator' }, { role: 'quit', label: 'Salir' } ] },
  { label: 'Ver', submenu: [ { role:'resetZoom', label:'Tamano normal' }, { role:'zoomIn', label:'Acercar' }, { role:'zoomOut', label:'Alejar' }, { role:'togglefullscreen', label:'Pantalla completa' } ] },
  { label: 'Ayuda', submenu: [
    { label:'Buscar actualizaciones', click: () => checkForUpdates(true) },
    { label:'Configurar GitHub Updates', click: openGithubConfig },
    { label:'Abrir carpeta de actualizaciones', click: openUpdateFolder },
    { type:'separator' },
    { label:'Abrir herramientas', role:'toggleDevTools' }
  ] }
];

app.whenReady().then(()=>{ ensureGithubConfig(); Menu.setApplicationMenu(Menu.buildFromTemplate(template)); createWindow(); });
app.on('window-all-closed',()=>{ if(process.platform !== 'darwin') app.quit(); });
app.on('activate',()=>{ if(BrowserWindow.getAllWindows().length===0) createWindow(); });
