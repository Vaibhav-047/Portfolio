from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json

out = Path('test-results/iron'); out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:5174', wait_until='domcontentloaded')
    expect(page.locator('.reactor-layer')).to_have_attribute('data-ready','true')
    for phase, name in [(0,'arrival'),(1,'assembly'),(2,'ignition'),(3,'projection'),(4,'ready')]:
        try:
            expect(page.locator('.reactor-layer')).to_have_attribute('data-phase',str(phase),timeout=12000)
            page.screenshot(path=str(out/f'{name}.png'))
        except Exception as e:
            print('Phase capture failed:',name,str(e)[:180])
    expect(page.locator('.boot-interface')).to_have_count(0,timeout=15000)
    page.screenshot(path=str(out/'hero.png'))
    page.screenshot(path=str(out/'desktop.png'),full_page=True)
    print('Errors:',errors)
    print('Overflow:',page.evaluate('document.documentElement.scrollWidth > innerWidth'))
    print('Visible controls:',page.locator('.reactor-controls button').all_text_contents())
    page.get_by_role('button',name='Exploded view',exact=True).click()
    expect(page.locator('.reactor-layer')).to_have_attribute('data-exploded','true')
    page.screenshot(path=str(out/'exploded.png'))
    page.set_viewport_size({'width':390,'height':844})
    page.get_by_role('button',name='Reassemble',exact=True).click()
    page.screenshot(path=str(out/'mobile.png'),full_page=True)
    print('Mobile overflow:',page.evaluate('document.documentElement.scrollWidth > innerWidth'))
    browser.close()
