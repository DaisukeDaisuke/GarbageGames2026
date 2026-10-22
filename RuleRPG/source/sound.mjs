// All buffers are embedded in the built HTML; playback never fetches a URL.
export class SoundBank {
  constructor(sounds,{createContext,onError=()=>{}}={}) {
    this.sounds=sounds;this.createContext=createContext;this.onError=onError;
    this.enabled=true;this.active=true;this.context=null;this.loading=null;
    this.buffers=new Map();this.voices=new Set();this.generation=0;
  }
  unlock() {
    if(!this.enabled||!this.active)return Promise.resolve(false);
    try {
      this.context??=this.createContext();
      // Called directly within a click/keydown, before any await, for mobile browsers.
      const resumed=this.context.state==='running'?Promise.resolve():this.context.resume();
      this.loading??=Promise.all(Object.entries(this.sounds).map(async([key,asset])=>{
        const bytes=Uint8Array.from(atob(asset.src.split(',')[1]),char=>char.charCodeAt(0));
        const buffer=await this.context.decodeAudioData(bytes.buffer);
        this.buffers.set(key,buffer);
      })).catch(error=>{this.loading=null;throw error;});
      return Promise.all([resumed,this.loading]).then(()=>{
        if(this.context.state!=='running')throw new Error('音声の再生が停止されています');
        this.onError(null);return true;
      }).catch(error=>{this.onError(error);return false;});
    } catch(error) {this.onError(error);return Promise.resolve(false);}
  }
  async play(key) {
    if(!this.enabled||!this.active||!this.sounds[key])return false;
    const generation=this.generation;
    if(!await this.unlock()||generation!==this.generation||!this.enabled||!this.active)return false;
    try {
      const source=this.context.createBufferSource(),gain=this.context.createGain();
      source.buffer=this.buffers.get(key);gain.gain.value=this.sounds[key].volume;
      source.connect(gain).connect(this.context.destination);
      source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};
      this.voices.add(source);source.start();return true;
    } catch(error) {this.onError(error);return false;}
  }
  stop() {
    this.generation++;
    for(const voice of this.voices) {try{voice.stop();}catch{} }
    this.voices.clear();
  }
  setEnabled(value) {this.enabled=value;if(!value)this.stop();}
  setActive(value) {this.active=value;if(!value)this.stop();}
}
