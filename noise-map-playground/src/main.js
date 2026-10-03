import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import {generateNoise,canvasToGrayData} from './noise.js';
import {vertexShader,fragmentShader} from './shader.js';

const $=id=>document.getElementById(id);
const ui={sourceType:$('sourceType'),resolution:$('resolution'),seed:$('seed'),scale:$('scale'),rotation:$('rotation'),offsetX:$('offsetX'),offsetY:$('offsetY'),mirror:$('mirror'),invert:$('invert'),octaves:$('octaves'),lacunarity:$('lacunarity'),gain:$('gain'),contrast:$('contrast'),brightness:$('brightness'),threshold:$('threshold'),softness:$('softness'),warpEnabled:$('warpEnabled'),warpStrength:$('warpStrength'),warpFrequency:$('warpFrequency'),projection:$('projection'),projectionScale:$('projectionScale'),triplanarSharpness:$('triplanarSharpness'),showWireframe:$('showWireframe'),color0:$('color0'),color1:$('color1'),color2:$('color2'),color3:$('color3'),usePalette:$('usePalette'),autoRotate:$('autoRotate'),showGrid:$('showGrid'),environment:$('environment')};
const outputs=[...document.querySelectorAll('output[data-for]')];
function updateOutputs(){for(const o of outputs){const e=$(o.dataset.for);o.value=e.type==='checkbox'?'':e.value;o.textContent=e.value}}
updateOutputs();
document.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',()=>{updateOutputs();scheduleRender()}));

let currentMap=null,currentTexture=null,currentPNGTexture=null,currentPNGCanvas=null,models=[],modelMaterials=[];
let mapVersion=0;
const state={assetName:'bushes.glb'};

const mapCanvas=$('mapCanvas'),mapCtx=mapCanvas.getContext('2d');
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800)}

function hex(h){return new THREE.Color(h)}
function options(){return {resolution:+ui.resolution.value,type:ui.sourceType.value,seed:+ui.seed.value,scale:+ui.scale.value,octaves:+ui.octaves.value,lacunarity:+ui.lacunarity.value,gain:+ui.gain.value,contrast:+ui.contrast.value,brightness:+ui.brightness.value,threshold:+ui.threshold.value,softness:+ui.softness.value,warpEnabled:ui.warpEnabled.checked,warpStrength:+ui.warpStrength.value,warpFrequency:+ui.warpFrequency.value,invert:ui.invert.checked}}
function drawMap(data,size){mapCanvas.width=size;mapCanvas.height=size;const img=mapCtx.createImageData(size,size);for(let i=0;i<data.length;i++){const v=data[i];img.data[i*4]=v;img.data[i*4+1]=v;img.data[i*4+2]=v;img.data[i*4+3]=255}mapCtx.putImageData(img,0,0);$('mapStats').textContent=`${size} × ${size}`}
function makeTexture(data,size){if(currentTexture)currentTexture.dispose();const tex=new THREE.DataTexture(data,size,size,THREE.RedFormat,THREE.UnsignedByteType);tex.colorSpace=THREE.NoColorSpace;tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;tex.needsUpdate=true;currentTexture=tex;return tex}

async function regenerate(){const version=++mapVersion;const o=options(); if(ui.sourceType.value==='png'){if(!currentPNGCanvas){toast('Load the reference PNG first');return} const c=document.createElement('canvas');c.width=o.resolution;c.height=o.resolution;c.getContext('2d').drawImage(currentPNGCanvas,0,0,c.width,c.height);const g=canvasToGrayData(c);currentMap=g;drawMap(g.data,g.size);makeTexture(g.data,g.size);applyMaterials();return}
  await new Promise(requestAnimationFrame);
  const result=generateNoise(o);if(version!==mapVersion)return;currentMap=result;drawMap(result.data,result.size);makeTexture(result.data,result.size);applyMaterials();}
let renderTimer;function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(regenerate,120)}

