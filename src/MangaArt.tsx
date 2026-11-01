export function Art({scene,className='',label}:{scene:number;className?:string;label:string}) {
  return <div role="img" aria-label={label} data-scene-art={scene} className={`manga-art art-${scene} ${className}`} style={{backgroundPosition:`${scene%3*50}% ${Math.floor(scene/3)*100}%`,backgroundSize:scene<3?'300% 209%':'300% 192%'}}/>;
}
