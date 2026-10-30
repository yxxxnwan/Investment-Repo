const CACHE='investment-compass-ios-v1';
const ASSETS=['./','./index.html','./style.css','./app.js','./pwa.js','./manifest.webmanifest','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return res;})));
});
