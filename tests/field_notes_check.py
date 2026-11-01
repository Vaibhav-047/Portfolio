from pathlib import Path
from playwright.sync_api import sync_playwright, expect
out=Path('test-results/field-notes');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 ctx=b.new_context(viewport={'width':1440,'height':1000},permissions=['clipboard-read','clipboard-write'])
 page=ctx.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
 page.wait_for_timeout(1000)
 page.screenshot(path=str(out/'desktop.png'),full_page=True)
 assert 'Goku' not in page.locator('body').inner_text()
 slider=page.get_by_label('TURN THE PAPER SCULPTURE')
 slider.focus();page.keyboard.press('ArrowRight');expect(slider).to_have_value('1')
 assert 'rotate(1deg)' in page.locator('.sculpture-turn').get_attribute('style')
 page.get_by_role('button',name='Pause ambient motion',exact=True).click()
 assert page.locator('.bloom-ambient').evaluate('(e)=>getComputedStyle(e).animationPlayState')=='paused'
 page.get_by_role('button',name='Resume ambient motion',exact=True).click()
 page.get_by_role('button',name='AI',exact=True).click();expect(page.locator('.work-card')).to_have_count(2)
 page.get_by_role('button',name='Web',exact=True).click();expect(page.locator('.work-card')).to_have_count(1)
 page.get_by_role('button',name='Open Field Notes').click();expect(page.get_by_role('dialog')).to_be_visible()
 assert page.url.endswith('#project-field-notes')
 page.keyboard.press('Escape');expect(page.get_by_role('dialog')).to_have_count(0)
 expect(page.get_by_role('button',name='Open Field Notes')).to_be_focused()
 page.get_by_role('button',name='All',exact=True).click();expect(page.locator('.work-card')).to_have_count(3)
 page.locator('.skill-item summary').first.click();expect(page.locator('.skill-item').first).to_have_attribute('open','')
 page.get_by_role('button',name='Copy email',exact=True).click();expect(page.get_by_role('button',name='Email copied')).to_be_visible()
 page.evaluate('window.print=()=>window.printed=true');page.get_by_role('button',name='Print / Save resume').click();assert page.evaluate('window.printed')
 page.emulate_media(media='print');expect(page.locator('.resume-print')).to_be_visible();page.emulate_media(media='screen')
 page.get_by_role('button',name='Motion on',exact=True).click();expect(page.locator('html')).to_have_attribute('data-motion','reduced')
 page.reload(wait_until='networkidle');expect(page.locator('html')).to_have_attribute('data-motion','reduced')
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(150)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'portfolio overflow {width}'
 page.set_viewport_size({'width':390,'height':844})
 page.get_by_role('button',name='Toggle navigation').click();page.get_by_role('link',name='Contact',exact=True).click()
 expect(page.get_by_role('button',name='Toggle navigation')).to_have_attribute('aria-expanded','false')
 assert page.evaluate('document.activeElement.id')=='contact'
 page.locator('.site-header .wordmark').click();page.screenshot(path=str(out/'mobile.png'),full_page=True)
 page.goto('http://127.0.0.1:5173/quality-lab',wait_until='networkidle')
 expect(page.locator('.lab-exercise')).to_have_count(13)
 page.get_by_label('Your name / batch').fill('QA visitor')
 page.get_by_label('Primary audience',exact=True).select_option('Someone else')
 page.get_by_label('Describe your audience').fill('A future collaborator')
 page.reload(wait_until='networkidle');expect(page.get_by_label('Your name / batch')).to_have_value('QA visitor')
 expect(page.get_by_label('Describe your audience')).to_have_value('A future collaborator')
 with page.expect_download() as info:page.get_by_role('button',name='Export answers',exact=True).click()
 download=info.value;download.save_as(str(out/'worksheet-export.json'))
 import json
 exported=json.loads((out/'worksheet-export.json').read_text());assert exported['answers']['name']=='QA visitor'
 isolated=b.new_context();other=isolated.new_page();other.goto('http://127.0.0.1:5173/quality-lab',wait_until='networkidle')
 expect(other.get_by_label('Your name / batch')).to_have_value('');isolated.close()
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(100)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'lab overflow {width}'
 page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path=str(out/'quality-lab.png'))
 response=ctx.request.get('http://127.0.0.1:5173/documents/portfolio-quality-lab.pdf');assert response.status==200 and response.body().startswith(b'%PDF')
 page.on('dialog',lambda d:d.accept());page.get_by_role('button',name='Reset answers',exact=True).click();expect(page.get_by_label('Your name / batch')).to_have_value('')
 page.goto('http://127.0.0.1:5173/#project-field-notes',wait_until='networkidle');expect(page.get_by_role('dialog')).to_be_visible()
 reduced=b.new_context(reduced_motion='reduce');rp=reduced.new_page();rp.goto('http://127.0.0.1:5173',wait_until='networkidle');expect(rp.locator('html')).to_have_attribute('data-motion','reduced');reduced.close()
 assert errors==[],errors
 print('PASS: sculpture keyboard control, ambient pause, project filters/dialog/Escape/focus/deep link, skills, clipboard, print, saved/OS reduced motion, mobile navigation, 4 viewport widths, all 13 worksheet exercises, local persistence, fresh-context isolation, JSON export, reset, PDF response, no runtime errors.')
 b.close()
