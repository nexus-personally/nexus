export type MusicScene = 'lobby' | 'gameplay' | 'tense' | 'result'
export type AudioCue = 'button' | 'tile-draw' | 'tile-discard' | 'tile-shuffle' | 'tile-stack' | 'turn' | 'countdown' | 'win' | 'chi' | 'pong' | 'kong' | 'hu' | 'tsumo'
export type VoiceLanguage = 'mandarin' | 'cantonese' | 'english' | 'off'
export type AudioSettings = { muted: boolean; bgmEnabled: boolean; master: number; bgm: number; sfx: number; voice: number; voiceLanguage: VoiceLanguage }

const STORAGE = 'gangque.audio.v2'
const defaults: AudioSettings = { muted: false, bgmEnabled: true, master: .65, bgm: .28, sfx: .8, voice: .8, voiceLanguage: 'mandarin' }
export function loadAudioSettings(): AudioSettings {
  try {
    const saved = localStorage.getItem(STORAGE)
    if (saved) return { ...defaults, ...JSON.parse(saved) } as AudioSettings
    const previous = localStorage.getItem('gangque.audio.v1')
    if (previous) {
      const old = JSON.parse(previous) as Partial<AudioSettings>
      return { ...defaults, ...old, muted: false, bgmEnabled: !old.muted }
    }
    return { ...defaults }
  }
  catch { return { ...defaults } }
}

const scales: Record<MusicScene, { notes: number[]; bass: number[]; beat: number }> = {
  lobby: { notes: [62, 65, 69, 72, 69, 65, 60, 65, 67, 69, 65, 62, 60, 62, 65, 67], bass: [38, 41, 36, 43], beat: .64 },
  gameplay: { notes: [57, 60, 64, 67, 64, 60, 55, 60, 62, 64, 60, 57, 55, 57, 60, 62], bass: [33, 36, 31, 38], beat: .72 },
  tense: { notes: [57, 60, 62, 64, 62, 60, 55, 57, 60, 62, 64, 67, 64, 62, 60, 57], bass: [33, 31, 29, 31], beat: .46 },
  result: { notes: [60, 64, 67, 72, 74, 72, 69, 67, 64, 67, 69, 72, 67, 64, 60, 60], bass: [36, 41, 43, 36], beat: .55 },
}
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12)
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const bgmFiles: Record<MusicScene, string> = { lobby: '/mahjong/audio/bgm/lobby.mp3', gameplay: '/mahjong/audio/bgm/gameplay-calm.mp3', tense: '/mahjong/audio/bgm/gameplay-tense.mp3', result: '/mahjong/audio/bgm/result.mp3' }
const sfxFile = (cue: AudioCue) => `/mahjong/audio/sfx/${cue}.mp3`

