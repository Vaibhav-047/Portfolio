from pathlib import Path
from playwright.sync_api import sync_playwright, expect

out = Path('test-results/manga-motion')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440,'height':1000})
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
    expect(page.locator('.cinema-origin')).to_have_attribute('data-enhanced','true')
    page.wait_for_timeout(1800)
    page.screenshot(path=str(out/'hero-settled.png'))
    assert page.locator('.living-ink').count()==4
    assert page.locator('.living-ink').first.evaluate('(c)=>c.getContext("webgl").getError()')==0
    start=page.locator('.cinema-origin').evaluate('(e)=>e.getBoundingClientRect().top+scrollY-82')
    top=[]
    for progress,shot in [(0.1,0),(0.5,1),(0.76,2)]:
        page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})',start+progress*3300)
        page.wait_for_timeout(150)
        top.append(page.locator('.cinema-stage').evaluate('(e)=>e.getBoundingClientRect().top'))
        assert page.locator('.cinema-shot').nth(shot).evaluate('(e)=>Number(getComputedStyle(e).opacity)')>.95
        page.screenshot(path=str(out/f'panel-{shot+1}.png'))
    assert all(abs(y-82)<3 for y in top),top
    page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})',start+3200)
    page.wait_for_timeout(150)
    page.screenshot(path=str(out/'ink-drips.png'))
    page.locator('.hold-training').scroll_into_view_if_needed()
    page.get_by_role('button',name='Unlock next lesson').click()
    expect(page.locator('.comic-reward')).to_be_attached()
    page.wait_for_timeout(850)
    expect(page.locator('.comic-reward')).to_have_count(0)
    page.get_by_role('button',name='Broken layout').click()
    page.get_by_role('button',name='Silent button').click()
    page.get_by_role('button',name='Missing focus').click()
    expect(page.locator('.patch-check-rain')).to_be_attached()
    page.wait_for_timeout(1400)
    expect(page.locator('.patch-check-rain')).to_have_count(0)
    page.get_by_role('button',name='Just the facts',exact=True).click()
    expect(page.locator('.mode-page-turn')).to_be_attached()
    page.wait_for_timeout(150)
    page.screenshot(path=str(out/'page-fold.png'))
    expect(page.locator('.recruiter-sheet')).to_be_visible()
    expect(page.locator('.mode-page-turn')).to_have_count(0)
    assert page.locator('.pin-spacer,.living-ink').count()==0
    page.get_by_role('button',name='Read the story',exact=True).first.click()
    expect(page.locator('.cinema-origin')).to_have_attribute('data-enhanced','true')
    expect(page.locator('.mode-page-turn')).to_have_count(0)
    page.get_by_role('button',name='Motion full').click()
    expect(page.locator('.pin-spacer,.living-ink')).to_have_count(0)
    expect(page.locator('.cinema-origin')).not_to_have_attribute('data-enhanced','true')
    assert page.locator('.cinema-shot').count()==3
    page.get_by_role('button',name='Motion reduced').click()
    expect(page.locator('.cinema-origin')).to_have_attribute('data-enhanced','true')
    page.locator('.living-ink').first.wait_for(state='attached')
    page.locator('.living-ink').first.evaluate('(c)=>c.getContext("webgl").getExtension("WEBGL_lose_context").loseContext()')
    page.wait_for_timeout(200)
    assert page.locator('.living-ink').count()==3
    assert 'origin-panels.png' in page.locator('.cover-art-wrap .manga-art').evaluate('(e)=>getComputedStyle(e).backgroundImage')
    for width in [390,768,1440]:
        page.set_viewport_size({'width':width,'height':844})
        page.wait_for_timeout(300)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mp=mobile.new_page();mp.goto('http://127.0.0.1:5173/',wait_until='networkidle')
    expect(mp.locator('.cinema-origin')).to_have_attribute('data-enhanced','true')
    assert mp.locator('.living-ink').count()==0
    ms=mp.locator('.cinema-origin').evaluate('(e)=>e.getBoundingClientRect().top+scrollY-82')
    mp.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})',ms+844)
    mp.wait_for_timeout(200)
    mp.screenshot(path=str(out/'mobile-sequence.png'))
    mp.get_by_role('link',name='Skip sequence').click()
    expect(mp).to_have_url('http://127.0.0.1:5173/#family')
    assert errors==[],errors
    browser.close()
    print('PASS: three scroll-scrubbed/pinned shots; live WebGL frames; contained power-up and check rain; geometric page fold; recruiter and reduced-motion teardown; re-enable without duplicate effects; WebGL context-loss fallback; mobile sequence and skip; responsive widths; no runtime errors.')
