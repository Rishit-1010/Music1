(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const audio = $('audioElement');
  const state = { tracks: [], currentId: null, view: 'All Tracks', query: '', shuffle: false, repeat: false, timerId: null, timerEnd: 0, timerInterval: null, pendingFile: null, objectUrls: new Map(), db: null };
  const CATEGORY_MAP = {
    'phonk':'Phonk','english':'English & Other','other':'English & Other','hindi':'Hindi/Gujarati','gujarati':'Hindi/Gujarati',
    'instrumental':'Instrumental','devotional':'Devotional','spanish':'English & Other'
  };
  const categoryFor = (name) => {
    const s = name.toLowerCase();
    if (/believer|unstoppable|legends never die|hymn for the weekend|go down|i.m a peaky|skyfall|english/.test(s)) return 'English & Other';
    if (/kgf|goti lo|hindi|gujarati|nemros/.test(s)) return /goti lo/.test(s) ? 'Hindi/Gujarati' : (/nemros/.test(s) ? 'Devotional' : 'Hindi/Gujarati');
    if (/argentina 2026|world cup song/.test(s)) return 'English & Other';
    if (/instrumental/.test(s)) return 'Instrumental';
    if (/devotional/.test(s)) return 'Devotional';
    return 'Phonk';
  };
  const titleFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b[a-z]/g, m => m.toUpperCase());
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentTrack = () => state.tracks.find(t => t.id === state.currentId) || null;
  const formatTime = (n) => { if (!Number.isFinite(n) || n < 0) return '0:00'; const m = Math.floor(n/60); return `${m}:${String(Math.floor(n%60)).padStart(2,'0')}`; };
  const isLiked = (track) => track && (track.liked === true);
  const getVisibleTracks = () => {
    let list = [...state.tracks];
    if (state.view === 'Phonk' || state.view === 'English & Other' || state.view === 'Hindi/Gujarati' || state.view === 'Instrumental' || state.view === 'Devotional') list = list.filter(t => t.category === state.view);
    else if (state.view === 'Liked Songs') list = list.filter(isLiked);
    else if (state.view === 'Recently Played') list = list.filter(t => t.lastPlayed).sort((a,b) => b.lastPlayed-a.lastPlayed);
    else if (state.view === 'Now Playing') list = currentTrack() ? [currentTrack()] : [];
    if (state.query) list = list.filter(t => `${t.title} ${t.category}`.toLowerCase().includes(state.query.toLowerCase()));
    return list;
  };
  function artworkMarkup(track, large=false) {
    if (track && track.artwork) return `<img src="${esc(track.artwork)}" alt="">`;
    return `<span class="theme-artwork"><img class="logo-dark" src="assets/music-logo-dark.png" alt=""><img class="logo-light" src="assets/music-logo-light.png" alt=""></span>`;
  }
  function render() {
    $('collectionTitle').textContent = state.view;
    $('collectionView').hidden = state.view === 'Now Playing';
    $('nowPlayingView').hidden = state.view !== 'Now Playing';
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    const list = getVisibleTracks();
    $('songList').innerHTML = list.map((t, i) => `
      <article class="song-row ${t.id === state.currentId ? 'is-playing' : ''}" data-id="${esc(t.id)}">
        <span class="song-number">${String(i+1).padStart(2,'0')}</span>
        <div class="album-art">${artworkMarkup(t)}</div>
        <span class="song-title" title="${esc(t.title)}">${esc(t.title)}</span>
        <span class="song-category">${esc(t.category)}</span>
        <button class="heart-button ${isLiked(t) ? 'liked' : ''}" data-action="like" aria-label="${isLiked(t) ? 'Unlike' : 'Like'} ${esc(t.title)}">${isLiked(t) ? '♥' : '♡'}</button>
        <button class="row-play" data-action="play" aria-label="Play ${esc(t.title)}">${t.id === state.currentId && !audio.paused ? 'Ⅱ' : '▶'}</button>
      </article>`).join('');
    $('emptyState').hidden = list.length !== 0;
    if (!list.length) $('emptyState').textContent = state.query ? 'No matching songs found.' : (state.view === 'Liked Songs' ? 'Tap a heart beside any song to save it here.' : 'No songs in this collection yet.');
    updateCurrentUI();
  }
  function updateCurrentUI() {
    const t = currentTrack();
    $('miniTitle').textContent = t ? t.title : 'Choose a song';
    $('miniCategory').textContent = t ? t.category : 'Your library';
    $('miniArtwork').innerHTML = artworkMarkup(t);
    $('largeArtwork').innerHTML = artworkMarkup(t, true);
    $('largeTrackTitle').textContent = t ? t.title : 'Choose a song';
    $('largeTrackCategory').textContent = t ? t.category : 'Music';
    $('playButton').textContent = t && !audio.paused ? 'Ⅱ' : '▶';
    $('largePlay').textContent = t && !audio.paused ? 'Ⅱ' : '▶';
    $('largeLikeButton').textContent = isLiked(t) ? '♥' : '♡';
    $('largeLikeButton').classList.toggle('liked', isLiked(t));
    document.title = t ? `${t.title} — Rishit's Stereo` : "Rishit's Stereo";
  }
  function chooseView(view) { state.view = view; render(); closeSidebar(); }
  function closeSidebar() { $('sidebar').classList.remove('open'); $('sidebarBackdrop').classList.remove('visible'); }
  function openSidebar() { $('sidebar').classList.add('open'); $('sidebarBackdrop').classList.add('visible'); }
  function setTheme(light) {
    document.body.classList.toggle('light-theme', light);
    $('themeButton').setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    localStorage.setItem('stereo-theme', light ? 'light' : 'dark');
  }
  function persistLikes() { localStorage.setItem('stereo-likes', JSON.stringify(state.tracks.filter(t=>t.liked).map(t=>t.id))); }
  function toggleLike(id) {
    const t = state.tracks.find(x => x.id === id); if (!t) return;
    t.liked = !t.liked; persistLikes(); render();
    if (state.db) saveUserTrack(t).catch(()=>{});
  }
  async function playTrack(id) {
    const t = state.tracks.find(x => x.id === id); if (!t) return;
    if (state.currentId === id) {
      if (audio.paused) audio.play().catch(()=>{}); else audio.pause();
      updateCurrentUI(); render(); return;
    }
    state.currentId = id;
    t.lastPlayed = Date.now();
    audio.src = t.url;
    audio.load();
    try { await audio.play(); } catch (e) { /* Browser may require a direct user gesture or audio URL may be unavailable. */ }
    render();
  }
  function getQueue() { return getVisibleTracks().length ? getVisibleTracks() : state.tracks; }
  function goRelative(delta) {
    const q = getQueue(); if (!q.length) return;
    let idx = q.findIndex(t=>t.id===state.currentId);
    if (state.shuffle && q.length > 1) { let next=idx; while(next===idx) next=Math.floor(Math.random()*q.length); playTrack(q[next].id); return; }
    if (idx < 0) idx = 0; else idx = (idx + delta + q.length) % q.length;
    playTrack(q[idx].id);
  }
  function seekToRange(range) { if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Number(range.value)/1000*audio.duration; }
  function syncProgress() {
    const cur = audio.currentTime || 0, dur = audio.duration || 0, value = dur ? Math.round(cur/dur*1000) : 0;
    ['seekBar','largeSeek'].forEach(id=>$(id).value=value);
    $('currentTime').textContent = $('largeCurrentTime').textContent = formatTime(cur);
    $('duration').textContent = $('largeDuration').textContent = formatTime(dur);
  }
  function openModal(id) { $(id).hidden = false; }
  function closeModal(id) { $(id).hidden = true; }
  function startTimer(minutes) {
    clearTimeout(state.timerId); clearInterval(state.timerInterval);
    if (!Number.isFinite(minutes) || minutes <= 0) { $('timerStatus').textContent='Choose a time greater than zero.'; return; }
    state.timerEnd = Date.now() + minutes*60000;
    state.timerId = setTimeout(()=>{ audio.pause(); updateCurrentUI(); render(); state.timerEnd=0; clearInterval(state.timerInterval); $('timerStatus').textContent='Timer finished — music stopped.'; }, minutes*60000);
    state.timerInterval = setInterval(()=>{
      const left=Math.max(0,Math.ceil((state.timerEnd-Date.now())/60000));
      $('timerStatus').textContent=`Music will stop in about ${left} min.`;
      if (!state.timerEnd) clearInterval(state.timerInterval);
    },1000);
    $('timerStatus').textContent=`Timer set for ${minutes} minute${minutes===1?'':'s'}.`;
    $('cancelTimer').classList.add('visible');
    document.querySelectorAll('.timer-preset').forEach(b=>b.classList.remove('selected'));
  }
  function cancelTimer() {
    clearTimeout(state.timerId); clearInterval(state.timerInterval); state.timerId=null; state.timerEnd=0;
    $('timerStatus').textContent='Sleep timer cancelled.'; $('cancelTimer').classList.remove('visible');
  }

  const DB_NAME='rishits-stereo-db', STORE='uploads';
  function openDB() {
    return new Promise((resolve,reject)=>{
      if (!('indexedDB' in window)) { resolve(null); return; }
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id'});
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  function dbRequest(mode, action, value) {
    return new Promise((resolve,reject)=>{
      if (!state.db) return resolve(null);
      const tx=state.db.transaction(STORE,mode), store=tx.objectStore(STORE);
      let req;
      if(action==='getAll') req=store.getAll(); else if(action==='put') req=store.put(value); else req=store.delete(value);
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  async function saveUserTrack(track) {
    if (!state.db || !track.userUpload) return;
    await dbRequest('readwrite','put',{id:track.id,title:track.title,category:track.category,liked:!!track.liked,blob:track.blob,lastPlayed:track.lastPlayed||0});
  }
  async function loadUploads() {
    if (!state.db) return;
    const saved=await dbRequest('readonly','getAll');
    (saved||[]).forEach(s=>{
      if (!s.blob || state.tracks.some(t=>t.id===s.id)) return;
      const url=URL.createObjectURL(s.blob); state.objectUrls.set(s.id,url);
      state.tracks.push({id:s.id,title:s.title,category:s.category,liked:!!s.liked,url,blob:s.blob,userUpload:true,lastPlayed:s.lastPlayed||0});
    });
  }
  function addTrackFromFile(file, category) {
    const id='upload-'+Date.now()+'-'+Math.random().toString(36).slice(2,8), url=URL.createObjectURL(file);
    state.objectUrls.set(id,url);
    const t={id,title:titleFromFile(file.name),category,url,blob:file,userUpload:true,liked:false,lastPlayed:0};
    state.tracks.push(t);
    saveUserTrack(t).catch(()=>{});
    closeModal('categoryModal'); $('fileInput').value=''; state.pendingFile=null;
    state.view='All Tracks'; render(); playTrack(id);
  }
  async function loadReleaseTracks() {
    // Public GitHub Releases API; no token is needed for a public repository.
    const endpoint='https://api.github.com/repos/Rishit-1010/Music/releases/tags/Music1';
    try {
      const response=await fetch(endpoint,{headers:{'Accept':'application/vnd.github+json'}});
      if(!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const release=await response.json();
      const assets=(release.assets||[]).filter(a=>/\.mp3$/i.test(a.name));
      if(!assets.length) {
        $('emptyState').hidden=false;
        $('emptyState').textContent='No MP3 assets were found in this release. Add MP3 files as release assets, then refresh.';
        return;
      }
      const savedLikes=JSON.parse(localStorage.getItem('stereo-likes')||'[]');
      assets.forEach((asset,index)=>{
        const title=titleFromFile(asset.name);
        const id='release-'+asset.id;
        const t={id,title,category:categoryFor(title),url:asset.browser_download_url,liked:savedLikes.includes(id),artwork:null,releaseAsset:true};
        // Preserve manually assigned categories when they exist in a local preference map.
        const overrides=JSON.parse(localStorage.getItem('stereo-categories')||'{}');
        if(overrides[id]) t.category=overrides[id];
        state.tracks.push(t);
      });
      const status=$('emptyState');
      status.hidden=true;
    } catch(err) {
      $('emptyState').hidden=false;
      $('emptyState').textContent='Could not load tracks from GitHub Releases. Check that the release is public and contains MP3 assets, then refresh.';
      console.warn('Release track loading failed:',err);
    }
  }
  function initEvents() {
    $('libraryNav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)chooseView(b.dataset.view);});
    $('menuButton').addEventListener('click',openSidebar); $('sidebarClose').addEventListener('click',closeSidebar); $('sidebarBackdrop').addEventListener('click',closeSidebar);
    $('themeButton').addEventListener('click',()=>setTheme(!document.body.classList.contains('light-theme')));
    $('searchInput').addEventListener('input',e=>{state.query=e.target.value.trim();render();});
    $('songList').addEventListener('click',e=>{
      const row=e.target.closest('.song-row'); if(!row)return;
      const id=row.dataset.id, action=e.target.closest('[data-action]')?.dataset.action;
      if(action==='like') toggleLike(id); else playTrack(id);
    });
    ['playButton','largePlay'].forEach(id=>$(id).addEventListener('click',()=>{if(currentTrack())playTrack(state.currentId);else if(state.tracks[0])playTrack(state.tracks[0].id);}));
    ['previousButton','largePrevious'].forEach(id=>$(id).addEventListener('click',()=>goRelative(-1)));
    ['nextButton','largeNext'].forEach(id=>$(id).addEventListener('click',()=>goRelative(1)));
    ['rewindButton','largeRewind'].forEach(id=>$(id).addEventListener('click',()=>audio.currentTime=Math.max(0,audio.currentTime-10)));
    ['forwardButton','largeForward'].forEach(id=>$(id).addEventListener('click',()=>audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+10)));
    ['seekBar','largeSeek'].forEach(id=>$(id).addEventListener('input',()=>seekToRange($(id))));
    ['volumeBar','largeVolume'].forEach(id=>$(id).addEventListener('input',()=>{audio.volume=Number($(id).value);$('volumeBar').value=$('largeVolume').value=audio.volume;}));
    $('shuffleButton').addEventListener('click',()=>{state.shuffle=!state.shuffle;$('shuffleButton').style.color=state.shuffle?'var(--accent)':'var(--text)';});
    $('repeatButton').addEventListener('click',()=>{state.repeat=!state.repeat;$('repeatButton').style.color=state.repeat?'var(--accent)':'var(--text)';});
    $('sleepButton').addEventListener('click',()=>openModal('sleepModal')); $('sleepButtonLarge').addEventListener('click',()=>openModal('sleepModal'));
    $('openNowPlaying').addEventListener('click',()=>chooseView('Now Playing'));
    $('backToCollection').addEventListener('click',()=>chooseView('All Tracks'));
    $('largeLikeButton').addEventListener('click',()=>{if(currentTrack())toggleLike(state.currentId);});
    $('shareButton').addEventListener('click',async()=>{
      const t=currentTrack(); if(!t)return;
      try { if(navigator.share) await navigator.share({title:t.title,text:`Listening to ${t.title} on Rishit's Stereo`}); else await navigator.clipboard.writeText(t.title); } catch(_){}
    });
    $('addSongButton').addEventListener('click',()=>$('fileInput').click());
    $('fileInput').addEventListener('change',e=>{
      const file=e.target.files?.[0]; if(!file)return;
      if(!/\.mp3$/i.test(file.name) && file.type!=='audio/mpeg'){alert('Please select an MP3 audio file.');e.target.value='';return;}
      state.pendingFile=file; $('selectedFileName').textContent=file.name; openModal('categoryModal');
    });
    $('confirmAddSong').addEventListener('click',()=>{if(state.pendingFile)addTrackFromFile(state.pendingFile,$('categorySelect').value);});
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop=>backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal(backdrop.id);}));
    document.querySelectorAll('.timer-preset').forEach(b=>b.addEventListener('click',()=>startTimer(Number(b.dataset.hours)*60)));
    $('startCustomTimer').addEventListener('click',()=>{const h=Math.max(0,Number($('customHours').value)||0),m=Math.max(0,Number($('customMinutes').value)||0);startTimer(h*60+m);});
    $('cancelTimer').addEventListener('click',cancelTimer);
    audio.addEventListener('timeupdate',syncProgress); audio.addEventListener('loadedmetadata',syncProgress);
    audio.addEventListener('play',()=>{updateCurrentUI();render();}); audio.addEventListener('pause',()=>{updateCurrentUI();render();});
    audio.addEventListener('ended',()=>{if(state.repeat){audio.currentTime=0;audio.play().catch(()=>{});}else goRelative(1);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSidebar();closeModal('categoryModal');closeModal('sleepModal');}});
  }
  async function init() {
    audio.volume=.8;
    setTheme(localStorage.getItem('stereo-theme')==='light');
    const likes=JSON.parse(localStorage.getItem('stereo-likes')||'[]');
    state.db=await openDB().catch(()=>null);
    await loadReleaseTracks();
    state.tracks.forEach(t=>t.liked=likes.includes(t.id)||t.liked);
    await loadUploads().catch(()=>{});
    initEvents(); render();
    // Do not auto-play audio; browsers require a user action.
  }
  init();
})();