class MahjongAudio {
  private context: AudioContext | null = null
  private musicGain: GainNode | null = null
  private effectGain: GainNode | null = null
  private settings = loadAudioSettings()
  private scene: MusicScene = 'lobby'
  private timer: number | null = null
  private nextBeat = 0
  private step = 0
  private noiseBuffer: AudioBuffer | null = null
  private mediaMusic: HTMLAudioElement | null = null
  private usingMusicFile = false
  private assetAvailable = new Map<string, boolean>()
  private assetPromise: Promise<void> | null = null
  private resumeAfterVisibility = false

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibility)
  }

  private handleVisibility = (): void => {
    const context = this.context
    if (document.hidden) {
      this.resumeAfterVisibility = context?.state === 'running'
      if (this.timer !== null) {
        window.clearInterval(this.timer)
        this.timer = null
      }
      this.mediaMusic?.pause()
      if (context?.state === 'running') void context.suspend()
      return
    }
    if (!this.resumeAfterVisibility || !context) return
    this.resumeAfterVisibility = false
    void context.resume().then(() => {
      this.startScheduler()
      if (this.mediaMusic && this.usingMusicFile && !this.settings.muted && this.settings.bgmEnabled) {
        void this.mediaMusic.play().catch(() => {})
      }
    }).catch(() => {})
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext()
      this.musicGain = this.context.createGain()
      this.effectGain = this.context.createGain()
      const limiter = this.context.createDynamicsCompressor()
      limiter.threshold.value = -12
      limiter.ratio.value = 4
      this.musicGain.connect(limiter)
      this.effectGain.connect(limiter)
      limiter.connect(this.context.destination)
      this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate)
      const data = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.context.state === 'suspended') await this.context.resume()
    this.updateLevels()
    this.startScheduler()
    await this.loadAssets()
    void this.tryMusicFile()
  }

  setSettings(settings: AudioSettings): void {
    this.settings = { ...settings, master: clamp(settings.master), bgm: clamp(settings.bgm), sfx: clamp(settings.sfx), voice: clamp(settings.voice) }
    localStorage.setItem(STORAGE, JSON.stringify(this.settings))
    this.updateLevels()
    if (settings.muted) window.speechSynthesis?.cancel()
  }

  setScene(scene: MusicScene): void {
    if (this.scene === scene) return
    this.scene = scene
    this.step = 0
    if (this.context) this.nextBeat = this.context.currentTime + .12
    this.mediaMusic?.pause()
    this.mediaMusic = null
    this.usingMusicFile = false
    void this.tryMusicFile()
  }

  play(cue: AudioCue): void {
    const context = this.context
    if (!context || context.state !== 'running' || this.settings.muted) return
    if (this.assetAvailable.get(sfxFile(cue))) {
      const clip = new Audio(sfxFile(cue))
      clip.volume = clamp(this.settings.master * this.settings.sfx)
      void clip.play().catch(() => {})
      if (cue === 'chi' || cue === 'pong' || cue === 'kong' || cue === 'hu' || cue === 'tsumo') this.say(cue)
      return
    }
    const now = context.currentTime + .012
    if (cue === 'button') this.tone(710, .055, now, .14, 'sine')
    else if (cue === 'tile-draw') { this.noise(.07, now, .18, 2200); this.tone(520, .08, now, .1, 'triangle') }
    else if (cue === 'tile-discard') { this.noise(.09, now, .36, 1200); this.tone(190, .11, now, .26, 'sine') }
    else if (cue === 'tile-stack') for (let i = 0; i < 5; i++) { this.noise(.045, now + i * .09, .16, 1500); this.tone(250 - i * 12, .07, now + i * .09, .11, 'triangle') }
    else if (cue === 'tile-shuffle') for (let i = 0; i < 11; i++) this.noise(.045, now + i * .055, .1, 750 + i * 80)
    else if (cue === 'turn') { this.tone(660, .14, now, .1, 'sine'); this.tone(880, .16, now + .09, .08, 'sine') }
    else if (cue === 'countdown') this.tone(720, .14, now, .16, 'sine')
    else if (cue === 'win' || cue === 'hu' || cue === 'tsumo') {
      ;[523, 659, 784, 1047].forEach((hz, i) => this.tone(hz, .5, now + i * .075, .15, 'triangle'))
      this.noise(.28, now, .22, 900)
    } else {
      this.noise(.1, now, .28, 1000)
      this.tone(cue === 'kong' ? 140 : cue === 'pong' ? 180 : 230, .21, now, .27, 'triangle')
    }
    if (cue === 'chi' || cue === 'pong' || cue === 'kong' || cue === 'hu' || cue === 'tsumo') this.say(cue)
  }

  private updateLevels(): void {
    if (!this.context || !this.musicGain || !this.effectGain) return
    const master = this.settings.muted ? 0 : this.settings.master
    this.musicGain.gain.setTargetAtTime(master * (this.settings.bgmEnabled ? this.settings.bgm : 0), this.context.currentTime, .08)
    this.effectGain.gain.setTargetAtTime(master * this.settings.sfx, this.context.currentTime, .03)
    if (this.mediaMusic) this.mediaMusic.volume = clamp(master * (this.settings.bgmEnabled ? this.settings.bgm : 0))
  }

  private startScheduler(): void {
    if (this.timer !== null || !this.context) return
    this.nextBeat = this.context.currentTime + .1
    this.timer = window.setInterval(() => {
      if (!this.context || this.context.state !== 'running') return
      while (this.nextBeat < this.context.currentTime + .22) {
        const theme = scales[this.scene]
        if (!this.settings.muted && this.settings.bgmEnabled && !this.usingMusicFile) {
          const note = theme.notes[this.step % theme.notes.length]
          this.pluck(midi(note), this.nextBeat, this.step % 4 === 0 ? .48 : .32)
          if (this.step % 4 === 0) this.pluck(midi(theme.bass[Math.floor(this.step / 4) % theme.bass.length]), this.nextBeat, .6)
          if (this.scene === 'tense' && this.step % 2 === 0) this.noise(.035, this.nextBeat, .025, 500)
        }
        this.nextBeat += theme.beat
        this.step++
      }
    }, 100)
  }

  private pluck(frequency: number, when: number, length: number): void {
    const context = this.context, output = this.musicGain
    if (!context || !output) return
    const oscillator = context.createOscillator(), envelope = context.createGain()
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(frequency, when)
    envelope.gain.setValueAtTime(.0001, when)
    envelope.gain.exponentialRampToValueAtTime(.12, when + .018)
    envelope.gain.exponentialRampToValueAtTime(.0001, when + length)
    oscillator.connect(envelope).connect(output)
    oscillator.start(when); oscillator.stop(when + length + .01)
  }

  private tone(frequency: number, length: number, when: number, level: number, type: OscillatorType): void {
    const context = this.context, output = this.effectGain
    if (!context || !output) return
    const oscillator = context.createOscillator(), envelope = context.createGain()
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, when)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * .72), when + length)
    envelope.gain.setValueAtTime(Math.max(.0001, level), when)
    envelope.gain.exponentialRampToValueAtTime(.0001, when + length)
    oscillator.connect(envelope).connect(output)
    oscillator.start(when); oscillator.stop(when + length + .01)
  }

  private noise(length: number, when: number, level: number, cutoff: number): void {
    const context = this.context, output = this.effectGain
    if (!context || !output || !this.noiseBuffer) return
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain()
    source.buffer = this.noiseBuffer; filter.type = 'bandpass'; filter.frequency.value = cutoff; filter.Q.value = .6
    envelope.gain.setValueAtTime(level, when)
    envelope.gain.exponentialRampToValueAtTime(.0001, when + length)
    source.connect(filter).connect(envelope).connect(output)
    source.start(when); source.stop(when + length + .01)
  }

  private say(cue: 'chi' | 'pong' | 'kong' | 'hu' | 'tsumo'): void {
    if (this.settings.voiceLanguage === 'off') return
    const file = `/mahjong/audio/voice/${this.settings.voiceLanguage}/${cue}.mp3`
    if (this.assetAvailable.get(file)) {
      const clip = new Audio(file)
      clip.volume = clamp(this.settings.master * this.settings.voice)
      void clip.play().catch(() => {})
      return
    }
    if (!window.speechSynthesis) return
    const words: Record<Exclude<VoiceLanguage, 'off'>, Record<typeof cue, string>> = {
      mandarin: { chi: '吃', pong: '碰', kong: '杠', hu: '胡', tsumo: '自摸' },
      cantonese: { chi: '食', pong: '碰', kong: '槓', hu: '糊', tsumo: '自摸' },
      english: { chi: 'Chow', pong: 'Pung', kong: 'Kong', hu: 'Mahjong', tsumo: 'Self draw' },
    }
    const language = this.settings.voiceLanguage
    const utterance = new SpeechSynthesisUtterance(words[language][cue])
    utterance.lang = language === 'mandarin' ? 'zh-CN' : language === 'cantonese' ? 'zh-HK' : 'en-US'
    utterance.rate = cue === 'tsumo' ? 1.1 : 1.25
    utterance.volume = clamp(this.settings.master * this.settings.voice)
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find(voice => voice.lang.toLowerCase() === utterance.lang.toLowerCase()) || null
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  private loadAssets(): Promise<void> {
    if (!this.assetPromise) this.assetPromise = fetch('/mahjong/audio/manifest.json')
      .then(response => response.ok ? response.json() as Promise<{ files: string[] }> : { files: [] })
      .then(manifest => { for (const path of manifest.files || []) if (path.startsWith('/mahjong/audio/') && path.endsWith('.mp3')) this.assetAvailable.set(path, true) })
      .catch(() => {})
    return this.assetPromise
  }

  private async tryMusicFile(): Promise<void> {
    if (!this.context || this.context.state !== 'running') return
    if (this.mediaMusic && this.usingMusicFile) return
    const scene = this.scene
    const path = bgmFiles[scene]
    await this.loadAssets()
    if (!this.assetAvailable.get(path) || scene !== this.scene) return
    const track = new Audio(path)
    track.loop = true
    track.volume = clamp((this.settings.muted || !this.settings.bgmEnabled ? 0 : this.settings.master) * this.settings.bgm)
    try {
      await track.play()
      if (scene !== this.scene) { track.pause(); return }
      this.mediaMusic = track
      this.usingMusicFile = true
    } catch { track.pause() }
  }
}

export const audio = new MahjongAudio()
