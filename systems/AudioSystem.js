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
        this.globalVolumeMultiplier = 1; // Global volume multiplier (0 = muted, 1 = full volume)
        this.ltGlobalVolumeMultiplier = 1; // Last known global volume multiplier
        this.preloadSounds();
    }

    init() {
        this.sfxQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.SFX || [];
        this.gameOptions = this.entityManager.getEntity('gameState')?.getComponent('GameOptions');
        console.warn(`AudioSystem: Global volume multiplier set to ${this.gameOptions.globalVolume}`);
        this.trackControlQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.TrackControl || [];
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
        const newGlobalVolume = this.gameOptions?.globalVolume ?? this.lastGlobalVolumeMultiplier;
        if (newGlobalVolume !== this.globalVolumeMultiplier) {
            this.globalVolumeMultiplier = newGlobalVolume; // Update global volume multiplier
            this.lastGlobalVolumeMultiplier = newGlobalVolume; // Store the last known value
            this.updateTrackVolumes(); // Update currently playing tracks
            console.warn(`AudioSystem: Global volume multiplier set to ${this.globalVolumeMultiplier}`);
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
            this.globalVolumeMultiplier = 0; // Mute all sounds if sound is disabled
            console.warn('AudioSystem: Sound is disabled, setting global volume multiplier to 0');
            return;
        }

        this.trackSources.forEach((source, track) => {
            if (!source.gainNode) {
                console.warn(`AudioSystem: No gainNode found for track "${track}"`);
                return;
            }

            const newVolume = this.globalVolumeMultiplier;
            source.gainNode.gain.setValueAtTime(newVolume, this.audioContext.currentTime);
            console.warn(`AudioSystem: Updated volume for track "${track}" to ${newVolume}`);
        });
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
        const source = this.audioContext.createBufferSource();
        source.buffer = this.soundBuffers[sfx];
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume * this.globalVolumeMultiplier; // Apply global volume multiplier
        console.warn(`Gain Node Value for SFX: ${gainNode.gain.value}`);
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

    playTrackControl({ track, play = true, volume = 0.2, fadeIn = 0.5, fadeOut = 0.5 }) {
        if (this.gameOptions.soundEnabled === false) return;
        if (this.fadeTimeouts.has(track)) {
            clearTimeout(this.fadeTimeouts.get(track));
            this.fadeTimeouts.delete(track);
        }

        const state = this.trackState.get(track);

        if (play) {
            if (this.trackSources.has(track)) {
                const oldSource = this.trackSources.get(track);
                try { oldSource.stop(); } catch (e) { }
                this.trackSources.delete(track);
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
                source.onended = () => {
                    this.trackState.set(track, 'stopped');
                    this.trackSources.delete(track);
                    this.fadeTimeouts.delete(track);
                };
                const startTrack = () => {
                    const now = this.audioContext.currentTime;
                    source.start(now);
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(volume * this.globalVolumeMultiplier, now + fadeIn); // Apply global volume multiplier
                    console.warn(`Applying volume ramp: ${volume * this.globalVolumeMultiplier}`);
                    this.trackSources.set(track, source);
                    console.warn(`AudioSystem: Adding track "${track}" to trackSources`);
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

/*
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
        this.preloadSounds();
    }

    init() {
        this.sfxQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.SFX || [];
        this.trackControlQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.TrackControl || [];
        this.eventBus.on('PlaySfxImmediate', ({ sfx, volume }) => {
            //console.log(`AudioSystem: Immediate playback requested for sfx: ${sfx} at volume: ${volume}`);
            this.playSfx({ sfx, volume });
        });
    
        this.eventBus.on('PlayTrackControl', (data) => {
            this.playTrackControl(data);
            console.warn(`AudioSystem: Track control requested for track: ${data.track}, play: ${data.play}, volume: ${data.volume}, fadeIn: ${data.fadeIn}, fadeOut: ${data.fadeOut}`);
        });
       
        console.warn('AudioSystem initialized', this.audioContext);
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
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

    playSfx({ sfx, volume }) {
        //console.log(`AudioSystem: Playing sfx: ${sfx} at Volume: ${volume}`);
        if (!this.soundBuffers[sfx]) {
            console.warn(`AudioSystem: Sound buffer ${sfx} not found`);
            return;
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                //console.log(`AudioSystem: AudioContext resumed for ${sfx}`);
                this.scheduleSfx(sfx, volume);
            }).catch(error => {
                console.error(`AudioSystem: Failed to resume AudioContext for ${sfx}:`, error);
            });
        } else {
            this.scheduleSfx(sfx, volume);
        }
    }


    scheduleSfx(sfx, volume) {
        const source = this.audioContext.createBufferSource();
        source.buffer = this.soundBuffers[sfx];
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(0);
        //console.log(`AudioSystem: Playback scheduled for ${sfx}`);
    }

    // Add fadeIn and fadeOut parameters (default to 0.5s for smoothness)
    playTrackControl({ track, play = true, volume = 0.05, fadeIn = 0.5, fadeOut = 0.5 }) {
        // Cancel any pending fade-out timeout if a new play/stop comes in
        if (this.fadeTimeouts.has(track)) {
            clearTimeout(this.fadeTimeouts.get(track));
            this.fadeTimeouts.delete(track);
        }

        const state = this.trackState.get(track);

        if (play) {
            // If a previous source exists, stop it immediately to avoid overlap
            if (this.trackSources.has(track)) {
                const oldSource = this.trackSources.get(track);
                try { oldSource.stop(); } catch (e) { }
                this.trackSources.delete(track);
                this.trackState.set(track, 'stopped');
            }
            // Start new track with fade-in
            if (this.soundBuffers[track]) {
                const source = this.audioContext.createBufferSource();
                source.buffer = this.soundBuffers[track];
                source.loop = true;
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 0;
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                source.gainNode = gainNode;
                source.onended = () => {
                    this.trackState.set(track, 'stopped');
                    this.trackSources.delete(track);
                    this.fadeTimeouts.delete(track);
                    //console.log(`AudioSystem: Track ${track} ended and removed from trackState.`);
                };
                const startTrack = () => {
                    const now = this.audioContext.currentTime;
                    source.start(now);
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(volume, now + fadeIn);
                    this.trackSources.set(track, source);
                    this.trackState.set(track, 'playing');
                    //console.log(`AudioSystem: Playing ${track} with fadeIn to Volume: ${volume}`);
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
            // Fade out and stop
            if (this.trackSources.has(track)) {
                const source = this.trackSources.get(track);
                if (source.loop) source.loop = false;
                if (source.gainNode) {
                    const now = this.audioContext.currentTime;
                    source.gainNode.gain.cancelScheduledValues(now);
                    source.gainNode.gain.setValueAtTime(source.gainNode.gain.value, now);
                    source.gainNode.gain.linearRampToValueAtTime(0, now + fadeOut);
                    // Stop after fade-out
                    const timeoutId = setTimeout(() => {
                        try { source.stop(); } catch (e) { }
                        this.trackSources.delete(track);
                        this.trackState.set(track, 'stopped');
                        this.fadeTimeouts.delete(track);
                        //console.log(`AudioSystem: Stopped ${track} with fadeOut`);
                    }, fadeOut * 1000 + 100);
                    this.fadeTimeouts.set(track, timeoutId);
                    this.trackState.set(track, 'stopping');
                } else {
                    try { source.stop(); } catch (e) { }
                    this.trackSources.delete(track);
                    this.trackState.set(track, 'stopped');
                    this.fadeTimeouts.delete(track);
                    //console.log(`AudioSystem: Stopped ${track}`);
                }
            } else {
                // If not playing, ensure state is stopped
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

                */