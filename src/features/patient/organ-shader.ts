/**
 * Single source of the organ raymarcher (signed-distance anatomy).
 * Used by the live canvas (OrganCanvas, morphs between any two organs) and by
 * scripts/render-organs.mjs (static WebP renders for cards/carousels).
 * Keep this module dependency-free (Node imports it directly with type stripping).
 */
import type { OrganKind } from "../../data/anatomy";

export const ORGAN_INDEX: Record<OrganKind, number> = {
  heart: 0, brain: 1, lungs: 2, kidney: 3, liver: 4, cells: 5, thyroid: 6, pancreas: 7, spine: 8, uterus: 9, gut: 10, knee: 11,
};

/** Per-organ framing: field of view and a flattering base yaw. */
export const ORGAN_VIEW: Record<OrganKind, { fov: number; yaw: number }> = {
  heart: { fov: 1.55, yaw: 0.28 },
  brain: { fov: 1.4, yaw: -0.45 },
  lungs: { fov: 1.5, yaw: 0.22 },
  kidney: { fov: 1.32, yaw: 0.45 },
  liver: { fov: 1.36, yaw: 0.38 },
  cells: { fov: 1.28, yaw: 0.5 },
  thyroid: { fov: 1.3, yaw: 0.3 },
  pancreas: { fov: 1.36, yaw: 0.32 },
  spine: { fov: 1.45, yaw: 0.9 },
  uterus: { fov: 1.45, yaw: 0.2 },
  gut: { fov: 1.45, yaw: 0.3 },
  knee: { fov: 1.6, yaw: 0.55 },
};

export const ORGAN_VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

export const ORGAN_FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uBeatAmt;
uniform vec2 uPtr;
uniform int uA;
uniform int uB;
uniform float uMix;
uniform float uGrey;
uniform float uFov;
uniform float uYaw;
uniform float uSway;
uniform float uBounce;

mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdEll(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/k1;}
float sdRCyl(vec3 p,float r,float h,float rr){vec2 d=vec2(length(p.xz)-r,abs(p.y)-h);return min(max(d.x,d.y),0.)+length(max(d,0.))-rr;}
float beat(float t){float x=fract(t*1.08);return exp(-pow((x-.08)*13.,2.))+.55*exp(-pow((x-.26)*13.,2.));}

vec4 heart(vec3 p){
  float b=beat(uTime)*uBeatAmt;
  vec3 q=p-vec3(0.02,-0.12,0.);
  q.xy=rot(0.42)*q.xy;
  q*=1.+.045*b;
  vec3 P=q*15.;
  float x=sqrt(P.x*P.x+3.)*(P.x<0.?1.06:.94);
  float y=4.+P.y*1.2-x*sqrt(max((20.-x)/15.,0.));
  float z=P.z*(2.-y/15.);
  float body=(sqrt(x*x+y*y+z*z)-15.)/3./15.;
  float ao=sdCap(p,vec3(.08,.42,.02),vec3(.1,1.02,.0),.16);
  ao=smin(ao,sdCap(p,vec3(.1,1.02,0.),vec3(.36,1.2,-.18),.15),.08);
  ao=smin(ao,sdCap(p,vec3(.36,1.2,-.18),vec3(.62,1.02,-.38),.14),.08);
  ao=smin(ao,sdCap(p,vec3(.62,1.02,-.38),vec3(.66,.38,-.48),.13),.08);
  float br=sdCap(p,vec3(.16,1.12,-.04),vec3(.12,1.5,-.06),.055);
  br=min(br,sdCap(p,vec3(.33,1.22,-.17),vec3(.36,1.6,-.2),.05));
  br=min(br,sdCap(p,vec3(.5,1.15,-.3),vec3(.6,1.52,-.34),.05));
  float pa=sdCap(p,vec3(.3,.5,.3),vec3(.36,.95,.22),.14);
  pa=smin(pa,sdCap(p,vec3(.36,.95,.22),vec3(.78,1.02,.02),.1),.06);
  pa=smin(pa,sdCap(p,vec3(.36,.95,.22),vec3(-.14,1.0,-.12),.095),.06);
  float svc=sdCap(p,vec3(-.36,.45,.0),vec3(-.4,1.32,-.04),.12);
  float cor=sdCap(p,vec3(.12,.52,.42),vec3(-.12,.0,.6),.032);
  cor=min(cor,sdCap(p,vec3(-.12,.0,.6),vec3(-.36,-.5,.46),.028));
  cor=min(cor,sdCap(p,vec3(-.05,.38,.5),vec3(-.5,.25,.38),.026));
  float d=smin(body,ao,.12);
  d=smin(d,br,.05);
  d=smin(d,pa,.1);
  d=smin(d,svc,.1);
  d=smin(d,cor,.03);
  float wA=exp(-60.*max(min(ao,br),0.)), wV=exp(-60.*max(min(pa,svc),0.)), wC=exp(-140.*max(cor,0.)), wB=exp(-60.*max(body,0.));
  float s=wA+wV+wC+wB+1e-4;
  vec3 alb=vec3(.9,.26,.31);
  alb=mix(alb,vec3(.96,.44,.47),clamp(wA/s*1.4,0.,1.));
  alb=mix(alb,vec3(.58,.6,.96),clamp(wV/s*1.4,0.,1.));
  alb=mix(alb,vec3(1.,.55,.5),clamp(wC/s*1.6,0.,1.));
  return vec4(d,alb);
}

