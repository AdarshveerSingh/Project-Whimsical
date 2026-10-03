export const vertexShader = `
  varying vec2 vUv;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  void main(){
    vUv = uv;
    vLocalPosition = position;
    vLocalNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

export const fragmentShader = `
  precision highp float;
  uniform sampler2D mapTexture;
  uniform sampler2D sourceMap;
  uniform int sourceMode;
  uniform int projectionMode;
  uniform float projectionScale;
  uniform float triplanarSharpness;
  uniform vec3 boundsMin;
  uniform vec3 boundsMax;
  uniform vec3 color0;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  uniform bool usePalette;
  uniform float mapRotation;
  uniform vec2 mapOffset;
  uniform bool mirror;
  varying vec2 vUv;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;

  vec2 mirrorUV(vec2 uv){
    if(!mirror) return fract(uv);
    vec2 f=fract(uv);
    return abs(f*2.0-1.0);
  }
  vec2 rotateUV(vec2 uv){
    float c=cos(mapRotation),s=sin(mapRotation);
    vec2 p=uv-.5; p=mat2(c,-s,s,c)*p; return p+.5+mapOffset;
  }
  float sampleMap(vec2 uv){return texture2D(mapTexture, mirrorUV(rotateUV(uv))).r;}
  float sourceAlpha(){return texture2D(sourceMap,vUv).a;}
  vec2 normalizeXY(vec2 p,vec2 a,vec2 b){return (p-a)/max(b-a,vec2(.0001));}
  vec2 objectUV(int mode){
    vec3 q=(vLocalPosition-boundsMin)/max(boundsMax-boundsMin,vec3(.0001));
    if(mode==1) return q.xy;
    if(mode==2) return q.xz;
    return q.yz;
  }
  float projected(){
    if(projectionMode==0) return sampleMap(vUv*projectionScale);
    if(projectionMode==1 || projectionMode==2 || projectionMode==3) return sampleMap(objectUV(projectionMode)*projectionScale);
    vec3 n=normalize(abs(vLocalNormal)); n=pow(n,vec3(triplanarSharpness)); n/=max(.0001,n.x+n.y+n.z);
    float a=sampleMap(((vLocalPosition.yz-boundsMin.yz)/max(boundsMax.yz-boundsMin.yz,vec2(.0001)))*projectionScale);
    float b=sampleMap(((vLocalPosition.xz-boundsMin.xz)/max(boundsMax.xz-boundsMin.xz,vec2(.0001)))*projectionScale);
    float c=sampleMap(((vLocalPosition.xy-boundsMin.xy)/max(boundsMax.xy-boundsMin.xy,vec2(.0001)))*projectionScale);
    return a*n.x+b*n.y+c*n.z;
  }
  vec3 palette(float n){
    if(n<.3333)return mix(color0,color1,n*3.0);
    if(n<.6666)return mix(color1,color2,(n-.3333)*3.0);
    return mix(color2,color3,(n-.6666)*3.0);
  }
  void main(){
    float alpha=sourceAlpha();
    if(alpha<.5)discard;
    float n=projected();
    vec3 base=usePalette?palette(n):vec3(n);
    gl_FragColor=vec4(base,alpha);
  }
`;
