from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('test-results/personal-computer');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173',wait_until='networkidle');page.wait_for_timeout(1500)
 print('Scene:',page.locator('.computer-canvas').count(),'Canvas:',page.locator('.computer-canvas canvas').count(),'Fallback:',page.locator('.pc-fallback').count())
 page.screenshot(path=str(out/'hero.png'))
 page.evaluate('window.scrollTo(0,1400)');page.wait_for_timeout(600);page.screenshot(path=str(out/'tunnel.png'))
 page.get_by_role('button',name='Projects',exact=True).first.click();page.wait_for_timeout(1200);page.screenshot(path=str(out/'desktop.png'))
 page.set_viewport_size({'width':390,'height':844});page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(700);page.screenshot(path=str(out/'mobile.png'))
 print('errors',errors)
 b.close()
