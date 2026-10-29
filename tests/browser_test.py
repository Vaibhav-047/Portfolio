"""Arc portfolio integration checks. Start production preview at 127.0.0.1:5174."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json
import os

BASE = os.environ.get('PORTFOLIO_URL', 'http://127.0.0.1:5174')
OUT = Path('test-results/iron'); OUT.mkdir(parents=True, exist_ok=True)
results=[]
def passed(name):
    results.append(name)
    print('PASS:', name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440,'height':1000},permissions=['clipboard-read','clipboard-write'])
    page=context.new_page(); page.set_default_timeout(8000)
    errors=[]; failed=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
    page.goto(BASE,wait_until='networkidle')
    if page.get_by_role('button',name='Skip intro',exact=True).is_visible():
        page.get_by_role('button',name='Skip intro',exact=True).click()
    expect(page.locator('.boot-interface')).to_have_count(0)
    expect(page.locator('main')).not_to_have_attribute('inert','')
    scene=page.locator('.reactor-layer')
    expect(scene).to_have_attribute('data-ready','true')
    expect(page.locator('.reactor-layer canvas')).to_have_count(1)
    expect(page.locator('h1')).to_contain_text('VAIBHAV')
    passed('Hydration, one shared WebGL canvas, working intro skip, readable hero')

    # A replay must complete all five real animation stages, with no second canvas.
    page.get_by_role('button',name='Replay boot sequence').click()
    for phase,name in [(0,'arrival'),(1,'assembly'),(2,'ignition'),(3,'projection'),(4,'ready')]:
        expect(scene).to_have_attribute('data-phase',str(phase),timeout=12000)
        page.screenshot(path=str(OUT/f'checked-{name}.png'))
    expect(page.locator('.boot-interface')).to_have_count(0,timeout=12000)
    expect(page.locator('.reactor-layer canvas')).to_have_count(1)
    page.get_by_role('button',name='Replay boot sequence').click()
    expect(page.locator('.boot-interface')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('.boot-interface')).to_have_count(0)
    page.reload(wait_until='networkidle')
    expect(page.locator('.boot-interface')).to_have_count(0)
    passed('Five-stage assembly/ignition/projection, natural completion, replay, Escape skip and first-visit gating')

    page.get_by_role('button',name='standby',exact=True).click()
    expect(scene).to_have_attribute('data-power','standby')
    page.get_by_role('button',name='overdrive',exact=True).click()
    expect(scene).to_have_attribute('data-power','overdrive')
    expect(scene).to_have_attribute('data-power','powered',timeout=11000)
    page.get_by_role('button',name='Exploded view',exact=True).click()
    expect(scene).to_have_attribute('data-exploded','true')
    expect(page.locator('.exploded-labels')).to_contain_text('ENERGY CORE')
    page.screenshot(path=str(OUT/'checked-exploded.png'))
    page.get_by_role('button',name='Reassemble',exact=True).click()
    expect(scene).to_have_attribute('data-exploded','false')
    # Repeated transitions reuse the same geometries.
    initial_memory=scene.evaluate('(e)=>e.reactorMetrics.geometries')
    for _ in range(2):
        page.get_by_role('button',name='Exploded view',exact=True).click()
        page.get_by_role('button',name='Reassemble',exact=True).click()
    assert scene.evaluate('(e)=>e.reactorMetrics.geometries') == initial_memory
    passed('Standby, timed overdrive recovery, exploded view/reassembly and stable geometry allocation')

    yaw=float(scene.get_attribute('data-yaw'))
    page.get_by_role('button',name='Rotate reactor right').click()
    page.wait_for_function('(v)=>Math.abs(Number(document.querySelector(".reactor-layer").dataset.yaw)-v)>.15',arg=yaw)
    stage=page.locator('.scene-stage'); stage.focus(); yaw=float(scene.get_attribute('data-yaw'))
    page.keyboard.press('ArrowLeft')
    page.wait_for_function('(v)=>Math.abs(Number(document.querySelector(".reactor-layer").dataset.yaw)-v)>.1',arg=yaw)
    box=stage.bounding_box(); x=box['x']+box['width']*.22; y=box['y']+box['height']*.5
    yaw=float(scene.get_attribute('data-yaw'))
    page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x+65,y+10,steps=8); page.mouse.up()
    page.wait_for_function('(v)=>Math.abs(Number(document.querySelector(".reactor-layer").dataset.yaw)-v)>.3',arg=yaw)
    page.get_by_role('button',name='Reset view',exact=True).click()
    page.wait_for_function('Math.abs(Number(document.querySelector(".reactor-layer").dataset.yaw)+.28)<.04')
    page.get_by_role('button',name='Pulse arc reactor',exact=True).click()
    expect(page.locator('.energy-tethers')).to_have_class('energy-tethers connection-burst')
    passed('Mouse dragging, keyboard/button rotation, reset, core pulse and energy-connection response')

    page.get_by_role('button',name='Open experience settings').click()
    page.get_by_role('radio',name='Reduced motion').check()
    expect(page.locator('html')).to_have_attribute('data-motion','reduced')
    page.wait_for_timeout(400)
    n=scene.evaluate('e=>e.reactorMetrics.frames')
    page.wait_for_timeout(350)
    assert scene.evaluate('e=>e.reactorMetrics.frames') == n
    page.get_by_role('radio',name='Motion off').check()
    expect(page.locator('html')).to_have_attribute('data-motion','off')
    assert page.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0
    page.keyboard.press('Escape'); expect(page.get_by_role('dialog')).to_have_count(0)
    page.reload(wait_until='networkidle')
    expect(page.locator('html')).to_have_attribute('data-motion','off')
    page.get_by_role('button',name='Open experience settings').click()
    page.get_by_role('radio',name='Full power').check()
    page.get_by_role('button',name='Ambient animation Playing').click()
    expect(page.locator('html')).to_have_attribute('data-paused','true')
    page.wait_for_timeout(350); n=scene.evaluate('e=>e.reactorMetrics.frames'); page.wait_for_timeout(350)
    assert scene.evaluate('e=>e.reactorMetrics.frames') == n
    page.get_by_label('Visual quality').select_option('low')
    page.wait_for_function('document.querySelector(".reactor-layer").reactorMetrics.reducedQuality')
    page.get_by_role('button',name='Ambient animation Paused').click()
    page.keyboard.press('Escape'); expect(page.get_by_role('dialog')).to_have_count(0)
    passed('Reduced/off stop rendering, preferences persist, pause stops frames, and quality control works')

    page.get_by_role('button',name='Khoj AI',exact=True).click()
    expect(page.locator('.project-card')).to_have_count(1)
    page.get_by_role('button',name='All projects').click()
    expect(page.locator('.project-card')).to_have_count(2)
    trigger=page.get_by_role('button',name='View Supremo AI project details'); trigger.click()
    expect(page.get_by_role('dialog')).to_be_visible()
    for _ in range(5):
        page.keyboard.press('Tab'); assert page.evaluate('!!document.activeElement.closest("dialog")')
    page.keyboard.press('Escape'); expect(page.get_by_role('dialog')).to_have_count(0); expect(trigger).to_be_focused()
    page.goto(BASE+'/?project=khoj-ai',wait_until='networkidle')
    expect(page.get_by_role('dialog',name='Khoj AI project details')).to_be_visible()
    expect(page.locator('.boot-interface')).to_have_count(0)
    page.get_by_role('button',name='Copy project link').click()
    assert 'project=khoj-ai' in page.evaluate('navigator.clipboard.readText()')
    page.keyboard.press('Escape'); expect(page.get_by_role('dialog')).to_have_count(0)
    page.locator('.skill-node').filter(has_text='Rust').click()
    expect(page.locator('.skill-detail h3')).to_have_text('Rust.')
    page.locator('.exp-details summary').click(); expect(page.locator('.exp-details')).to_have_attribute('open','')
    page.locator('.exp-details summary').click(); expect(page.locator('.exp-details')).not_to_have_attribute('open','')
    passed('Project filters, share links, modal focus/close restoration, skill selection and disclosures')

    page.get_by_role('button',name='Copy email address',exact=True).click()
    expect(page.get_by_role('button',name='Copied',exact=True)).to_be_visible()
    assert page.evaluate('navigator.clipboard.readText()')=='raunaktripathi047@gmail.com'
    page.get_by_role('button',name='Compose email',exact=True).click()
    assert not page.locator('.contact-form').evaluate('e=>e.checkValidity()')
    page.get_by_label('Your name').fill('Portfolio Test')
    page.get_by_label('Your email').fill('test@example.com')
    page.get_by_label('What are we creating?').fill('Testing the portfolio draft. This must not send an email automatically.')
    page.get_by_role('button',name='Compose email',exact=True).click()
    expect(page.locator('.form-status')).to_contain_text('This website has not sent a message.')
    passed('Contact validation, clipboard and honest email-draft feedback')

    page.evaluate('window.print=()=>window.__printed=true')
    page.get_by_role('button',name='Print / Save as PDF').click()
    assert page.evaluate('window.__printed')
    page.emulate_media(media='print'); expect(page.locator('#home')).not_to_be_visible(); expect(page.locator('#resume')).to_be_visible(); expect(scene).not_to_be_visible()
    page.pdf(path=str(OUT/'resume.pdf'),format='A4',print_background=True)
    page.emulate_media(media='screen')
    page.get_by_role('button',name='Recruiter view',exact=True).click()
    expect(page.locator('#home')).not_to_be_visible(); expect(page.locator('#resume')).to_be_visible(); expect(page.locator('.reactor-layer')).to_have_count(0)
    page.screenshot(path=str(OUT/'recruiter.png'),full_page=True)
    page.get_by_role('button',name='Portfolio view',exact=True).click()
    expect(page.locator('#home')).to_be_visible(); expect(page.locator('.reactor-layer canvas')).to_have_count(1)
    passed('Print action, resume-only PDF layout, recruiter view and canvas disposal/remount')

    for width in [320,390,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':900})
        # Let layout observers update the canvas without waiting for ambient animations.
        page.wait_for_timeout(120)
        overflow=page.evaluate('document.documentElement.scrollWidth-innerWidth')
        assert overflow<=1, f'{width}px overflow: {overflow}'
    page.goto(BASE,wait_until='networkidle')
    page.screenshot(path=str(OUT/'desktop-final.png'),full_page=True)
    page.screenshot(path=str(OUT/'hero-final.png'))
    metrics=scene.evaluate('e=>e.reactorMetrics')
    passed('No horizontal overflow at 320, 390, 768, 1024 and 1440px')

    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    mp=mobile.new_page(); mp.goto(BASE,wait_until='networkidle')
    expect(mp.locator('html')).to_have_attribute('data-motion','reduced'); expect(mp.locator('.boot-interface')).to_have_count(0)
    mp.get_by_role('button',name='Open navigation').click(); mp.get_by_role('navigation').get_by_role('link',name='Projects').click()
    expect(mp.get_by_role('button',name='Open navigation')).to_have_attribute('aria-expanded','false')
    mp.get_by_role('button',name='View Khoj AI project details').click(); expect(mp.get_by_role('dialog')).to_be_visible()
    mp.get_by_role('button',name='Close Khoj AI project details').click(); expect(mp.get_by_role('dialog')).to_have_count(0)
    mp.goto(BASE,wait_until='networkidle'); mp.screenshot(path=str(OUT/'mobile-final.png'),full_page=True)
    mp.get_by_role('button',name='Exploded view',exact=True).click(); expect(mp.locator('.reactor-layer')).to_have_attribute('data-exploded','true')
    passed('Touch controls, mobile menu/dialogs and OS reduced-motion behavior')

    nojs=browser.new_context(java_script_enabled=False)
    np=nojs.new_page(); np.goto(BASE,wait_until='networkidle')
    expect(np.locator('h1')).to_contain_text('VAIBHAV'); expect(np.locator('.resume-document')).to_contain_text('raunaktripathi047@gmail.com'); expect(np.locator('.reactor-fallback')).to_be_visible()
    passed('Professional content and reactor illustration remain readable without JavaScript')

    fallback=browser.new_context(); fp=fallback.new_page()
    fp.add_init_script('''const original=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(kind,...args){if(kind==='webgl'||kind==='webgl2'||kind==='experimental-webgl')return null;return original.call(this,kind,...args)}''')
    fp.goto(BASE,wait_until='networkidle'); expect(fp.locator('.reactor-layer')).to_have_attribute('data-failed','true'); expect(fp.locator('.boot-interface')).to_have_count(0); expect(fp.locator('.reactor-fallback')).to_be_visible()
    fp.route('**/images/profile.png',lambda route:route.abort()); fp.reload(wait_until='networkidle'); fp.locator('#about').scroll_into_view_if_needed(); expect(fp.locator('.photo-fallback')).to_be_visible()
    passed('Unavailable WebGL skips boot safely; missing artwork uses fallback')

    assert errors==[],errors
    assert failed==[],failed
    passed('No application errors or failed production assets in the main session')
    (OUT/'results.json').write_text(json.dumps({'passed':results,'browser':'Chromium','errors':errors,'reactorMetrics':metrics},indent=2))
    browser.close()
print(f'All {len(results)} integration groups passed.')
