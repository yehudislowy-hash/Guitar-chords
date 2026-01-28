        let appState = {
            currentCategory: null,
            browseMode: 'name',
            songs: [],
            currentSong: null,
            isScrolling: false,
            scrollInterval: null,
            textSize: 16,
            editingId: null,
            tunerActive: false,
            audioContext: null,
            analyser: null,
            targetFrequency: null,
            selectedString: null,
            currentAlbumArtData: null,
            mediaStream: null,
            lastTuneTime: 0,
            playlists: [],
            currentLine: 0,
            youtubePlayer: null,
            selectedFont: "'Courier New', monospace",
            recentlyPlayed: [],
            primaryColor: '#667eea',
            secondaryColor: '#764ba2',
            chordColor: '#e53e3e',
            boldChords: false
        };

        document.addEventListener('DOMContentLoaded', () => {
            loadSongs();
            loadPlaylists();
            setupUploadZone();
            document.getElementById('scrollSpeed').addEventListener('input', (e) => {
                document.getElementById('speedValue').textContent = e.target.value;
            });
        });

        function loadSongs() {
            const stored = localStorage.getItem('guitarChordsSongs');
            if (stored) {
                appState.songs = JSON.parse(stored);
            }
        }

        function saveSongs() {
            localStorage.setItem('guitarChordsSongs', JSON.stringify(appState.songs));
        }

        function selectCategory(category) {
            appState.currentCategory = category;
            document.getElementById('categoryScreen').style.display = 'none';
            document.getElementById('appScreen').style.display = 'block';
            document.getElementById('categoryTitle').textContent = 
                category === 'jewish' ? 'Jewish Music' : 'Non-Jewish Music';
            displaySongs();
        }

        function goBackToCategories() {
            document.getElementById('appScreen').style.display = 'none';
            document.getElementById('categoryScreen').style.display = 'flex';
            appState.currentCategory = null;
        }

        function setBrowseMode(mode) {
            appState.browseMode = mode;
            document.querySelectorAll('.browse-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            displaySongs();
        }

        function displaySongs() {
            const container = document.getElementById('songsList');
            const filtered = appState.songs.filter(s => s.category === appState.currentCategory);
            
            container.innerHTML = '';
            updateSongCounter();

            if (filtered.length === 0) {
                container.innerHTML = '<p style="text-align:center;color:#718096;padding:40px;">No songs yet. Add your first song!</p>';
                return;
            }

            if (appState.browseMode === 'name') {
                const sorted = filtered.sort((a, b) => a.title.localeCompare(b.title));
                sorted.forEach(song => {
                    container.appendChild(createSongItem(song));
                });
            } else {
                const byArtist = {};
                filtered.forEach(song => {
                    if (!byArtist[song.artist]) {
                        byArtist[song.artist] = [];
                    }
                    byArtist[song.artist].push(song);
                });

                const sortedArtists = Object.keys(byArtist).sort();
                sortedArtists.forEach(artist => {
                    const group = document.createElement('div');
                    group.className = 'artist-group';
                    
                    const header = document.createElement('div');
                    header.className = 'artist-header';
                    header.textContent = artist;
                    group.appendChild(header);

                    byArtist[artist].sort((a, b) => a.title.localeCompare(b.title))
                        .forEach(song => {
                            group.appendChild(createSongItem(song));
                        });

                    container.appendChild(group);
                });
            }
        }

        function createSongItem(song) {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.onclick = () => openSong(song);

            const img = document.createElement('img');
            img.src = song.albumArt || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect fill="%23e2e8f0" width="60" height="60"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23718096" font-size="24">🎵</text></svg>';
            img.onerror = function() {
                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect fill="%23e2e8f0" width="60" height="60"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23718096" font-size="24">🎵</text></svg>';
            };

            const info = document.createElement('div');
            info.className = 'song-item-info';
            info.innerHTML = `
                <div class="song-item-title">${song.title}</div>
                <div class="song-item-artist">${song.artist}</div>
            `;

            item.appendChild(img);
            item.appendChild(info);
            return item;
        }

        function searchSongs() {
            const query = document.getElementById('searchBox').value.toLowerCase();
            const items = document.querySelectorAll('.song-item');
            
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(query) ? 'flex' : 'none';
            });
        }

        function shuffleSong() {
            const filtered = appState.songs.filter(s => s.category === appState.currentCategory);
            if (filtered.length === 0) {
                alert('No songs in this category yet!');
                return;
            }
            const random = filtered[Math.floor(Math.random() * filtered.length)];
            openSong(random);
        }

        function openSong(song) {
            appState.currentSong = song;
            
            const savedTranspose = localStorage.getItem(`transpose_${song.id}`);
            const capoValue = savedTranspose !== null ? parseInt(savedTranspose) : song.capo;
            
            document.getElementById('appScreen').style.display = 'none';
            document.getElementById('songViewScreen').style.display = 'block';
            
            document.getElementById('viewSongTitle').textContent = song.title;
            document.getElementById('viewSongArtist').textContent = song.artist;
            document.getElementById('viewCapo').textContent = `Original Capo: ${song.capo}`;
            document.getElementById('viewAlbumArt').src = song.albumArt || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23e2e8f0" width="150" height="150"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23718096" font-size="48">🎵</text></svg>';
            
            document.getElementById('capoTranspose').value = capoValue;
            
            if (song.youtube) {
                const videoId = extractYouTubeId(song.youtube);
                if (videoId) {
                    document.getElementById('youtubeContainer').style.display = 'block';
                    document.getElementById('youtubePlayer').src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
                } else {
                    document.getElementById('youtubeContainer').style.display = 'none';
                }
            } else {
                document.getElementById('youtubeContainer').style.display = 'none';
            }
            
            displaySongContent(song, capoValue);
            updateChordsList(song, capoValue);
            
            setTimeout(() => {
                makeChordSClickable();
                loadFont();
            }, 100);
        }

        function extractYouTubeId(url) {
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
                /youtube\.com\/embed\/([^&\s]+)/
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) return match[1];
            }
            return null;
        }

        function displaySongContent(song, currentCapo) {
            const container = document.getElementById('songContent');
            const transposeDiff = currentCapo - song.capo;
            const lines = song.lyrics.split('\n');
            
            let html = '';
            lines.forEach(line => {
                if (isChordLine(line)) {
                    const transposed = transposeLine(line, transposeDiff);
                    html += `<div class="chord-line">${transposed}</div>`;
                } else {
                    html += `<div class="lyric-line">${line}</div>`;
                }
            });
            
            container.innerHTML = html;
            container.style.setProperty('--text-size', `${appState.textSize}px`);
        }

        function isChordLine(line) {
            const chordPattern = /\b[A-G](#|b)?(m|maj|min|dim|aug|sus|add)?[0-9]?(?![a-z])/;
            const words = line.trim().split(/\s+/);
            if (words.length === 0) return false;
            
            const chordWords = words.filter(w => chordPattern.test(w));
            return chordWords.length > 0 && chordWords.length / words.length > 0.5;
        }

        function transposeLine(line, semitones) {
            if (semitones === 0) return line;
            
            const chordPattern = /\b([A-G](#|b)?)(m|maj|min|dim|aug|sus|add)?([0-9]?)\b/g;
            
            return line.replace(chordPattern, (match, root, modifier = '', suffix = '', number = '') => {
                const transposed = transposeChord(root + modifier, semitones);
                return transposed + suffix + number;
            });
        }

        function transposeChord(chord, semitones) {
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
            
            let baseNote = chord.replace(/b|#/, '');
            let modifier = chord.includes('#') ? '#' : (chord.includes('b') ? 'b' : '');
            
            let noteArray = modifier === 'b' ? flats : notes;
            let index = noteArray.indexOf(chord);
            
            if (index === -1) return chord;
            
            let newIndex = (index + semitones + 12) % 12;
            return noteArray[newIndex];
        }

        function updateChordsList(song, currentCapo) {
            const container = document.getElementById('viewChordsList');
            const transposeDiff = currentCapo - song.capo;
            const chords = extractChords(song.lyrics, transposeDiff);
            
            container.innerHTML = '';
            chords.forEach(chord => {
                const tag = document.createElement('span');
                tag.className = 'chord-tag';
                tag.textContent = chord;
                container.appendChild(tag);
            });
        }

        function extractChords(lyrics, transposeDiff) {
            const chordSet = new Set();
            const lines = lyrics.split('\n');
            const chordPattern = /\b([A-G](#|b)?)(m|maj|min|dim|aug|sus|add)?([0-9]?)\b/g;
            
            lines.forEach(line => {
                if (isChordLine(line)) {
                    let match;
                    while ((match = chordPattern.exec(line)) !== null) {
                        const fullChord = match[0];
                        const root = match[1] + (match[2] || '');
                        const suffix = (match[3] || '') + (match[4] || '');
                        const transposed = transposeChord(root, transposeDiff) + suffix;
                        chordSet.add(transposed);
                    }
                }
            });
            
            return Array.from(chordSet);
        }

        function transposeChords() {
            const newCapo = parseInt(document.getElementById('capoTranspose').value);
            localStorage.setItem(`transpose_${appState.currentSong.id}`, newCapo);
            displaySongContent(appState.currentSong, newCapo);
            updateChordsList(appState.currentSong, newCapo);
        }

        function closeSongView() {
            document.getElementById('songViewScreen').style.display = 'none';
            document.getElementById('appScreen').style.display = 'block';
            stopAutoScroll();
            document.getElementById('youtubePlayer').src = '';
        }

        function toggleAutoScroll() {
            if (appState.isScrolling) {
                stopAutoScroll();
            } else {
                startAutoScroll();
            }
        }

        function startAutoScroll() {
            appState.isScrolling = true;
            document.getElementById('scrollBtn').textContent = '⏸ Stop Scroll';
            document.getElementById('scrollBtn').classList.add('stop');
            
            const speed = parseInt(document.getElementById('scrollSpeed').value);
            // Speed formula: 0.1 to 10 pixels per frame at 60fps
            // Speed 1-5 = very slow (0.1-0.5), 6-10 = slow (0.6-2), 11-15 = medium (2.5-5), 16-20 = fast (6-10)
            let scrollAmount;
            if (speed <= 5) {
                scrollAmount = speed * 0.1; // 0.1 to 0.5
            } else if (speed <= 10) {
                scrollAmount = (speed - 5) * 0.3; // 0.6 to 1.5
            } else if (speed <= 15) {
                scrollAmount = (speed - 10) * 0.6 + 1.5; // 2.1 to 4.5
            } else {
                scrollAmount = (speed - 15) * 1.2 + 4.5; // 5.7 to 10.5
            }
            
            appState.scrollInterval = setInterval(() => {
                // Check if we're at the bottom to prevent blinking
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;
                
                // Stop if within 100px of bottom
                if (scrollTop + windowHeight >= documentHeight - 100) {
                    stopAutoScroll();
                    return;
                }
                
                window.scrollBy({
                    top: scrollAmount,
                    behavior: 'auto'
                });
            }, 16);
        }

        function stopAutoScroll() {
            appState.isScrolling = false;
            document.getElementById('scrollBtn').textContent = '▶ Start Scroll';
            document.getElementById('scrollBtn').classList.remove('stop');
            
            if (appState.scrollInterval) {
                clearInterval(appState.scrollInterval);
                appState.scrollInterval = null;
            }
        }

        function changeTextSize(delta) {
            appState.textSize = Math.max(12, Math.min(32, appState.textSize + delta));
            document.getElementById('songContent').style.setProperty('--text-size', `${appState.textSize}px`);
        }

        function printSong() {
            window.print();
        }

        function openAddSongModal() {
            appState.editingId = null;
            appState.currentAlbumArtData = null;
            document.getElementById('modalTitle').textContent = 'Add New Song';
            document.getElementById('songTitle').value = '';
            document.getElementById('artistName').value = '';
            document.getElementById('albumImageFile').value = '';
            document.getElementById('albumArtPreview').classList.remove('show');
            document.getElementById('capoPosition').value = '0';
            document.getElementById('youtubeUrl').value = '';
            document.getElementById('lyricsChords').value = '';
            document.getElementById('previewImage').classList.add('hidden');
            document.getElementById('processingText').classList.add('hidden');
            document.getElementById('songModal').classList.add('active');
        }

        function editCurrentSong() {
            const song = appState.currentSong;
            appState.editingId = song.id;
            appState.currentAlbumArtData = song.albumArt;
            
            document.getElementById('modalTitle').textContent = 'Edit Song';
            document.getElementById('songTitle').value = song.title;
            document.getElementById('artistName').value = song.artist;
            
            if (song.albumArt) {
                document.getElementById('albumArtPreview').src = song.albumArt;
                document.getElementById('albumArtPreview').classList.add('show');
            }
            
            document.getElementById('capoPosition').value = song.capo;
            document.getElementById('youtubeUrl').value = song.youtube || '';
            document.getElementById('lyricsChords').value = song.lyrics;
            
            switchTab('manual');
            document.getElementById('songModal').classList.add('active');
        }

        function closeModal() {
            document.getElementById('songModal').classList.remove('active');
            appState.editingId = null;
            appState.currentAlbumArtData = null;
        }

        function switchTab(tab) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            if (tab === 'upload') {
                document.querySelector('.tab-btn:first-child').classList.add('active');
                document.getElementById('uploadTab').classList.add('active');
            } else {
                document.querySelector('.tab-btn:last-child').classList.add('active');
                document.getElementById('manualTab').classList.add('active');
            }
        }

        function handleAlbumArtUpload(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    appState.currentAlbumArtData = e.target.result;
                    document.getElementById('albumArtPreview').src = e.target.result;
                    document.getElementById('albumArtPreview').classList.add('show');
                };
                reader.readAsDataURL(file);
            }
        }

        function setupUploadZone() {
            const zone = document.getElementById('uploadZone');
            const input = document.getElementById('imageUpload');
            
            zone.onclick = () => input.click();
            
            zone.ondragover = (e) => {
                e.preventDefault();
                zone.classList.add('dragover');
            };
            
            zone.ondragleave = () => {
                zone.classList.remove('dragover');
            };
            
            zone.ondrop = (e) => {
                e.preventDefault();
                zone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    processImage(file);
                }
            };
        }

        function handleImageUpload(event) {
            const file = event.target.files[0];
            if (file) {
                processImage(file);
            }
        }

        function processImage(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('previewImage');
                preview.src = e.target.result;
                preview.classList.remove('hidden');
                
                document.getElementById('processingText').classList.remove('hidden');
                document.getElementById('processingText').textContent = 'Processing image...';
                document.getElementById('processingText').style.color = '#667eea';
                
                Tesseract.recognize(
                    e.target.result,
                    'eng',
                    {
                        logger: m => {
                            if (m.status === 'recognizing text') {
                                document.getElementById('processingText').textContent = 
                                    `Processing... ${Math.round(m.progress * 100)}%`;
                            }
                        },
                        preserve_interword_spaces: '1'
                    }
                ).then(({ data }) => {
                    document.getElementById('processingText').classList.add('hidden');
                    
                    let extractedText = '';
                    
                    if (data.lines && data.lines.length > 0) {
                        data.lines.forEach(line => {
                            if (line.words && line.words.length > 0) {
                                let lineText = '';
                                let lastX = 0;
                                
                                line.words.forEach((word, index) => {
                                    if (index > 0) {
                                        const spaceDiff = word.bbox.x0 - lastX;
                                        const avgCharWidth = 8;
                                        const numSpaces = Math.max(1, Math.round(spaceDiff / avgCharWidth));
                                        lineText += ' '.repeat(numSpaces);
                                    }
                                    lineText += word.text;
                                    lastX = word.bbox.x1;
                                });
                                
                                extractedText += lineText + '\n';
                            }
                        });
                    } else {
