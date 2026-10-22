export const ACHIEVEMENTS_KEY='garbage2026:terms-rpg:achievements:v1';
export const attemptKey=(sceneId,noun,verb,attribute)=>JSON.stringify(attribute===undefined?[sceneId,noun,verb]:[sceneId,noun,attribute,verb]);
export class AchievementJournal {
  constructor(data,getStorage,onError=()=>{}) {
    this.data=data;this.getStorage=getStorage;this.onError=onError;this.keys=new Set();
    this.valid=new Set(data.scenes.flatMap(scene=>scene.patterns.map(p=>attemptKey(scene.id,p.noun,p.verb,p.attribute))));
    this.legacy=new Map(data.scenes.flatMap(scene=>scene.legacyAttribute===undefined?[]:scene.patterns.filter(p=>p.attribute===scene.legacyAttribute).map(p=>[attemptKey(scene.id,p.noun,p.verb),attemptKey(scene.id,p.noun,p.verb,p.attribute)])));
    this.reload();
  }
  read(storage) {
    const raw=storage.getItem(ACHIEVEMENTS_KEY);
    if(raw===null)return [];
    const value=JSON.parse(raw);
    if(value?.version!==1||!Array.isArray(value.tried))throw new Error('実績の保存形式を読み込めません');
    return value.tried.filter(key=>typeof key==='string').map(key=>this.legacy.get(key)??key).filter(key=>this.valid.has(key));
  }
  reload() {
    try {for(const key of this.read(this.getStorage()))this.keys.add(key);this.onError(false);}
    catch {this.onError(true);}
  }
  has(sceneId,noun,verb,attribute) {return this.keys.has(attemptKey(sceneId,noun,verb,attribute));}
  record(sceneId,noun,verb,attribute) {
    const key=attemptKey(sceneId,noun,verb,attribute);
    if(!this.valid.has(key))return false;
    this.keys.add(key);
    try {
      const storage=this.getStorage();
      // Merge other tabs' discoveries before writing this tab's new attempt.
      try {for(const saved of this.read(storage))this.keys.add(saved);}catch {}
      storage.setItem(ACHIEVEMENTS_KEY,JSON.stringify({version:1,tried:[...this.keys]}));
      this.onError(false);
    }catch {this.onError(true);}
    return true;
  }
}
