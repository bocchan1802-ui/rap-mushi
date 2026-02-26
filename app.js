// ラップムしクローン - アプリケーション（高速化版）

class RapMushiApp {
  constructor() {
    // 音声ファイルの設定（korosukeの声）
    this.audioFiles = {
      1: { file: 'audio/phrase1.wav', text: 'ヨーシ！', buffer: null },
      2: { file: 'audio/phrase2.wav', text: 'マジ！？', buffer: null },
      3: { file: 'audio/phrase3.wav', text: 'ウケる！', buffer: null },
      4: { file: 'audio/phrase4.wav', text: 'ナイス！', buffer: null },
      5: { file: 'audio/phrase5.wav', text: 'やばみ！', buffer: null },
      6: { file: 'audio/phrase6.wav', text: 'すごぉ！', buffer: null },
      7: { file: 'audio/phrase7.wav', text: 'へぇ〜', buffer: null },
      8: { file: 'audio/phrase8.wav', text: 'あざっ！', buffer: null }
    };

    this.isRecording = false;
    this.isPlaying = false;
    this.recordedPhrases = [];
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.mockMode = false; // 音声ファイル使用モード（korosukeの声）
    this.audioBuffersLoaded = false; // プリロード完了フラグ
    this.activeSources = []; // 再生中のAudioSourceを追跡

    this.initElements();
    this.initAudio();
    this.preloadAudio(); // 👈 音声プリロード
    this.bindEvents();
  }

