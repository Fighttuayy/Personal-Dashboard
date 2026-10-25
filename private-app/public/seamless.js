let overviewStageAnimations=[],overviewStageGeneration=0,overviewModeSwitching=false;

function reducedOverviewMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
function cancelOverviewStage(){
 overviewStageGeneration++;
 for(const animation of overviewStageAnimations)animation.cancel();
 overviewStageAnimations=[];
 const stage=$('viewStage');
 if(stage){stage.style.height='';stage.classList.remove('stage-transitioning');}
}
function animateOverviewContent(direction=1){
 const stage=$('viewStage');
 if(!stage||reducedOverviewMotion()||displayFocus||document.fullscreenElement)return [];
 return Array.from(stage.children).filter(child=>!child.classList.contains('hidden')&&typeof child.animate==='function').map(child=>child.animate([
  {opacity:.5,transform:'translate3d('+(direction*7)+'px,0,0)'},
  {opacity:1,transform:'translate3d(0,0,0)'}
 ],{duration:260,easing:'cubic-bezier(.22,.85,.25,1)'}));
}
function animateOverviewStage(previousHeight,direction){
 const stage=$('viewStage');
 if(!stage||reducedOverviewMotion()||typeof stage.animate!=='function'||displayFocus||document.fullscreenElement)return;
 const nextHeight=stage.getBoundingClientRect().height;
 if(!nextHeight||!previousHeight)return;
 const generation=overviewStageGeneration;
 stage.style.height=nextHeight+'px';stage.classList.add('stage-transitioning');
 const size=stage.animate([{height:previousHeight+'px'},{height:nextHeight+'px'}],{duration:310,easing:'cubic-bezier(.22,.85,.25,1)'});
 overviewStageAnimations=[size,...animateOverviewContent(direction)];
 size.onfinish=()=>{if(generation!==overviewStageGeneration)return;stage.style.height='';stage.classList.remove('stage-transitioning');overviewStageAnimations=[];};
}

const beforeSharedStageRender=render;
render=function(){if(!overviewModeSwitching)cancelOverviewStage();document.body.classList.toggle('overview-page',view==='overview');beforeSharedStageRender();};
const beforeSharedPageAnimation=animatePage;
animatePage=function(direction=1){
 if(view==='overview'){if(!overviewModeSwitching)overviewStageAnimations=animateOverviewContent(direction);return;}
 beforeSharedPageAnimation(direction);
};
const beforeSharedLayoutSwitch=setLayout;
setLayout=function(next){
 const order=['standard','todo','board','display'];
 if(!order.includes(next)||next===state.dashboardMode)return;
 const stage=$('viewStage');let previousHeight=0;
 if(view==='overview'&&stage&&typeof stage.getBoundingClientRect==='function')previousHeight=stage.getBoundingClientRect().height;
 const previousMode=state.dashboardMode;cancelOverviewStage();overviewModeSwitching=true;
 try{beforeSharedLayoutSwitch(next);}finally{overviewModeSwitching=false;}
 if(view==='overview')animateOverviewStage(previousHeight,order.indexOf(next)>order.indexOf(previousMode)?1:-1);
};
const beforeSharedNavigation=navigate;
navigate=function(next){cancelOverviewStage();beforeSharedNavigation(next);};
const beforeSharedDisplaySync=syncDisplayFullscreen;
syncDisplayFullscreen=function(){if(displayFocus||document.fullscreenElement)cancelOverviewStage();beforeSharedDisplaySync();};
if(typeof window.addEventListener==='function')window.addEventListener('resize',cancelOverviewStage);
document.addEventListener('fullscreenchange',cancelOverviewStage);
render();