function materialFor(mesh,rootBounds){
  // Keep the original GLB texture separately from the live ShaderMaterial.
  // applyMaterials() can replace the material many times while the user
  // changes noise parameters. Never read the source map back from
  // mesh.material after that replacement.
  const source=mesh.userData.sourceMap || whiteTexture;
  const mat=new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,side:THREE.DoubleSide,depthWrite:true,uniforms:{mapTexture:{value:currentTexture},sourceMap:{value:source||whiteTexture},sourceMode:{value:0},projectionMode:{value:projectionMode()},projectionScale:{value:+ui.projectionScale.value},triplanarSharpness:{value:+ui.triplanarSharpness.value},boundsMin:{value:rootBounds.min},boundsMax:{value:rootBounds.max},color0:{value:hex(ui.color0.value)},color1:{value:hex(ui.color1.value)},color2:{value:hex(ui.color2.value)},color3:{value:hex(ui.color3.value)},usePalette:{value:ui.usePalette.checked},mapRotation:{value:+ui.rotation.value*Math.PI/180},mapOffset:{value:new THREE.Vector2(+ui.offsetX.value,+ui.offsetY.value)},mirror:{value:ui.mirror.checked}}});
  mat.polygonOffset=true;mat.polygonOffsetFactor=1;mat.polygonOffsetUnits=1;return mat;
}
function projectionMode(){return ({uv:0,xy:1,xz:2,yz:3,triplanar:4})[ui.projection.value]??4}
const whiteTexture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat,THREE.UnsignedByteType);
whiteTexture.colorSpace=THREE.NoColorSpace;
whiteTexture.minFilter=THREE.NearestFilter;
whiteTexture.magFilter=THREE.NearestFilter;
whiteTexture.wrapS=THREE.ClampToEdgeWrapping;
whiteTexture.wrapT=THREE.ClampToEdgeWrapping;
whiteTexture.needsUpdate=true;

function disposeModelMaterials(){for(const m of modelMaterials)m.dispose();modelMaterials=[]}
function applyMaterials(){if(!currentTexture||!models.length)return;disposeModelMaterials();for(const item of models){item.group.traverse(o=>{if(!o.isMesh)return;const mat=materialFor(o,item.bounds);modelMaterials.push(mat);o.material=mat;o.material.wireframe=ui.showWireframe.checked})}}

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;$('scene').appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(42,1,.05,1000);camera.position.set(7,5.5,10);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,1.3,0);
scene.add(new THREE.HemisphereLight(0xf7f2e9,0x354244,2.2));const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(5,10,6);key.castShadow=true;scene.add(key);
const grid=new THREE.GridHelper(30,30,0x8b9692,0xcac3b9);grid.position.y=0;scene.add(grid);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0xf5eee4,roughness:1,metalness:0}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;ground.receiveShadow=true;scene.add(ground);
function env(){const v=ui.environment.value;scene.background=new THREE.Color(v==='dark'?0x20282a:v==='studio'?0xdfe5e2:0xf5eee4);ground.material.color.set(v==='dark'?0x263033:0xf5eee4)}
ui.environment.addEventListener('input',env);ui.showGrid.addEventListener('input',()=>grid.visible=ui.showGrid.checked);env();

