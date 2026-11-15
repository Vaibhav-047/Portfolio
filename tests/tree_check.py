"""End-to-end check for the Portfolio Tree. Needs the dev server on :5173 (or BASE env) and Python Playwright."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BASE', 'http://127.0.0.1:5173')
out = Path('test-results/portfolio-tree'); out.mkdir(parents=True, exist_ok=True)
ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] if os.uname().sysname == 'Darwin' else []

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS)

    # 1. Desktop, full motion: content, scene, deep links, dialog focus, keyboard reach.
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, permissions=['clipboard-read', 'clipboard-write'])
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(BASE, wait_until='networkidle')
    expect(page.locator('.tree-site.scene-ready')).to_have_count(1, timeout=15000)
    expect(page.get_by_role('heading', level=1)).to_have_text('Vaibhav Tripathi')
    for name in ['A little about me', 'My everyday toolkit', 'Selected work', 'Freelance Frontend Developer', 'Got an idea? My inbox is open.']:
        expect(page.get_by_role('heading', name=name)).to_have_count(1)
    expect(page.get_by_role('link', name='raunaktripathi047@gmail.com').first).to_have_attribute('href', 'mailto:raunaktripathi047@gmail.com')
    page.wait_for_timeout(1500)
    page.screenshot(path=str(out / 'hero.png'))

    page.get_by_role('navigation', name='Sections').get_by_role('link', name='Projects').click()
    page.wait_for_timeout(3000)
    expect(page.get_by_role('link', name='Projects', exact=True)).to_have_attribute('aria-current', 'true')
    opener = page.get_by_role('button', name='Open Supremo AI project')
    opener.click()
    expect(page.get_by_role('dialog')).to_be_visible()
    assert page.url.endswith('#project-supremo-ai'), page.url
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0)
    expect(opener).to_be_focused()
    page.screenshot(path=str(out / 'projects.png'))

    page.get_by_role('button', name='Copy address').click()
    expect(page.get_by_role('status').filter(has_text='Email address copied.')).to_have_count(1)

    # Every link and button in the content is reachable by Tab.
    page.goto(BASE + '/#roots', wait_until='networkidle'); page.wait_for_timeout(500)
    targets = page.evaluate("""() => [...document.querySelectorAll('main a[href], main button')].length""")
    seen = set()
    for _ in range(80):
        page.keyboard.press('Tab')
        info = page.evaluate("""() => { const a = document.activeElement; return a && a.closest('main') ? a.outerHTML.slice(0, 80) : null; }""")
        if info: seen.add(info)
    assert len(seen) >= targets, f'only {len(seen)} of {targets} content controls reached by Tab'
    focused_visible = page.evaluate("""() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return getComputedStyle(a.closest('.card-float') || a).opacity; }""")
    assert float(focused_visible) > 0.99, f'focused card not fully visible: {focused_visible}'

    page.goto(BASE + '/#project-khoj-ai', wait_until='networkidle')
    expect(page.get_by_role('dialog', name='Khoj AI')).to_be_visible(timeout=5000)
    assert not errors, errors
    ctx.close()

    # 2. Calm mode (prefers-reduced-motion): stacked content, no smooth scroll, no leaf layer.
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until='networkidle'); page.wait_for_timeout(1500)
    assert page.evaluate("document.documentElement.dataset.motion") == 'reduced'
    expect(page.locator('.ui-leaves')).to_have_count(0)
    expect(page.locator('.cursor-leaf')).to_have_count(0)
    assert not page.evaluate("document.documentElement.classList.contains('lenis')")
    page.get_by_role('heading', name='Selected work').scroll_into_view_if_needed(); page.wait_for_timeout(400)
    assert float(page.evaluate("getComputedStyle(document.querySelector('#projects .card-float')).opacity")) == 1
    page.screenshot(path=str(out / 'calm.png'))
    assert not errors, errors
    ctx.close()

    # 3. No horizontal overflow at phone, tablet and desktop widths.
    for w, h in [(375, 812), (768, 1024), (1440, 900)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}); page = ctx.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE, wait_until='networkidle'); page.wait_for_timeout(1200)
        for frac in [0, 0.27, 0.6, 1]:
            page.evaluate(f"scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * {frac})"); page.wait_for_timeout(300)
            over = page.evaluate("document.documentElement.scrollWidth - innerWidth")
            assert over <= 0, f'{w}px overflows by {over}px at {frac}'
        page.screenshot(path=str(out / f'width-{w}.png'))
        assert not errors, errors
        ctx.close()

    b.close()
print('Portfolio Tree checks passed.')
