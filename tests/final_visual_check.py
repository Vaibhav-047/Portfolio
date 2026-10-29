from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json
out=Path('test-results/iron');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page(viewport={'width':1440,'height':1000})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5174',wait_until='domcontentloaded')
    expect(page.locator('.reactor-layer')).to_have_attribute('data-phase','3',timeout=15000)
    page.wait_for_timeout(650)
    page.screenshot(path=str(out/'projection-final.png'))
    expect(page.locator('.boot-interface')).to_have_count(0,timeout=15000)
    def check_connections():
        values=page.evaluate('''() => {
          const h=document.querySelector('.hero').getBoundingClientRect();
          const m=document.querySelector('.reactor-layer').reactorMetrics;
          return [...document.querySelectorAll('[data-energy-anchor]')].map((el,i)=>{
            const r=el.getBoundingClientRect();const path=document.querySelector('.tether-'+i+' .strand-core');
            const start=path.getPointAtLength(0),end=path.getPointAtLength(path.getTotalLength());
            return {sourceError:Math.hypot(start.x+h.left-m.coreX,start.y+h.top-m.coreY),targetError:Math.hypot(end.x+h.left-r.right-7,end.y+h.top-r.top-r.height*.5)};
          });
        }''')
        assert all(x['sourceError']<5 and x['targetError']<3 for x in values), values
        return values
    page.wait_for_timeout(150)
    aligned=check_connections()
    page.get_by_role('button',name='Exploded view',exact=True).click()
    expect(page.locator('.reactor-layer')).to_have_attribute('data-exploded','true')
    page.wait_for_timeout(400)
    exploded=check_connections()
    page.get_by_role('button',name='Pulse arc reactor',exact=True).click()
    expect(page.locator('.energy-tethers')).to_have_class('energy-tethers connection-burst')
    page.get_by_role('button',name='Reassemble',exact=True).click()
    page.wait_for_timeout(650)
    page.screenshot(path=str(out/'hero-final.png'))
    page.screenshot(path=str(out/'desktop-final.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(250)
    mobile=check_connections()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(out/'mobile-hero-final.png'))
    page.screenshot(path=str(out/'mobile-final.png'),full_page=True)
    # Real context-loss handling must reveal the static fallback and retain content.
    page.locator('.reactor-layer canvas').evaluate("c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    expect(page.locator('.reactor-layer')).to_have_attribute('data-failed','true')
    expect(page.locator('.reactor-fallback')).to_be_visible()
    expect(page.locator('h1')).to_be_visible()
    assert not errors,errors
    (out/'visual-verification.json').write_text(json.dumps({'desktop':aligned,'exploded':exploded,'mobile':mobile,'contextLoss':'passed','errors':errors},indent=2))
    print('PASS: Boot projection, desktop/exploded/mobile energy attachment geometry, moving core click target, context-loss fallback; no errors.')
    b.close()