vec4 brain(vec3 p){
  vec3 q=p-vec3(-.04,.16,0.);
  q.xy=rot(-.06)*q.xy;
  float d=sdEll(q,vec3(1.1,.74,.84));
  d=smax(d,-(sdEll(q-vec3(-.15,-.86,0.),vec3(.95,.42,1.2))),.12);
  float g=sin(q.x*13.+sin(q.y*9.)*1.7)*sin(q.y*14.+sin(q.z*7.+q.x*3.)*1.5)*sin(q.z*11.+q.x*4.);
  d+=.03*g;
  float sylv=abs(q.y+.08+.32*q.x)-.018;
  d=smax(d,-(sylv+smoothstep(.2,.7,abs(q.z))*.5+smoothstep(-.2,.5,-q.x)*.4),.03);
  float cb=sdEll(p-vec3(.62,-.44,0.),vec3(.4,.27,.52));
  cb+=.006*sin(p.y*85.+p.x*18.);
  d=smin(d,cb,.07);
  d=smin(d,sdCap(p,vec3(.28,-.34,0.),vec3(.4,-1.02,0.),.14),.08);
  return vec4(d,.95,.66,.7);
}

vec4 lungs(vec3 p){
  float r=sdEll(p-vec3(-.56,-.08,0.),vec3(.5,.98,.56));
  r=smax(r,p.x+.1,.12);
  float l=sdEll(p-vec3(.56,-.1,0.),vec3(.47,.94,.52));
  l=smax(l,.12-p.x,.12);
  l=smax(l,-(length(p-vec3(.22,-.42,.42))-.34),.1);
  float d=min(r,l);
  float tr=sdCap(p,vec3(0.,.62,0.),vec3(0.,1.42,0.),.12);
  tr=smin(tr,sdCap(p,vec3(0.,.62,0.),vec3(.4,.34,0.),.085),.05);
  tr=smin(tr,sdCap(p,vec3(0.,.62,0.),vec3(-.42,.36,0.),.09),.05);
  d=smin(d,tr,.08);
  d+=.0035*sin(p.x*26.+p.y*21.)*sin(p.z*24.);
  vec3 alb=mix(vec3(.96,.56,.62),vec3(.95,.84,.84),smoothstep(.55,.9,p.y));
  return vec4(d,alb);
}

