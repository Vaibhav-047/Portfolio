from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page(viewport={'width':1440,'height':1000})
    page.goto('http://127.0.0.1:5174/#contact',wait_until='networkidle')
    print(page.locator('.copy-button').aria_snapshot())
    print('Button count:',page.get_by_role('button',name='Copy email address',exact=True).count())
    print('Contact:',page.locator('#contact').aria_snapshot()[:3000])
    print('inert',page.locator('main').get_attribute('inert'))
    page.screenshot(path='test-results/iron/contact-debug.png')
    page.set_viewport_size({'width':390,'height':844})
    print('Overflow:',page.evaluate('document.documentElement.scrollWidth-innerWidth'))
    print('Overflow sources:',page.evaluate('Array.from(document.querySelectorAll("body *")).filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1}).map(e=>[e.tagName,e.className,Math.round(e.getBoundingClientRect().right)]).slice(0,20)'))
    b.close()
