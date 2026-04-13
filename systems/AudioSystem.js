// systems/AudioSystem.js
import { System } from '../core/Systems.js';
export class AudioSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.soundBuffers = {};
        this.trackSources = new Map(); // Track sources for play/stop (e.g., torchBurning, backgroundMusic) 
        this.trackState = new Map();
        this.playingTracks = new Set();
        this.fadeTimeouts = new Map();

        // Volume multipliers - default to 1.0 (full volume)
        this.globalVolumeMultiplier = 1;
        this.musicVolumeMultiplier = 1;
        this.ambientVolumeMultiplier = 1;
        this.sfxVolumeMultiplier = 1;
        this.dialogueVolumeMultiplier = 1;

        // Last known values for change detection
        this.lastGlobalVolumeMultiplier = 1;
        this.lastMusicVolumeMultiplier = 1;
        this.lastAmbientVolumeMultiplier = 1;
        this.lastSfxVolumeMultiplier = 1;
        this.lastDialogueVolumeMultiplier = 1;

        // Sound categorization
        this.soundCategories = {
            music: ['backgroundMusic'],
            ambient: ['torchBurning', 'fountain_loop'],
            dialogue: ['intro'],
            sfx: [
                'ding', 'loot0', 'portal0', 'portal1', 'bossLevel0',
                'fountain0', 'firecast0', 'firehit0',
                'miss0', 'miss1', 'miss2', 'miss3', 'miss4', 'miss5', 'miss6', 'miss7', 'miss8',
                'block0', 'block1', 'block2', 'block3', 'block4', 'block5', 'block6', 'block7', 'block8',
                'hit0', 'hit1', 'hit2', 'hit3', 'hit4', 'hit5', 'hit6', 'hit7', 'hit8', 'hit9',
                'hit10', 'hit11', 'hit12', 'hit13', 'hit14', 'hit15', 'hit16', 'hit17', 'hit18', 'hit19',
                'hit20', 'hit21', 'hit22', 'hit23', 'hit24', 'hit25', 'hit26'
            ]
        };

        this.preloadSounds();
    }

    init() {
        this.sfxQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.SFX || [];
        this.gameOptions = this.entityManager.getEntity('gameState')?.getComponent('GameOptions');
        this.trackControlQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.TrackControl || [];

        // Load all volume settings - default to 1.0 if not set in GameOptions
        if (this.gameOptions) {
            this.globalVolumeMultiplier = this.gameOptions.globalVolume ?? 1;
            this.musicVolumeMultiplier = this.gameOptions.musicVolume ?? 1;
            this.ambientVolumeMultiplier = this.gameOptions.ambientVolume ?? 1;
            this.sfxVolumeMultiplier = this.gameOptions.sfxVolume ?? 1;
            this.dialogueVolumeMultiplier = this.gameOptions.dialogueVolume ?? 1;

            console.warn(`AudioSystem: Volumes loaded - Global: ${this.globalVolumeMultiplier}, Music: ${this.musicVolumeMultiplier}, Ambient: ${this.ambientVolumeMultiplier}, SFX: ${this.sfxVolumeMultiplier}, Dialogue: ${this.dialogueVolumeMultiplier}`);
        }

        this.eventBus.on('PlaySfxImmediate', ({ sfx, volume }) => {
            //console.log(`AudioSystem: Immediate playback requested for sfx: ${sfx} at volume: ${volume}`);
            this.playSfx({ sfx, volume });
        });

        this.eventBus.on('PlayTrackControl', (data) => {
            this.playTrackControl(data);
            console.warn(`AudioSystem: Track control requested for track: ${data.track}, play: ${data.play}, volume: ${data.volume}, fadeIn: ${data.fadeIn}, fadeOut: ${data.fadeOut}`);
        });

        this.eventBus.on('AudioEnabled', (data) => {
            if (!data) {
                this.suspendAudio();
            } else {
                this.resumeAudio();
            }
        });

        console.warn('AudioSystem initialized', this.audioContext);
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');

        // Check for volume changes
        let volumeChanged = false;
        if (this.gameOptions) {
            const newGlobal = this.gameOptions.globalVolume ?? this.lastGlobalVolumeMultiplier;
            const newMusic = this.gameOptions.musicVolume ?? this.lastMusicVolumeMultiplier;
            const newAmbient = this.gameOptions.ambientVolume ?? this.lastAmbientVolumeMultiplier;
            const newSfx = this.gameOptions.sfxVolume ?? this.lastSfxVolumeMultiplier;
            const newDialogue = this.gameOptions.dialogueVolume ?? this.lastDialogueVolumeMultiplier;

            if (newGlobal !== this.globalVolumeMultiplier) {
                console.warn(`🔊 GLOBAL volume changed: ${this.globalVolumeMultiplier} → ${newGlobal}`);
                this.globalVolumeMultiplier = newGlobal;
                this.lastGlobalVolumeMultiplier = newGlobal;
                volumeChanged = true;
            }
            if (newMusic !== this.musicVolumeMultiplier) {
                console.warn(`🎵 MUSIC volume changed: ${this.musicVolumeMultiplier} → ${newMusic}`);
                this.musicVolumeMultiplier = newMusic;
                this.lastMusicVolumeMultiplier = newMusic;
                volumeChanged = true;
            }
            if (newAmbient !== this.ambientVolumeMultiplier) {
                console.warn(`🌊 AMBIENT volume changed: ${this.ambientVolumeMultiplier} → ${newAmbient}`);
                this.ambientVolumeMultiplier = newAmbient;
                this.lastAmbientVolumeMultiplier = newAmbient;
                volumeChanged = true;
            }
            if (newSfx !== this.sfxVolumeMultiplier) {
                console.warn(`💥 SFX volume changed: ${this.sfxVolumeMultiplier} → ${newSfx}`);
                this.sfxVolumeMultiplier = newSfx;
                this.lastSfxVolumeMultiplier = newSfx;
                volumeChanged = true;
            }
            if (newDialogue !== this.dialogueVolumeMultiplier) {
                console.warn(`💬 DIALOGUE volume changed: ${this.dialogueVolumeMultiplier} → ${newDialogue}`);
                this.dialogueVolumeMultiplier = newDialogue;
                this.lastDialogueVolumeMultiplier = newDialogue;
                volumeChanged = true;
            }

            if (volumeChanged) {
                console.warn(`📊 TrackSources currently playing: ${Array.from(this.trackSources.keys()).join(', ') || 'NONE'}`);
                this.updateTrackVolumes();
            }
        }

        if (!gameState?.transitionLock && this.sfxQueue.length > 0) {
            this.sfxQueue.forEach(({ sfx, volume }) => {
                //console.log(`AudioSystem: Processing AudioQueue - Playing sfx: ${sfx} at Volume: ${volume}`);
                this.playSfx({ sfx, volume });
            });
            this.sfxQueue.length = 0;
            //console.log('AudioSystem: Processed and cleared AudioQueue SFX');
        }
        if (this.trackControlQueue.length > 0) {
            this.trackControlQueue.forEach((data) => {
                const playCommand = data.play ? 'play' : 'stop';
                //console.log(`AudioSystem: Processing AudioQueue - Track Control ${playCommand} track: ${data.track} at Volume: ${data.volume}, fadeIn: ${data.fadeIn}, fadeOut: ${data.fadeOut}`);
                this.playTrackControl(data);
            });
            this.trackControlQueue.length = 0;
            //console.log('AudioSystem: Processed and cleared AudioQueue TrackControl');
        }
    }


    updateTrackVolumes() {
        if (this.gameOptions.soundEnabled === false) {
            // Mute all tracks
            this.trackSources.forEach((source, track) => {
                if (source.gainNode) {
                    const now = this.audioContext.currentTime;
                    source.gainNode.gain.cancelScheduledValues(now);
                    source.gainNode.gain.setValueAtTime(0, now);
                }
            });
            console.warn('AudioSystem: Sound is disabled, muting all tracks');
            return;
        }

        this.trackSources.forEach((source, track) => {
            if (!source.gainNode) {
                console.warn(`AudioSystem: No gainNode found for track "${track}"`);
                return;
            }

            const category = source.category || this.getSoundCategory(track);
            let categoryVolume = 1;

            switch(category) {
                case 'music': categoryVolume = this.musicVolumeMultiplier; break;
                case 'ambient': categoryVolume = this.ambientVolumeMultiplier; break;
                case 'dialogue': categoryVolume = this.dialogueVolumeMultiplier; break;
                case 'sfx': categoryVolume = this.sfxVolumeMultiplier; break;
            }

            // Use stored base volume or default
            const baseVolume = source.baseVolume || 1;
            const newVolume = baseVolume * this.globalVolumeMultiplier * categoryVolume;

            // Cancel any scheduled ramps and set new volume immediately
            const now = this.audioContext.currentTime;
            source.gainNode.gain.cancelScheduledValues(now);
            source.gainNode.gain.setValueAtTime(newVolume, now);

            console.warn(`AudioSystem: Updated volume for track "${track}" (${category}) - Base: ${baseVolume}, Global: ${this.globalVolumeMultiplier}, Category: ${categoryVolume}, Final: ${newVolume}`);
        });
    }

    getSoundCategory(soundName) {
        for (const [category, sounds] of Object.entries(this.soundCategories)) {
            if (sounds.includes(soundName)) {
                return category;
            }
        }
        return 'sfx'; // Default to sfx if not categorized
    }

  

    playSfx({ sfx, volume }) {
        if (this.gameOptions.soundEnabled === false) return;

        if (!this.soundBuffers[sfx]) {
            console.warn(`AudioSystem: Sound buffer ${sfx} not found`);
            return;
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.scheduleSfx(sfx, volume);
            }).catch(error => {
                console.error(`AudioSystem: Failed to resume AudioContext for ${sfx}:`, error);
            });
        } else {
            this.scheduleSfx(sfx, volume);
        }
    }

    scheduleSfx(sfx, volume) {
        if (this.gameOptions.soundEnabled === false) return;

        const category = this.getSoundCategory(sfx);
        let categoryVolume = 1;

        switch(category) {
            case 'music': categoryVolume = this.musicVolumeMultiplier; break;
            case 'ambient': categoryVolume = this.ambientVolumeMultiplier; break;
            case 'dialogue': categoryVolume = this.dialogueVolumeMultiplier; break;
            case 'sfx': categoryVolume = this.sfxVolumeMultiplier; break;
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = this.soundBuffers[sfx];
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume * this.globalVolumeMultiplier * categoryVolume;
        console.warn(`Gain Node Value for SFX "${sfx}" (${category}): ${gainNode.gain.value}`);
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(0);
    }

    suspendAudio() {
        if (this.audioContext.state !== 'suspended') {
            this.audioContext.suspend().then(() => {
                console.warn('AudioSystem: AudioContext suspended');
            }).catch(error => {
                console.error('AudioSystem: Failed to suspend AudioContext:', error);
            });
        }
    }

    resumeAudio() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.warn('AudioSystem: AudioContext resumed');
            }).catch(error => {
                console.error('AudioSystem: Failed to resume AudioContext:', error);
            });
        }
    }

    playTrackControl({ track, play = true, volume = 1, fadeIn = 0.5, fadeOut = 0.5 }) {
        //console.error(`🎼 playTrackControl called: track="${track}", play=${play}, volume=${volume}, currently in trackSources: ${this.trackSources.has(track)}`);
        if (this.gameOptions.soundEnabled === false) return;
        if (this.fadeTimeouts.has(track)) {
            clearTimeout(this.fadeTimeouts.get(track));
            this.fadeTimeouts.delete(track);
        }

        const state = this.trackState.get(track);

        if (play) {
            if (this.trackSources.has(track)) {
                //console.error(`🔄 playTrackControl: Stopping existing track "${track}" before restarting`);
                const oldSource = this.trackSources.get(track);
                // Clear the onended callback to prevent it from interfering with the new source
                oldSource.onended = null;
                try { oldSource.stop(); } catch (e) { }
                this.trackSources.delete(track);
               // console.error(`🗑️ Deleted "${track}" from trackSources (before restart)`);
                this.trackState.set(track, 'stopped');
            }
            if (this.soundBuffers[track]) {
                const source = this.audioContext.createBufferSource();
                source.buffer = this.soundBuffers[track];
                source.loop = true;
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 0;
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                source.gainNode = gainNode;

                // Get category and calculate category-specific volume
                const category = this.getSoundCategory(track);
                let categoryVolume = 1;

                switch(category) {
                    case 'music': categoryVolume = this.musicVolumeMultiplier; break;
                    case 'ambient': categoryVolume = this.ambientVolumeMultiplier; break;
                    case 'dialogue': categoryVolume = this.dialogueVolumeMultiplier; break;
                    case 'sfx': categoryVolume = this.sfxVolumeMultiplier; break;
                }

                // Store category and base volume for later updates
                source.category = category;
                source.baseVolume = volume;

                source.onended = () => {
                   // console.error(`❌ MUSIC SOURCE ENDED for track "${track}" - Removing from trackSources`, new Error().stack);
                    this.trackState.set(track, 'stopped');
                    this.trackSources.delete(track);
                    this.fadeTimeouts.delete(track);
                };
                const startTrack = () => {
                    const now = this.audioContext.currentTime;
                    source.start(now);
                    gainNode.gain.setValueAtTime(0, now);
                    const finalVolume = volume * this.globalVolumeMultiplier * categoryVolume;
                    gainNode.gain.linearRampToValueAtTime(finalVolume, now + fadeIn);
                    console.warn(`Applying volume ramp for "${track}" (${category}): ${finalVolume}`);
                    this.trackSources.set(track, source);
                    //console.error(`✅ Added "${track}" to trackSources (Map size: ${this.trackSources.size})`, new Error().stack);
                    this.trackState.set(track, 'playing');
                };
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(startTrack).catch(error => {
                        console.error(`AudioSystem: Failed to resume AudioContext for ${track}:`, error);
                    });
                } else {
                    startTrack();
                }
            } else {
                console.warn(`AudioSystem: Sound buffer ${track} not found`);
            }
        } else {
            if (this.trackSources.has(track)) {
                const source = this.trackSources.get(track);
                if (source.loop) source.loop = false;
                if (source.gainNode) {
                    const now = this.audioContext.currentTime;
                    source.gainNode.gain.cancelScheduledValues(now);
                    source.gainNode.gain.setValueAtTime(source.gainNode.gain.value, now);
                    source.gainNode.gain.linearRampToValueAtTime(0, now + fadeOut);
                    const timeoutId = setTimeout(() => {
                        try { source.stop(); } catch (e) { }
                        this.trackSources.delete(track);
                        this.trackState.set(track, 'stopped');
                        this.fadeTimeouts.delete(track);
                    }, fadeOut * 1000 + 100);
                    this.fadeTimeouts.set(track, timeoutId);
                    this.trackState.set(track, 'stopping');
                } else {
                    try { source.stop(); } catch (e) { }
                    this.trackSources.delete(track);
                    this.trackState.set(track, 'stopped');
                    this.fadeTimeouts.delete(track);
                }
            } else {
                this.trackState.set(track, 'stopped');
                this.fadeTimeouts.delete(track);
            }
        }
    }

    async preloadSounds() {
        const soundFiles = {
            torchBurning: 'audio/torch-burning.mp3',
            backgroundMusic: 'audio/haunted.wav',
            intro: 'audio/narration/intro.mp3',
            ding: 'audio/ding.mp3',
            loot0: 'audio/loot/loot_0.wav',
            portal0: 'audio/portal/portal_0.wav',
            portal1: 'audio/portal/portal_1.wav',
            bossLevel0: 'audio/boss/level/boss-level_0.wav',
            fountain0: 'audio/fountain/fountain_0.wav',
            fountain_loop: 'audio/fountain/fountain_loop.mp3',
            firecast0: 'audio/spell/cast/firecast_0.wav',
            firehit0: 'audio/spell/hit/firehit_0.wav',
            miss0: 'audio/miss/miss_0.wav',
            miss1: 'audio/miss/miss_1.wav',
            miss2: 'audio/miss/miss_2.wav',
            miss3: 'audio/miss/miss_3.wav',
            miss4: 'audio/miss/miss_4.wav',
            miss5: 'audio/miss/miss_5.wav',
            miss6: 'audio/miss/miss_6.wav',
            miss7: 'audio/miss/miss_7.wav',
            miss8: 'audio/miss/miss_8.wav',
            block0: 'audio/block/block_0.wav',
            block1: 'audio/block/block_1.wav',
            block2: 'audio/block/block_2.wav',
            block3: 'audio/block/block_3.wav',
            block4: 'audio/block/block_4.wav',
            block5: 'audio/block/block_5.wav',
            block6: 'audio/block/block_6.wav',
            block7: 'audio/block/block_7.wav',
            block8: 'audio/block/block_8.wav',
            hit0: 'audio/hit/hit_0.wav',
            hit1: 'audio/hit/hit_1.wav',
            hit2: 'audio/hit/hit_2.wav',
            hit3: 'audio/hit/hit_3.wav',
            hit4: 'audio/hit/hit_4.wav',
            hit5: 'audio/hit/hit_5.wav',
            hit6: 'audio/hit/hit_6.wav',
            hit7: 'audio/hit/hit_7.wav',
            hit8: 'audio/hit/hit_8.wav',
            hit9: 'audio/hit/hit_9.wav',
            hit10: 'audio/hit/hit_10.wav',
            hit11: 'audio/hit/hit_11.wav',
            hit12: 'audio/hit/hit_12.wav',
            hit13: 'audio/hit/hit_13.wav',
            hit14: 'audio/hit/hit_14.wav',
            hit15: 'audio/hit/hit_15.wav',
            hit16: 'audio/hit/hit_16.wav',
            hit17: 'audio/hit/hit_17.wav',
            hit18: 'audio/hit/hit_18.wav',
            hit19: 'audio/hit/hit_19.wav',
            hit20: 'audio/hit/hit_20.wav',
            hit21: 'audio/hit/hit_21.wav',
            hit22: 'audio/hit/hit_22.wav',
            hit23: 'audio/hit/hit_23.wav',
            hit24: 'audio/hit/hit_24.wav',
            hit25: 'audio/hit/hit_25.wav',
            hit26: 'audio/hit/hit_26.wav'
        };

        for (const [key, path] of Object.entries(soundFiles)) {
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                this.soundBuffers[key] = await this.audioContext.decodeAudioData(arrayBuffer);
                ////console.log(`AudioSystem: Preloaded ${key}`);
            } catch (error) {
                console.error(`AudioSystem: Failed to preload ${key} from ${path}:`, error);
            }
        }
        //console.log('AudioSystem: sounds preloaded');
        this.eventBus.emit('AudioLoaded');

    }
}

