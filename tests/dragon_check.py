from pathlib import Path
from playwright.sync_api import sync_playwright, expect
out=Path('test-results/dragon');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000},permissions=['clipboard-read','clipboard-write'])
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/',wait_until='networkidle');page.wait_for_timeout(1200)
 assert page.locator('.goku-body img').evaluate('(i)=>i.complete&&i.naturalWidth>0')
 page.screenshot(path=str(out/'hero.png'))
 page.get_by_role('link',name='Arsenal',exact=True).click();page.wait_for_timeout(100)
 assert page.locator('.transmission').evaluate('(e)=>getComputedStyle(e).visibility')=='visible'
 page.screenshot(path=str(out/'transmission.png'));page.wait_for_timeout(900)
 assert page.url.endswith('#skills')
 assert page.locator('#skills').evaluate('(e)=>Math.abs(e.getBoundingClientRect().top-86)<5')
 page.get_by_role('link',name='Free fall',exact=True).click();page.wait_for_timeout(900)
 first=page.locator('.goku-flight').get_attribute('style')
 page.evaluate('window.scrollBy(0,700)');page.wait_for_timeout(700)
 assert page.locator('.goku-flight').get_attribute('style')!=first
 page.screenshot(path=str(out/'freefall.png'))
 page.get_by_role('link',name='Work',exact=True).click();page.wait_for_timeout(900)
 page.get_by_role('button',name='Open Supremo AI').click();expect(page.get_by_role('dialog')).to_be_visible()
 page.keyboard.press('Escape');expect(page.get_by_role('dialog')).to_have_count(0)
 page.get_by_role('button',name='Copy email',exact=True).click();expect(page.get_by_text('Copied',exact=True)).to_be_visible()
 page.get_by_role('button',name='Motion full',exact=True).click()
 expect(page.locator('html')).to_have_attribute('data-dragon-motion','reduced')
 page.get_by_role('link',name='Origin',exact=True).click();assert page.url.endswith('#about')
 assert page.locator('.transmission').evaluate('(e)=>getComputedStyle(e).visibility')=='hidden'
 page.evaluate('window.print=()=>window.printed=true');page.get_by_role('button',name='Print / Save resume').click();assert page.evaluate('window.printed')
 page.emulate_media(media='print');expect(page.locator('.print-resume')).to_be_visible();page.emulate_media(media='screen')
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(200)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 page.set_viewport_size({'width':390,'height':844})
 page.get_by_role('button',name='Toggle navigation').click();page.get_by_role('link',name='Contact',exact=True).click()
 expect(page.get_by_role('button',name='Toggle navigation')).to_have_attribute('aria-expanded','false')
 page.get_by_role('button',name='Motion reduced',exact=True).click()
 page.locator('.dragon-logo').click();page.wait_for_timeout(1500)
 page.screenshot(path=str(out/'mobile.png'))
 assert errors==[],errors
 print('PASS: flight/freefall transforms, teleport and arrival, projects/Escape, clipboard, reduced motion, print resume, mobile navigation, 4 widths; no runtime errors.')
 b.close()
