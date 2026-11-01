from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000})
 page.goto('http://127.0.0.1:5173',wait_until='networkidle')
 page.wait_for_timeout(1500)
 page.screenshot(path='test-results/field-notes/before.png')
 b.close()
