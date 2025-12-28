import * as THREE from 'three';

export class SoundManager {
    constructor(listener) {
        this.listener = listener;
        
        this.audioLoader = new THREE.AudioLoader();
        this.sounds = {};
        
        this.loadSounds();
    }

    loadSounds() {
        const soundFiles = {
            'click': 'sound/UI_click.wav',
            'speaking': 'sound/SpeakingBegin.wav',
            'welcome': 'sound/WelcomeTo.mp3',
            'attack': 'sound/AttackObj.mp3'
        };

        for (const [key, path] of Object.entries(soundFiles)) {
            this.audioLoader.load(path, (buffer) => {
                const sound = new THREE.Audio(this.listener);
                sound.setBuffer(buffer);
                sound.setVolume(0.5);
                this.sounds[key] = sound;
            });
        }
    }

    playSound(key) {
        if (this.sounds[key]) {
            if (this.sounds[key].isPlaying) this.sounds[key].stop();
            this.sounds[key].play();
        }
    }

    playClick() {
        this.playSound('click');
    }

    playSpeakingSequence(contentKey) {
        const speaking = this.sounds['speaking'];
        const content = this.sounds[contentKey];

        if (speaking && content) {
            // Clear previous onEnded to prevent unwanted triggers if we stop/restart
            speaking.onEnded = null;
            
            if (speaking.isPlaying) speaking.stop();
            if (content.isPlaying) content.stop();

            // Set onEnded BEFORE calling play()
            // THREE.Audio assigns source.onended = this.onEnded inside play()
            speaking.onEnded = () => {
                content.play();
                speaking.onEnded = null; // Clean up
            };
            speaking.play();
        } else if (content) {
            content.play();
        }
    }

    playWelcome() {
        this.playSpeakingSequence('welcome');
    }

    playAttack() {
        this.playSpeakingSequence('attack');
    }
}
