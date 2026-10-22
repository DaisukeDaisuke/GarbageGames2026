// Appearance uses its own deterministic hash, never the gameplay RNG.
export const CHALLENGER_CHARACTERS=[
 {id:'violet-mage',name:'紫の魔法使い'},
 {id:'blue-swordsman',name:'青の剣士'},
 {id:'green-ranger',name:'森の弓使い'},
 {id:'white-healer',name:'白の治癒師'},
 {id:'red-duelist',name:'紅の決闘士'},
 {id:'amber-monk',name:'琥珀の拳士'},
 {id:'star-sorcerer',name:'星の魔術師'},
 {id:'rose-alchemist',name:'薔薇の錬金術師'},
 {id:'silver-guardian',name:'銀の守護騎士'},
 {id:'sand-rogue',name:'砂の斥候'}
];
export function challengerAppearance(record){
 const identity=[record.seed,record.policy,record.trial,record.policyVersion].join(':');
 let hash=2166136261;
 for(const character of identity)hash=Math.imul(hash^character.charCodeAt(0),16777619)>>>0;
 const character=CHALLENGER_CHARACTERS[hash%CHALLENGER_CHARACTERS.length];
 return {...character,asset:'challengers/'+character.id};
}
