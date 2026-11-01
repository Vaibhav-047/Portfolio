from playwright.sync_api import sync_playwright, expect
from pathlib import Path
out=Path('test-results/freefall');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173',wait_until='networkidle')
 expect(page.locator('.freefall-render')).to_have_attribute('data-ready','true')
 page.screenshot(path=str(out/'hero.png'))
 for progress,chapter in [(.35,'fall'),(.7,'impact'),(.95,'rise')]:
  page.evaluate('(p)=>{const e=document.querySelector(".freefall-story");scrollTo(0,e.offsetTop+(e.offsetHeight-innerHeight)*p)}',progress)
  expect(page.locator('.freefall-story')).to_have_attribute('data-chapter',chapter)
  page.screenshot(path=str(out/f'{chapter}.png'))
 page.get_by_role('link',name='Explore the work').click()
 page.get_by_role('button',name='View Khoj AI project details').click()
 expect(page.get_by_role('dialog')).to_be_visible()
 page.keyboard.press('Escape');expect(page.get_by_role('dialog')).to_have_count(0)
 page.get_by_role('button',name='Recruiter view',exact=True).click()
 expect(page.locator('.resume-document')).to_be_visible()
 expect(page.locator('.freefall-story')).to_have_count(0)
 page.get_by_role('button',name='Portfolio view',exact=True).click()
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)')
 page.screenshot(path=str(out/'mobile.png'))
 reduced=b.new_context(reduced_motion='reduce');rp=reduced.new_page();rp.goto('http://127.0.0.1:5173',wait_until='networkidle')
 expect(rp.locator('.freefall-story')).to_have_class('freefall-story story-static')
 assert not errors,errors
 print('PASS: WebGL, fall/impact/rise scrolling, project modal, recruiter view, 4 responsive widths, reduced motion; no page errors.')
 b.close()