vec4 kidney(vec3 p){
  vec3 q=p; q.xy=rot(.28)*q.xy;
  float k=sdEll(q,vec3(.6,.95,.42));
  k=smax(k,-(length((q-vec3(-.66,0.,0.))*vec3(1.,.72,1.))-.46),.14);
  float u=sdCap(q,vec3(-.32,-.05,0.),vec3(-.52,-1.25,.05),.075);
  float v=min(sdCap(q,vec3(-.32,.12,0.),vec3(-.95,.3,0.),.065),sdCap(q,vec3(-.32,-.12,.04),vec3(-.95,-.1,.05),.06));
  float vessels=min(u,v);
  float d=smin(k,vessels,.08);
  float w=clamp((k-vessels)*8.+.5,0.,1.);
  return vec4(d,mix(vec3(.78,.24,.27),vec3(.93,.72,.66),w));
}

vec4 liver(vec3 p){
  float l=sdEll(p-vec3(-.28,.06,0.),vec3(.98,.64,.56));
  l=smin(l,sdEll(p-vec3(.58,.2,0.),vec3(.62,.32,.34)),.26);
  l=smax(l,-(p.y+.36-.24*p.x),.12);
  float gb=sdEll(p-vec3(-.08,-.44,.26),vec3(.14,.22,.12));
  float d=smin(l,gb,.07);
  float w=clamp((l-gb)*8.+.5,0.,1.);
  return vec4(d,mix(vec3(.66,.22,.2),vec3(.42,.6,.32),w));
}

float rbc(vec3 p){
  vec2 q=vec2(length(p.xz)-.4,p.y);
  float tor=length(q)-.17;
  float disc=max(length(p.xz)-.46,abs(p.y)-.045);
  return smin(tor,disc,.09);
}
vec4 cells(vec3 p){
  vec3 a=p-vec3(-.36,.28,0.); a.yz=rot(1.15)*a.yz; a.xy=rot(.35)*a.xy;
  vec3 b=p-vec3(.42,-.28,.05); b.yz=rot(.75)*b.yz; b.xz=rot(-.6)*b.xz;
  return vec4(min(rbc(a),rbc(b)),.92,.16,.2);
}

vec4 thyroid(vec3 p){
  float tr=sdCap(p,vec3(0.,-1.25,-.2),vec3(0.,1.25,-.2),.25);
  tr+=.012*sin(p.y*30.);
  vec3 l=p-vec3(-.36,0.,.1); l.xy=rot(-.22)*l.xy;
  vec3 r=p-vec3(.36,0.,.1); r.xy=rot(.22)*r.xy;
  float lobes=min(sdEll(l,vec3(.25,.6,.21)),sdEll(r,vec3(.25,.6,.21)));
  float th=smin(lobes,sdCap(p,vec3(-.3,-.22,.18),vec3(.3,-.22,.18),.11),.12);
  float d=smin(th,tr,.05);
  float w=clamp((tr-th)*6.+.5,0.,1.);
  return vec4(d,mix(vec3(.92,.87,.85),vec3(.86,.28,.34),w));
}

vec4 pancreas(vec3 p){
  float d=sdCap(p,vec3(-.72,-.18,0.),vec3(-.1,.02,0.),.3);
  d=smin(d,sdCap(p,vec3(-.1,.02,0.),vec3(.48,.16,0.),.22),.18);
  d=smin(d,sdCap(p,vec3(.48,.16,0.),vec3(.88,.34,0.),.14),.14);
  d+=.011*sin(p.x*22.)*sin(p.y*19.+p.z*7.);
  float duo=sdCap(p,vec3(-.95,.32,.05),vec3(-1.06,-.35,.05),.13);
  duo=smin(duo,sdCap(p,vec3(-1.06,-.35,.05),vec3(-.55,-.64,.05),.13),.1);
  float dd=smin(d,duo,.06);
  float w=clamp((duo-d)*6.+.5,0.,1.);
  return vec4(dd,mix(vec3(.93,.6,.6),vec3(.96,.8,.6),w));
}

