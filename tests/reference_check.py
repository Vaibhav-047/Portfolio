from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import re
out=Path('test-results/reference');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 context=b.new_context(viewport={'width':1440,'height':1000},permissions=['clipboard-read','clipboard-write'])
 page=context.new_page();errors=[];failed=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
 page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
 expect(page.locator('.loader')).to_have_class('loader is-ready',timeout=30000)
 page.get_by_role('button',name='Enter without sound').click()
 expect(page.locator('.loader')).to_have_count(0,timeout=6000)
 expect(page.locator('h1')).to_have_attribute('aria-label','Vaibhav Tripathi')
 page.screenshot(path=str(out/'hero.png'))
 assert page.locator('canvas').count()==3
 assert page.locator('.screen').count()==2
 assert 'Arin Vale' not in page.content()
 assert 'Iron Man' not in page.content()
 assert page.locator('a[href="mailto:raunaktripathi047@gmail.com"]').count()>0
 for key in ['story:0.33','story:0.64','work','about','services','portal','contact']:
  page.evaluate('(key)=>freefall.jump(key)',key)
  page.wait_for_timeout(1600 if key.startswith('story') else 5200)
  page.screenshot(path=str(out/key.replace(':','-'))+'.png')
 expect(page.locator('.contact-mail')).to_be_visible()
 assert page.locator('.contact-mail').inner_text()=='raunaktripathi047@gmail.com'
 page.evaluate('freefall.jump("top")');page.wait_for_timeout(5200)
 page.get_by_role('button',name='Menu',exact=True).click()
 expect(page.locator('html')).to_have_class(re.compile(r'\bmenu-open\b'))
 page.keyboard.press('Escape')
 expect(page.locator('#menuBtn')).to_have_attribute('aria-expanded','false')
 for width in [390,320,768,1440]:
  page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(300)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(400)
 page.screenshot(path=str(out/'mobile.png'))
 boxes=page.locator('.hn').evaluate_all('els=>els.map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))')
 assert all(x['left']>=-1 and x['right']<=391 for x in boxes),boxes
 assert errors==[],errors
 assert failed==[],failed
 print('PASS: Original films and engine; personalized name/projects/contact; menu/Escape; story/work/portal scrolling; four screen widths; no runtime or asset errors.')
 b.close()
