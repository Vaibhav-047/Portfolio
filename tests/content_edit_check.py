"""Exercise the documented JSON workflow, restoring the owner's content even on failure."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
source=Path('src/content.json');original=source.read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page()
 try:
  content=json.loads(original)
  content['bio']='Temporary content-edit verification sentence.'
  project={**content['projects'][0], 'id':'content-edit-test', 'name':'Temporary editing check', 'status':'Test fixture only'}
  content['projects'].append(project)
  source.write_text(json.dumps(content,indent=2)+'\n')
  page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
  expect(page.locator('.about-copy .lead')).to_have_text(content['bio'])
  expect(page.get_by_role('button',name='Open Temporary editing check')).to_be_visible()
  page.reload(wait_until='networkidle');expect(page.get_by_role('button',name='Open Temporary editing check')).to_be_visible()
  other=browser.new_context();op=other.new_page();op.goto('http://127.0.0.1:5173',wait_until='networkidle')
  expect(op.get_by_role('button',name='Open Temporary editing check')).to_be_visible();other.close()
  content['projects'][-1]['name']='Edited content test'
  source.write_text(json.dumps(content,indent=2)+'\n');page.wait_for_timeout(650);page.reload(wait_until='networkidle')
  expect(page.get_by_role('button',name='Open Edited content test')).to_be_visible()
  content['projects'].pop();source.write_text(json.dumps(content,indent=2)+'\n');page.wait_for_timeout(650);page.reload(wait_until='networkidle')
  expect(page.get_by_role('button',name='Open Edited content test')).to_have_count(0)
 finally:
  source.write_text(original);page.wait_for_timeout(650);page.reload(wait_until='networkidle')
  expect(page.locator('.about-copy .lead')).to_have_text(json.loads(original)['bio'])
  browser.close()
print('PASS: About edited; project added, persisted across reload/fresh context, edited, removed through JSON only. Original content restored. Published deployment not tested.')
