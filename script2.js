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
                        extractedText = data.text;
                    }
                    
                    switchTab('manual');
                    document.getElementById('lyricsChords').value = extractedText;
                    
                    alert('Text extracted! Chords should be positioned correctly. Please review before saving.');
                }).catch(err => {
                    console.error('OCR Error:', err);
                    document.getElementById('processingText').textContent = 'Error processing image. Please try manual entry.';
                    document.getElementById('processingText').style.color = '#f56565';
                });
            };
            reader.readAsDataURL(file);
        }

        function saveSong() {
            const title = document.getElementById('songTitle').value.trim();
            const artist = document.getElementById('artistName').value.trim();
            const lyrics = document.getElementById('lyricsChords').value.trim();
            
            if (!title || !artist || !lyrics) {
                alert('Please fill in Song Title, Artist, and Lyrics with Chords');
                return;
            }
            
            const song = {
                id: appState.editingId || Date.now().toString(),
                category: appState.currentCategory,
                title,
                artist,
                albumArt: appState.currentAlbumArtData || '',
                capo: parseInt(document.getElementById('capoPosition').value),
                youtube: document.getElementById('youtubeUrl').value.trim(),
                lyrics
            };
            
            if (appState.editingId) {
                const index = appState.songs.findIndex(s => s.id === appState.editingId);
                appState.songs[index] = song;
            } else {
                appState.songs.push(song);
            }
            
            saveSongs();
            closeModal();
            
            if (appState.editingId) {
                openSong(song);
            } else {
                displaySongs();
            }
        }

        function deleteCurrentSong() {
            if (!confirm('Are you sure you want to delete this song?')) return;
            
            appState.songs = appState.songs.filter(s => s.id !== appState.currentSong.id);
            saveSongs();
            closeSongView();
            displaySongs();
        }

        function openTuner() {
            document.getElementById('tunerModal').classList.add('active');
            if (!appState.audioContext) {
                setupAudioContext();
            }
        }

        function closeTuner() {
            document.getElementById('tunerModal').classList.remove('active');
            stopTuner();
        }

        async function setupAudioContext() {
            try {
                appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                appState.analyser = appState.audioContext.createAnalyser();
                appState.analyser.fftSize = 4096;
            } catch (err) {
                console.error('Audio context error:', err);
                alert('Unable to access audio. Please check your browser permissions.');
            }
        }

        async function selectString(note, frequency, element) {
            document.querySelectorAll('.tuning-peg').forEach(btn => btn.classList.remove('active'));
            element.classList.add('active');
            
            appState.selectedString = note;
            appState.targetFrequency = frequency;
            document.getElementById('tunerCurrentNote').textContent = note;
            document.getElementById('tunerInstruction').textContent = 'Listening...';
            document.getElementById('tunerInstruction').style.color = '#ff6b35';
            
            if (!appState.audioContext) {
                await setupAudioContext();
            }
            
            if (appState.audioContext.state === 'suspended') {
                await appState.audioContext.resume();
            }
            
            if (appState.mediaStream) {
                appState.mediaStream.getTracks().forEach(track => track.stop());
            }
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: false,
                        autoGainControl: false,
                        noiseSuppression: false
                    } 
                });
                
                appState.mediaStream = stream;
                const source = appState.audioContext.createMediaStreamSource(stream);
                source.connect(appState.analyser);
                
                appState.tunerActive = true;
                updateTuner();
            } catch (err) {
                console.error('Microphone error:', err);
                document.getElementById('tunerInstruction').textContent = 'Microphone access denied';
                document.getElementById('tunerInstruction').style.color = '#f56565';
                alert('Unable to access microphone. Please allow microphone access in your browser settings.');
            }
        }

        function updateTuner() {
            if (!appState.tunerActive) return;
            
            const bufferLength = appState.analyser.fftSize;
            const buffer = new Float32Array(bufferLength);
            appState.analyser.getFloatTimeDomainData(buffer);
            
            let rms = 0;
            for (let i = 0; i < bufferLength; i++) {
                rms += buffer[i] * buffer[i];
            }
            rms = Math.sqrt(rms / bufferLength);
            
            if (rms > 0.01) {
                const frequency = autoCorrelate(buffer, appState.audioContext.sampleRate);
                
                if (frequency > 0 && appState.targetFrequency) {
                    const cents = 1200 * Math.log2(frequency / appState.targetFrequency);
                    
                    if (Math.abs(cents) < 1200) {
                        updateTunerDisplay(cents, frequency);
                    }
                }
            }
            
            requestAnimationFrame(updateTuner);
        }