function frameModels(){if(!models.length)return;const box=new THREE.Box3();models.forEach(m=>box.union(new THREE.Box3().setFromObject(m.group)));const center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());const max=Math.max(size.x,size.y,size.z);camera.position.set(max*1.3,max*.75,max*1.5);controls.target.copy(center);controls.maxDistance=max*5;controls.minDistance=max*.25}
function flattenVariation(sourceRoot){
  sourceRoot.updateWorldMatrix(true,true);
  const rootInverse=sourceRoot.matrixWorld.clone().invert();
  const group=new THREE.Group();
  group.name=sourceRoot.name;
  sourceRoot.traverse(source=>{
    if(!source.isMesh)return;
    source.updateWorldMatrix(true,false);
    const relative=rootInverse.clone().multiply(source.matrixWorld);
    const geometry=source.geometry.clone();
    geometry.applyMatrix4(relative);
    const mesh=new THREE.Mesh(geometry,source.material);
    mesh.name=source.name;

    // Preserve the original GLB map permanently. The playground swaps the
    // material with a ShaderMaterial whenever a setting changes, so the
    // original texture must live outside mesh.material.
    const sourceMaterials=Array.isArray(source.material)?source.material:[source.material];
    const sourceMaterialWithMap=sourceMaterials.find(m=>m?.map);
    mesh.userData.sourceMap=sourceMaterialWithMap?.map || null;
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
  });
  return group;
}
function addVariation(root,index,count){
  const clone=flattenVariation(root);
  const box=new THREE.Box3().setFromObject(clone);
  const bounds=box.clone();
  const size=box.getSize(new THREE.Vector3());
  const max=Math.max(size.x,size.y,size.z);
  const spacing=Math.max(3.5,max*1.6);
  const x=(index-(count-1)/2)*spacing;
  clone.position.set(x,-box.min.y+.02,0);
  scene.add(clone);
  models.push({group:clone,bounds,name:root.name});
}
async function loadGLB(url){$('modelStatus').textContent='Loading…';for(const m of models)scene.remove(m.group);models=[];disposeModelMaterials();const loader=new GLTFLoader();const gltf=await loader.loadAsync(url);const roots=gltf.scene.children.filter(o=>o.name.toLowerCase().startsWith('bush_'));const candidates=roots.length?roots:gltf.scene.children.filter(o=>o.isMesh||o.children.some(c=>c.isMesh));roots.length&&roots.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));candidates.forEach((r,i)=>addVariation(r,i,candidates.length));$('modelStatus').textContent=`${models.length} variations · ${state.assetName}`;frameModels();applyMaterials()}
loadGLB('./assets/bushes.glb').catch(e=>{$('modelStatus').textContent='GLB load failed';console.error(e);toast('Could not load bushes.glb')});

$('loadPngBtn').onclick=()=>$('pngInput').click();$('pngInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f);const img=new Image();img.onload=()=>{currentPNGCanvas=document.createElement('canvas');currentPNGCanvas.width=img.naturalWidth;currentPNGCanvas.height=img.naturalHeight;currentPNGCanvas.getContext('2d').drawImage(img,0,0);ui.sourceType.value='png';$('pngStatus').textContent=`Loaded: ${f.name} · ${img.naturalWidth} × ${img.naturalHeight}`;URL.revokeObjectURL(url);regenerate()};img.src=url};
$('loadGlbBtn').onclick=()=>$('glbInput').click();$('glbInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f);state.assetName=f.name;try{await loadGLB(url);toast(`Loaded ${f.name}`)}catch(err){console.error(err);toast('GLB load failed')}URL.revokeObjectURL(url)};
$('exportPngBtn').onclick=()=>{const a=document.createElement('a');a.href=mapCanvas.toDataURL('image/png');a.download='noise-map.png';a.click()};
function config(){return {version:1,source:ui.sourceType.value,map:options(),projection:ui.projection.value,projectionScale:+ui.projectionScale.value,triplanarSharpness:+ui.triplanarSharpness.value,rotation:+ui.rotation.value,offsetX:+ui.offsetX.value,offsetY:+ui.offsetY.value,mirror:ui.mirror.checked,colors:[ui.color0.value,ui.color1.value,ui.color2.value,ui.color3.value],usePalette:ui.usePalette.checked}}
$('exportConfigBtn').onclick=()=>{const blob=new Blob([JSON.stringify(config(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='noise-map-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('importConfigBtn').onclick=()=>$('configInput').click();$('configInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const c=JSON.parse(await f.text());ui.sourceType.value=c.source||c.map?.type||'perlin';const m=c.map||{};for(const [k,v] of Object.entries(m)){if(ui[k])ui[k].value=v}for(const k of ['projectionScale','triplanarSharpness','rotation','offsetX','offsetY'])if(c[k]!==undefined)ui[k].value=c[k];if(Array.isArray(c.colors))['color0','color1','color2','color3'].forEach((k,i)=>ui[k].value=c.colors[i]||ui[k].value);ui.mirror.checked=c.mirror??true;ui.usePalette.checked=c.usePalette??true;updateOutputs();scheduleRender();toast('Config imported')}catch(err){console.error(err);toast('Invalid config')}};

function resize(){const r=$('scene').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);resize();
const clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();controls.update();if(ui.autoRotate.checked){for(const m of models)m.group.rotation.y+=dt*.15}renderer.render(scene,camera)}animate();
regenerate();