float vert(vec3 p){
  float body=sdRCyl(p,.3,.1,.05);
  float spin=sdCap(p,vec3(0.,0.,-.25),vec3(0.,-.12,-.62),.07);
  float arch=sdCap(p,vec3(-.18,0.,-.22),vec3(.18,0.,-.22),.07);
  float tl=sdCap(p,vec3(-.15,0.,-.2),vec3(-.55,.02,-.25),.06);
  float tr=sdCap(p,vec3(.15,0.,-.2),vec3(.55,.02,-.25),.06);
  return smin(body,min(min(spin,arch),min(tl,tr)),.06);
}
vec4 spine(vec3 p){
  float d=1e3, disc=1e3;
  for(int i=0;i<4;i++){
    float y=-.78+float(i)*.52;
    d=min(d,vert(p-vec3(0.,y,.08*sin(y*1.6))));
    if(i<3){
      float yd=y+.26;
      disc=min(disc,sdRCyl(p-vec3(0.,yd,.08*sin(yd*1.6)),.28,.045,.03));
    }
  }
  float dd=min(d,disc);
  float w=clamp((d-disc)*8.+.5,0.,1.);
  return vec4(dd,mix(vec3(.93,.9,.84),vec3(.62,.72,.96),w));
}

vec4 uterus(vec3 p){
  float body=sdEll(p-vec3(0.,.12,0.),vec3(.42,.5,.3));
  body=smin(body,sdCap(p,vec3(0.,-.25,0.),vec3(0.,-.85,0.),.16),.14);
  float tubes=1e3;
  for(int s=0;s<2;s++){
    float sx=s==0?-1.:1.;
    tubes=min(tubes,sdCap(p,vec3(.32*sx,.48,0.),vec3(.72*sx,.56,0.),.06));
    tubes=min(tubes,sdCap(p,vec3(.72*sx,.56,0.),vec3(1.02*sx,.32,0.),.065));
    tubes=min(tubes,sdCap(p,vec3(1.02*sx,.32,0.),vec3(1.05*sx,.06,.02),.075));
  }
  float ov=min(sdEll(p-vec3(-.8,.1,.06),vec3(.19,.13,.13)),sdEll(p-vec3(.8,.1,.06),vec3(.19,.13,.13)));
  float soft=smin(body,tubes,.06);
  float d=min(soft,ov);
  float w=clamp((soft-ov)*8.+.5,0.,1.);
  return vec4(d,mix(vec3(.94,.52,.58),vec3(.98,.82,.72),w));
}

vec4 gut(vec3 p){
  float d=sdCap(p,vec3(-.2,1.15,0.),vec3(-.12,.62,0.),.11);
  d=smin(d,sdCap(p,vec3(-.08,.55,0.),vec3(.38,.32,0.),.36),.2);
  d=smin(d,sdCap(p,vec3(.38,.32,0.),vec3(.36,-.22,0.),.34),.2);
  d=smin(d,sdCap(p,vec3(.36,-.22,0.),vec3(-.05,-.52,0.),.26),.18);
  d=smin(d,sdCap(p,vec3(-.05,-.52,0.),vec3(-.42,-.42,0.),.13),.08);
  d=smin(d,sdCap(p,vec3(-.42,-.42,0.),vec3(-.55,-.9,0.),.12),.08);
  d+=.0025*sin(p.y*40.+p.x*12.);
  return vec4(d,.94,.6,.63);
}

vec4 knee(vec3 p){
  float fem=sdCap(p,vec3(0.,1.3,0.),vec3(0.,.3,0.),.2);
  float cond=min(length(p-vec3(-.17,.12,-.02))-.22,length(p-vec3(.17,.12,-.02))-.22);
  fem=smin(fem,cond,.16);
  float tib=sdCap(p,vec3(0.,-1.3,0.),vec3(0.,-.3,0.),.19);
  tib=smin(tib,sdRCyl(p-vec3(0.,-.17,0.),.36,.07,.05),.14);
  float fib=sdCap(p,vec3(.31,-1.2,-.06),vec3(.29,-.34,-.06),.07);
  float pat=sdEll(p-vec3(0.,.17,.3),vec3(.16,.2,.08));
  float men=sdRCyl(p-vec3(0.,-.05,0.),.34,.022,.02);
  float bone=min(min(fem,tib),min(fib,pat));
  float d=min(bone,men);
  float w=clamp((bone-men)*8.+.5,0.,1.);
  return vec4(d,mix(vec3(.93,.9,.84),vec3(.62,.72,.96),w));
}

