import { createScene, pickTier } from './scene';
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
document.body.style.margin = '0';
document.getElementById('root')!.append(canvas);
createScene(canvas, pickTier()).then(s => { (window as never as { __s: unknown }).__s = s; });
