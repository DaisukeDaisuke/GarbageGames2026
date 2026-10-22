#include "game.h"
#include <iostream>
#include <sstream>
#include <iomanip>
using namespace arena;
void quote(const std::string& s){std::cout<<'"';for(unsigned char c:s){if(c=='"'||c=='\\')std::cout<<'\\'<<c;else if(c=='\n')std::cout<<"\\n";else std::cout<<c;}std::cout<<'"';}
template<class C> void numbers(const C& c){std::cout<<'[';bool sep=false;for(auto v:c){if(sep)std::cout<<',';sep=true;std::cout<<+v;}std::cout<<']';}
void fighter(const Fighter& f){
 std::cout<<"{";
 #define FIELD(x) std::cout<<"\"" #x "\":"<<f.x<<',';
 FIELD(hp) FIELD(max_hp) FIELD(mp) FIELD(max_mp) FIELD(spd)
 FIELD(focus) FIELD(guard) FIELD(barrier) FIELD(rest) FIELD(rain_used)
 FIELD(burn) FIELD(bank) FIELD(last)
 #undef FIELD
 std::cout<<"\"pending\":{\"skill\":"<<f.pending.skill<<",\"power\":"<<f.pending.power<<",\"magic\":"<<f.pending.magic<<"},\"slots\":";numbers(f.slots);std::cout<<'}';
}
void state(const RunState& r){
 std::cout<<'{';
 #define FIELD(x) std::cout<<"\"" #x "\":"<<r.x<<',';
 FIELD(practice) FIELD(bout) FIELD(node) FIELD(round) FIELD(gold) FIELD(armor) FIELD(charm) FIELD(preview_armor) FIELD(preview_charm)
 FIELD(rounds) FIELD(taken) FIELD(maximum_damage) FIELD(observation) FIELD(discovered) FIELD(learned_here) FIELD(charge_hint) FIELD(guard_hint) FIELD(charge_hint_round) FIELD(guard_hint_round) FIELD(won)
 #undef FIELD
 std::cout<<"\"seed\":\""<<std::hex<<std::setfill('0')<<std::setw(16)<<r.seed<<"\",\"rng_state\":\""<<std::setw(16)<<r.rng_state<<std::dec<<"\",";
 std::cout<<"\"screen\":"<<int(r.screen)<<",\"after_discovery\":"<<int(r.after_discovery)<<",\"reward\":"<<int(r.reward)<<",\"you\":";fighter(r.you);std::cout<<",\"enemy\":";fighter(r.enemy);
 std::cout<<",\"registered\":";numbers(r.registered);std::cout<<",\"owned\":";numbers(r.owned);std::cout<<",\"defeated\":";numbers(r.defeated);std::cout<<",\"path\":";numbers(r.path);std::cout<<",\"history\":";numbers(r.history);
 std::cout<<",\"forecast\":{\"skill\":"<<r.forecast.skill<<",\"stage\":"<<r.forecast.stage<<"},\"nodes\":[";
 for(int i=0;i<10;i++){if(i)std::cout<<',';std::cout<<"{\"enemy\":"<<r.nodes[i].enemy<<",\"slots\":";numbers(r.nodes[i].slots);std::cout<<'}';}
 std::cout<<"],\"log\":[";bool sep=false;for(auto& s:r.log){if(sep)std::cout<<',';sep=true;quote(s);}std::cout<<"]}";
}
void data(){
 std::cout<<"{\"skills\":[";
 for(int i=0;i<20;i++){if(i)std::cout<<',';auto&s=skills[i];std::cout<<"{\"name\":";quote(s.name);std::cout<<",\"japanese\":";quote(s.japanese);std::cout<<",\"description\":";quote(s.description);std::cout<<",\"mp\":"<<s.mp<<",\"policy\":"<<int(s.policy)<<",\"effects\":[";bool sep=false;for(auto&e:s.effects){if(sep)std::cout<<',';sep=true;std::cout<<'['<<int(e.op)<<','<<int(e.target)<<','<<e.arg0<<','<<e.arg1<<','<<int(e.phase)<<']';}std::cout<<"]}";}
 std::cout<<"],\"enemies\":[";
 for(int i=0;i<10;i++){if(i)std::cout<<',';auto&e=enemies[i];std::cout<<"{\"name\":";quote(e.name);std::cout<<",\"hp\":"<<e.hp<<",\"spd\":"<<e.spd<<",\"candidates\":[";for(int j=0;j<3;j++){if(j)std::cout<<',';numbers(e.candidates[j]);}std::cout<<"]}";}
 std::cout<<"],\"items\":[";
 for(int i=0;i<10;i++){if(i)std::cout<<',';auto&t=items[i];std::cout<<"{\"name\":";quote(t.name);std::cout<<",\"japanese\":";quote(t.japanese);std::cout<<",\"description\":";quote(t.description);std::cout<<",\"price\":"<<t.price<<",\"charm\":"<<t.charm<<",\"second\":"<<t.second<<",\"stats\":[";for(int j=0;j<3;j++){if(j)std::cout<<',';auto x=t.stats[j];std::cout<<'['<<x.mul<<','<<x.div<<','<<x.add<<']';}std::cout<<"]}";}
 std::cout<<"]}\n";
}
int main(int argc,char**argv){if(argc>1&&std::string(argv[1])=="data"){data();return 0;}RunState r;std::string line;while(std::getline(std::cin,line)){bool ok=true;std::string error;if(line.rfind("seed ",0)==0){r=new_run(std::stoull(line.substr(5),nullptr,16),true);}else ok=operation(r,line,error);std::cout<<"{\"ok\":"<<ok<<",\"state\":";state(r);std::cout<<"}\n";}return 0;}