vec4 organ(int k,vec3 p){
  if(k==0) return heart(p);
  if(k==1) return brain(p);
  if(k==2) return lungs(p);
  if(k==3) return kidney(p);
  if(k==4) return liver(p);
  if(k==5) return cells(p);
  if(k==6) return thyroid(p);
  if(k==7) return pancreas(p);
  if(k==8) return spine(p);
  if(k==9) return uterus(p);
  if(k==10) return gut(p);
  return knee(p);
}

vec4 map(vec3 p){
  p*=1.08;
  p.y-=.06;
  vec4 a=organ(uA,p);
  if(uMix<=.001) return vec4(a.x/1.08,a.yzw);
  vec4 b=organ(uB,p);
  vec4 m=uMix>=.999?b:mix(a,b,uMix);
  return vec4(m.x/1.08,m.yzw);
}

vec3 normal(vec3 p){
  vec2 e=vec2(1.,-1.)*.0014;
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float yaw=uYaw+(sin(uTime*.45)*.32)*uSway+uPtr.x*.35;
  float tilt=(sin(uTime*.31)*.06)*uSway-uPtr.y*.18-.04;
  vec3 ro=vec3(0.,.22,3.55);
  vec3 rd=normalize(vec3(uv*uFov,-1.62));
  mat2 ry=rot(yaw); mat2 rx=rot(tilt);
  ro.xz=ry*ro.xz; rd.xz=ry*rd.xz;
  ro.yz=rx*ro.yz; rd.yz=rx*rd.yz;
  float t=0.,minD=1e3,tMin=0.; bool hit=false;
  for(int i=0;i<72;i++){
    vec3 p=ro+rd*t;
    float d=map(p).x;
    if(d<minD){minD=d;tMin=t;}
    if(d<.001){hit=true;break;}
    t+=d*.8;
    if(t>7.)break;
  }
  float px=1.6/uRes.y*tMin;
  if(!hit){
    float a=1.-smoothstep(0.,px*1.5,minD);
    if(a<=0.){gl_FragColor=vec4(0.);return;}
    t=tMin;
  }
  vec3 p=ro+rd*t;
  vec4 m=map(p);
  vec3 n=normal(p);
  vec3 v=-rd;
  vec3 alb=mix(m.yzw,vec3(.9,.91,.92),uGrey);
  vec3 L=normalize(vec3(-.55,.78,.62));
  vec3 H=normalize(L+v);
  float wrap=clamp((dot(n,L)+.48)/1.48,0.,1.);
  float bounce=clamp(dot(n,normalize(vec3(.4,-.6,.5)))*.5+.5,0.,1.);
  float fres=pow(1.-clamp(dot(n,v),0.,1.),3.);
  float spec=pow(max(dot(n,H),0.),44.)*.52+pow(max(dot(n,H),0.),230.)*.65;
  float ao=0.;
  for(int k=1;k<3;k++){float h=.06*float(k);ao+=(h-map(p+n*h).x)/h*(.5/float(k));}
  ao=clamp(1.-ao*.9,.28,1.);
  vec3 col=alb*(.32+.82*wrap)*ao;
  col+=alb*mix(vec3(.9,.92,1.)*.16,vec3(.22,.36,1.)*.42,uBounce)*bounce;
  col+=alb*vec3(1.,.38,.36)*pow(clamp(1.-dot(n,v),0.,1.),1.6)*.3*(1.-uGrey);
  col+=mix(vec3(.92,.95,1.)*.38,vec3(.7,.82,1.)*.55,uBounce)*fres;
  col+=vec3(1.,.98,.96)*spec*ao;
  col=pow(col,vec3(.93));
  float a=hit?1.:1.-smoothstep(0.,px*1.5,minD);
  gl_FragColor=vec4(col*a,a);
}`;