  initElements() {
    this.mushiCharacter = document.querySelector('.mushi-character');
    this.mushiMouth = document.getElementById('mushiMouth');
    this.currentText = document.getElementById('currentText');
    this.rapPads = document.querySelectorAll('.rap-pad');
    this.recordBtn = document.getElementById('recordBtn');
    this.playBtn = document.getElementById('playBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.historyList = document.getElementById('historyList');
    this.volumeBar = document.getElementById('volumeBar');
    this.helpBtn = document.getElementById('helpBtn');
    this.helpModal = document.getElementById('helpModal');
    this.closeHelp = document.getElementById('closeHelp');
    this.loadingIndicator = document.querySelector('.loading-indicator');
  }

  initAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
    } catch (e) {
      console.warn('Web Audio API not available');
    }
  }

  // 👈 音声プリロード機能（ゲーム開始時に全ての音声をメモリに読み込み）
  async preloadAudio() {
    if (!this.audioContext) {
      console.warn('AudioContext not available');
      return;
    }

    // AudioContextのユーザー操作要求に対処
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    console.log('🎵 音声プリロード開始...');

    const loadPromises = Object.entries(this.audioFiles).map(async ([id, phrase]) => {
      try {
        const response = await fetch(phrase.file);
        if (!response.ok) throw new Error(`Failed to load ${phrase.file}`);

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        this.audioFiles[id].buffer = audioBuffer;
        console.log(`  ✅ Loaded: ${phrase.file}`);
      } catch (error) {
        console.warn(`  ⚠️ Failed to load ${phrase.file}:`, error);
      }
    });

    await Promise.all(loadPromises);
    this.audioBuffersLoaded = true;

    console.log('🎉 音声プリロード完了！全ての音声がメモリに読み込まれました');

    // ローディング表示を非表示
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = 'none';
    }

    // パッドを有効化
    this.rapPads.forEach(pad => {
      pad.classList.add('loaded');
      pad.disabled = false;
    });
  }

  async startAudioAnalysis() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!this.isRecording) return;

        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const volume = (average / 255) * 100;
        this.volumeBar.style.width = volume + '%';

        requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (e) {
      console.warn('Microphone access not available:', e);
    }
  }

  stopAudioAnalysis() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.volumeBar.style.width = '0%';
  }

  bindEvents() {
    // ラップパッド
    this.rapPads.forEach(pad => {
      pad.addEventListener('click', () => {
        const soundId = pad.dataset.sound;
        this.playPhrase(soundId);
      });

      pad.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const soundId = pad.dataset.sound;
        this.playPhrase(soundId);
      });
    });

    // 録音ボタン
    this.recordBtn.addEventListener('click', () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    // 再生ボタン
    this.playBtn.addEventListener('click', () => {
      if (this.isPlaying) {
        this.stopPlayback();
      } else {
        this.playRecording();
      }
    });

    // 消去ボタン
    this.clearBtn.addEventListener('click', () => {
      this.clearRecording();
    });

    // ヘルプモーダル
    this.helpBtn.addEventListener('click', () => {
      this.helpModal.classList.add('active');
    });

    this.closeHelp.addEventListener('click', () => {
      this.helpModal.classList.remove('active');
    });

    this.helpModal.addEventListener('click', (e) => {
      if (e.target === this.helpModal) {
        this.helpModal.classList.remove('active');
      }
    });
  }

  playPhrase(soundId) {
    const phrase = this.audioFiles[soundId];
    if (!phrase) return;

    // テキストを表示
    this.currentText.textContent = phrase.text;

    // パッドのアニメーション
    const pad = document.querySelector(`[data-sound="${soundId}"]`);
    pad.classList.add('playing');
    setTimeout(() => pad.classList.remove('playing'), 300);

    // 虫をラップ状態に
    this.mushiCharacter.classList.add('rapping');

    // 👈 高速再生：プリロードされたAudioBufferを使用
    if (this.mockMode) {
      this.speakMock(phrase.text);
    } else {
      this.playAudioBuffer(soundId);
    }

    // 録音中なら履歴に追加
    if (this.isRecording) {
      this.recordedPhrases.push({
        id: soundId,
        text: phrase.text,
        time: Date.now()
      });
      this.updateHistory();
    }

    // 一定時間後にラップ状態を解除
    setTimeout(() => {
      this.mushiCharacter.classList.remove('rapping');
    }, 500);
  }

  // 👈 高速再生：AudioBufferを使用した即座再生
  playAudioBuffer(soundId) {
    if (!this.audioContext) {
      console.warn('AudioContext not available');
      return;
    }

    const phrase = this.audioFiles[soundId];

    // AudioBufferがプリロードされている場合
    if (phrase.buffer) {
      const source = this.audioContext.createBufferSource();
      source.buffer = phrase.buffer;
      source.connect(this.audioContext.destination);
      source.start(0);

      // 再生完了後にクリーンアップ
      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
      };
      this.activeSources.push(source);

      return;
    }

    // プリロードされていない場合（フォールバック）
    console.warn(`Audio buffer for sound ${soundId} not loaded, using fallback`);
    this.playAudioFile(phrase.file);
  }

  speakMock(text) {
    // Web Speech API for TTS（モック用）
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.5;
    utterance.pitch = 1.8;

    const voices = speechSynthesis.getVoices();
    const japaneseVoice = voices.find(v => v.lang.includes('ja'));
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }

    speechSynthesis.speak(utterance);
  }

  playAudioFile(filePath) {
    // フォールバック：Audio要素を使用
    const audio = new Audio(filePath);
    audio.play().catch(e => {
      console.warn('Audio file not found, falling back to mock:', e);
      this.speakMock(this.audioFiles[this.findIdByFile(filePath)].text);
    });
  }

  findIdByFile(filePath) {
    for (const [id, data] of Object.entries(this.audioFiles)) {
      if (data.file === filePath) return id;
    }
    return null;
  }

  startRecording() {
    this.isRecording = true;
    this.recordBtn.classList.add('recording');
    this.recordBtn.querySelector('.btn-text').textContent = '録音中...';
    this.startAudioAnalysis();
  }

  stopRecording() {
    this.isRecording = false;
    this.recordBtn.classList.remove('recording');
    this.recordBtn.querySelector('.btn-text').textContent = '録音';
    this.stopAudioAnalysis();

    if (this.recordedPhrases.length > 0) {
      this.playBtn.disabled = false;
    }
  }

  async playRecording() {
    if (this.recordedPhrases.length === 0) return;

    this.isPlaying = true;
    this.playBtn.classList.add('playing');
    this.playBtn.querySelector('.btn-text').textContent = '再生中...';

    for (const phrase of this.recordedPhrases) {
      if (!this.isPlaying) break;

      const pad = document.querySelector(`[data-sound="${phrase.id}"]`);
      pad.classList.add('playing');
      setTimeout(() => pad.classList.remove('playing'), 300);

      this.currentText.textContent = phrase.text;
      this.mushiCharacter.classList.add('rapping');

      if (this.mockMode) {
        await this.speakMockAsync(phrase.text);
      } else {
        await this.playAudioBufferAsync(phrase.id);
      }

      await this.delay(100);
      this.mushiCharacter.classList.remove('rapping');
    }

    this.stopPlayback();
  }

  speakMockAsync(text) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.5;
      utterance.pitch = 1.8;

      const voices = speechSynthesis.getVoices();
      const japaneseVoice = voices.find(v => v.lang.includes('ja'));
      if (japaneseVoice) {
        utterance.voice = japaneseVoice;
      }

      utterance.onend = resolve;
      speechSynthesis.speak(utterance);
    });
  }

  // 👈 高速再生：AudioBufferを使用した非同期再生
  async playAudioBufferAsync(soundId) {
    if (!this.audioContext) {
      console.warn('AudioContext not available');
      return;
    }

    const phrase = this.audioFiles[soundId];

    // AudioBufferがプリロードされている場合
    if (phrase.buffer) {
      return new Promise((resolve) => {
        const source = this.audioContext.createBufferSource();
        source.buffer = phrase.buffer;
        source.connect(this.audioContext.destination);
        source.start(0);

        source.onended = () => {
          const index = this.activeSources.indexOf(source);
          if (index > -1) {
            this.activeSources.splice(index, 1);
          }
          resolve();
        };
        this.activeSources.push(source);
      });
    }

    // フォールバック
    return this.playAudioFileAsync(phrase.file);
  }

  playAudioFileAsync(filePath) {
    return new Promise((resolve) => {
      const audio = new Audio(filePath);
      audio.onended = resolve;
      audio.onerror = () => {
        const id = this.findIdByFile(filePath);
        this.speakMockAsync(this.audioFiles[id].text).then(resolve);
      };
      audio.play();
    });
  }

  stopPlayback() {
    this.isPlaying = false;
    this.playBtn.classList.remove('playing');
    this.playBtn.querySelector('.btn-text').textContent = '再生';

    // 全てのAudioSourceを停止
    this.activeSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // 既に停止済み
      }
    });
    this.activeSources = [];

    speechSynthesis.cancel();
  }

  clearRecording() {
    this.recordedPhrases = [];
    this.updateHistory();
    this.playBtn.disabled = true;
    this.currentText.textContent = 'タップしてラップ！';
  }

  updateHistory() {
    if (this.recordedPhrases.length === 0) {
      this.historyList.innerHTML = '<p class="empty">まだラップしていません...</p>';
      return;
    }

    this.historyList.innerHTML = this.recordedPhrases.map((phrase, index) => `
      <div class="history-item">
        <span class="history-phrase">${index + 1}. ${phrase.text}</span>
        <span class="history-time">${new Date(phrase.time).toLocaleTimeString()}</span>
      </div>
    `).join('');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// アプリ起動
document.addEventListener('DOMContentLoaded', () => {
  new RapMushiApp();
});

// 音声リストが読み込まれたら初期化
speechSynthesis.onvoiceschanged = () => {
  // 音声リストが更新された
};
