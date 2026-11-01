from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000})
 page.goto('http://127.0.0.1:5173',wait_until='networkidle');page.wait_for_timeout(900)
 page.screenshot(path='test-results/field-notes/hero-final.png')
 rect=page.locator('.sculpture-stage').bounding_box()
 page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2);page.mouse.down();page.mouse.move(rect['x']+rect['width']/2+70,rect['y']+rect['height']/2);page.mouse.up()
 assert int(page.get_by_label('TURN THE PAPER SCULPTURE').input_value())>20
 page.locator('.idea-journey').scroll_into_view_if_needed();page.wait_for_timeout(200)
 first=page.locator('.journey-sculpture').get_attribute('style')
 page.evaluate('window.scrollBy(0,400)');page.wait_for_timeout(200)
 assert first!=page.locator('.journey-sculpture').get_attribute('style')
 assert page.locator('.bloom-ambient').evaluate('(e)=>getComputedStyle(e).animationPlayState')=='paused'
 page.screenshot(path='test-results/field-notes/scroll-final.png')
 page.set_viewport_size({'width':390,'height':844});page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(300)
 page.screenshot(path='test-results/field-notes/mobile-final.png')
 page.goto('http://127.0.0.1:5173/quality-lab',wait_until='networkidle');page.screenshot(path='test-results/field-notes/lab-mobile.png')
 page.get_by_label('Your name / batch').focus();page.keyboard.type('Keyboard check');assert page.get_by_label('Your name / batch').input_value()=='Keyboard check'
 b.close()
print('PASS: sculpture pointer drag, scroll-driven transformation, offscreen ambient pause, keyboard worksheet input; final viewport screenshots saved.')
