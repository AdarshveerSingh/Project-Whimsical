// Deterministic CPU noise generators. Kept independent from Three.js so this module can
// later be moved to a Worker or reused by an offline map exporter.

function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a,b,t){return a+(b-a)*t}
function grad(ix,iy,seed){const a=hash(ix,iy,seed)*Math.PI*2;return [Math.cos(a),Math.sin(a)]}

export function value2D(x,y,seed){
  const x0=Math.floor(x), y0=Math.floor(y), tx=x-x0, ty=y-y0;
  const u=fade(tx),v=fade(ty);
  const a=hash(x0,y0,seed),b=hash(x0+1,y0,seed),c=hash(x0,y0+1,seed),d=hash(x0+1,y0+1,seed);
  return lerp(lerp(a,b,u),lerp(c,d,u),v);
}

export function perlin2D(x,y,seed){
  const x0=Math.floor(x), y0=Math.floor(y), tx=x-x0, ty=y-y0;
  const u=fade(tx),v=fade(ty);
  const g00=grad(x0,y0,seed),g10=grad(x0+1,y0,seed),g01=grad(x0,y0+1,seed),g11=grad(x0+1,y0+1,seed);
  const n00=g00[0]*tx+g00[1]*ty;
  const n10=g10[0]*(tx-1)+g10[1]*ty;
  const n01=g01[0]*tx+g01[1]*(ty-1);
  const n11=g11[0]*(tx-1)+g11[1]*(ty-1);
  return (lerp(lerp(n00,n10,u),lerp(n01,n11,u),v)+0.70710678)/1.41421356;
}

// 2D simplex noise (Stefan Gustavson style).
const F2=0.3660254037844386, G2=0.2113248654051871;
export function simplex2D(xin,yin,seed){
  let n0=0,n1=0,n2=0;
  const s=(xin+yin)*F2; const i=Math.floor(xin+s),j=Math.floor(yin+s);
  const t=(i+j)*G2; const X0=i-t,Y0=j-t; const x0=xin-X0,y0=yin-Y0;
  const i1=x0>y0?1:0,j1=x0>y0?0:1;
  const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
  const n=(gx,gy,dx,dy)=>{const q=.5-dx*dx-dy*dy;if(q<=0)return 0;const g=grad(gx,gy,seed);return q*q*q*q*(g[0]*dx+g[1]*dy)};
  n0=n(i,j,x0,y0);n1=n(i+i1,j+j1,x1,y1);n2=n(i+1,j+1,x2,y2);
  return Math.max(0,Math.min(1,.5+(70*(n0+n1+n2))/1.5));
}

function baseNoise(type,x,y,seed){
  if(type==='simplex') return simplex2D(x,y,seed);
  if(type==='value') return value2D(x,y,seed);
  return perlin2D(x,y,seed);
}

export function generateNoise(options, onProgress){
  const {resolution,type='perlin',seed=1,scale=3.2,octaves=5,lacunarity=2,gain=.5,contrast=1,brightness=0,threshold=.5,softness=.2,warpEnabled=true,warpStrength=.16,warpFrequency=1.6,invert=false}=options;
  const size=Number(resolution); const data=new Uint8Array(size*size); let min=Infinity,max=-Infinity;
  const raw=new Float32Array(size*size);
  const samples=(x,y)=>{
    let amplitude=1,frequency=1,sum=0,norm=0;
    for(let o=0;o<octaves;o++){sum+=baseNoise(type,x*frequency,y*frequency,seed+o*1013)*amplitude;norm+=amplitude;frequency*=lacunarity;amplitude*=gain}
    return sum/norm;
  };
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      let u=x/(size-1),v=y/(size-1);
      let px=u*scale,py=v*scale;
      if(warpEnabled){const wx=baseNoise('simplex',px*warpFrequency+13.7,py*warpFrequency+7.1,seed+9001)-.5;const wy=baseNoise('simplex',px*warpFrequency-5.2,py*warpFrequency+19.4,seed+9007)-.5;px+=wx*warpStrength;py+=wy*warpStrength}
      let n=samples(px,py);
      n=Math.pow(Math.max(0,Math.min(1,n)),1/Math.max(.001,contrast));
      n=Math.min(1,Math.max(0,n+brightness));
      const edge=Math.max(.0001,softness);
      n=smoothstep(threshold-edge,threshold+edge,n);
      if(invert)n=1-n;
      const i=y*size+x;raw[i]=n;if(n<min)min=n;if(n>max)max=n;
    }
    if(onProgress&&y%16===0)onProgress(y/size);
  }
  for(let i=0;i<raw.length;i++)data[i]=Math.round(raw[i]*255);
  return {data,size,min,max};
}

function smoothstep(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}

export function canvasToGrayData(canvas){const ctx=canvas.getContext('2d',{willReadFrequently:true});const w=canvas.width,h=canvas.height;const rgba=ctx.getImageData(0,0,w,h).data;const gray=new Uint8Array(w*h);for(let i=0;i<gray.length;i++){const r=rgba[i*4],g=rgba[i*4+1],b=rgba[i*4+2];gray[i]=Math.round(.299*r+.587*g+.114*b)}return {data:gray,size:w}}
