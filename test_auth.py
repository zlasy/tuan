import json
import os
import re
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from app import create_app


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.app = create_app({'TESTING': True, 'DATABASE': str(Path(self.tmp.name) / 'test.sqlite3'),
                               'SECRET_KEY': 'test-session-key', 'ADMIN_USERNAME': 'admin', 'ADMIN_PASSWORD': 'test-password'})
        self.client = self.app.test_client()
        self.change = {'group': 'daily', 'id': 'rope', 'date': '2026-10-18', 'done': True}
        self.change['id'] = json.loads(Path(self.app.config['TASK_CONFIG']).read_text())['daily'][0]['id']

    def token(self):
        with self.client.session_transaction() as session:
            return session['csrf_token']

    def login(self, password='test-password'):
        self.client.get('/login')
        return self.client.post('/login', data={'username': 'admin', 'password': password, 'csrf_token': self.token()})

    def test_dotenv_configuration_and_environment_override(self):
        root = Path(self.tmp.name)
        (root / '.env').write_text('ADMIN_USERNAME=file-admin\nADMIN_PASSWORD="file-password"\nSECRET_KEY=file-secret\n')
        with patch('app.BASE', root), patch.dict(os.environ, {}, clear=True):
            config = {'DATABASE': str(root / 'test.sqlite3')}
            application = create_app(config)
            self.assertEqual(application.config['ADMIN_USERNAME'], 'file-admin')
            self.assertEqual(application.config['ADMIN_PASSWORD'], 'file-password')
            self.assertEqual(application.config['SECRET_KEY'], 'file-secret')
            with patch.dict(os.environ, {'ADMIN_USERNAME': 'environment-admin'}):
                self.assertEqual(create_app(config).config['ADMIN_USERNAME'], 'environment-admin')
            self.assertEqual(create_app({**config, 'ADMIN_USERNAME': 'test-admin'}).config['ADMIN_USERNAME'], 'test-admin')

    def test_anonymous_is_read_only(self):
        page = self.client.get('/')
        self.assertEqual(page.status_code, 200)
        boxes = re.findall(r'<input[^>]+class="check"[^>]*>', page.text)
        self.assertTrue(boxes)
        self.assertTrue(all('disabled' in box for box in boxes))
        self.assertEqual(self.client.get('/api/status').status_code, 200)
        self.assertEqual(self.client.put('/api/status', json=self.change).status_code, 401)
        self.assertEqual(self.client.get('/api/status').json['daily'], {})

    def test_login_edit_logout(self):
        self.assertEqual(self.login('wrong').status_code, 401)
        self.assertEqual(self.client.put('/api/status', json=self.change).status_code, 401)
        self.assertEqual(self.login().status_code, 302)
        page = self.client.get('/')
        boxes = re.findall(r'<input[^>]+class="check"[^>]*>', page.text)
        self.assertTrue(all('disabled' not in box for box in boxes))
        self.assertEqual(self.client.put('/api/status', json=self.change).status_code, 403)
        headers = {'X-CSRF-Token': self.token()}
        self.assertEqual(self.client.put('/api/status', json=self.change, headers=headers).status_code, 200)
        self.assertEqual(self.client.post('/logout').status_code, 403)
        self.assertEqual(self.client.post('/logout', data={'csrf_token': self.token()}).status_code, 302)
        self.assertEqual(self.client.put('/api/status', json=self.change, headers=headers).status_code, 401)
        self.assertTrue(self.client.get('/api/status?date=2026-10-18').json['daily'][self.change['id']])

    def test_popup_login_returns_json(self):
        self.client.get('/')
        data = {'username': 'admin', 'password': 'wrong', 'csrf_token': self.token()}
        headers = {'Accept': 'application/json'}
        response = self.client.post('/login', data=data, headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json['error'], '账号或密码错误。')
        data['password'] = 'test-password'
        response = self.client.post('/login', data=data, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json['ok'])
        self.assertIn('已登录，可修改打卡', self.client.get('/').text)

    def test_browser_keeps_anonymous_boxes_disabled(self):
        source = re.search(r'<script>(.*?)</script>', self.client.get('/').text, re.S)[1]
        harness = r"""
const assert = require('node:assert/strict');
const handlers = new Map();
function element() { return {dataset: {}, disabled: true, checked: false, classList: {add(){}},
  addEventListener(name, fn){handlers.set(this, {...handlers.get(this), [name]: fn})},
  setAttribute(){}, replaceChildren(){}, append(){}, showModal(){this.open = true}, close(){this.open = false}, querySelectorAll(){return []}}; }
const daily = element(), once = element();
daily.closest = () => dailyLabel; once.closest = () => onceLabel;
const dailyLabel = element(), onceLabel = element();
daily.dataset = {group: 'daily', id: 'daily-task', date: '2026-10-18'};
once.dataset = {group: 'once', id: 'once-task', date: '2026-10-01'};
const elements = new Map();
const document = {querySelector(s){if(!elements.has(s))elements.set(s, element());return elements.get(s)},
 querySelectorAll(s){return s === '.check' ? [daily, once] : []}, createElement: element};
let writes = 0, reloads = 0;
const window = {location: {reload(){reloads++}}};
const FormData = class {constructor(form){this.password = form.password}};
const fetch = async (url, options) => {
 if(options?.method === 'POST')return {ok: options.body.password === 'right', json: async () => ({error: '账号或密码错误。'})};
 if(options?.method === 'PUT'){writes++; return {status: 401, ok: false};}
 return {ok: true, json: async () => ({daily: {'daily-task': true}, once: {'2026-10-01:once-task': true}, days: {}})};
};
const sortAssignments = () => {};
const alert = () => {};
"""
        checks = r"""
(async () => {
 await openDay('2026-10-18');
 assert(daily.checked); assert(daily.disabled); assert(once.disabled);
 let prevented = 0;
 handlers.get(dailyLabel).click({preventDefault(){prevented++}});
 assert(elements.get('#login-dialog').open); assert.equal(prevented, 1);
 elements.get('#login-dialog').close();
 handlers.get(onceLabel).click({preventDefault(){}});
 assert(elements.get('#login-dialog').open); assert.equal(writes, 0);
 elements.get('#login-dialog').close();
 once.checked = false;
 await handlers.get(once).change();
 assert.equal(writes, 0); assert(once.checked);
 canEdit = true;
 handlers.get(dailyLabel).click({preventDefault(){}});
 assert(!elements.get('#login-dialog').open);
 await openDay('2026-10-18');
 assert(!daily.disabled);
 daily.checked = false;
 await handlers.get(daily).change();
 assert.equal(writes, 1); assert(daily.checked); assert(daily.disabled); assert(once.disabled);
 await openDay('2026-10-19');
 assert(daily.disabled);
 const form = elements.get('#login-form'); form.password = 'wrong';
 await handlers.get(form).submit({preventDefault(){}, currentTarget: form});
 assert.equal(reloads, 0); assert(!elements.get('#login-error').hidden);
 assert.equal(elements.get('#login-error').textContent, '账号或密码错误。');
 assert(!elements.get('#login-submit').disabled);
 form.password = 'right';
 await handlers.get(form).submit({preventDefault(){}, currentTarget: form});
 assert.equal(reloads, 1);
})().catch(error => {console.error(error); process.exitCode = 1});
"""
        result = subprocess.run(['node', '-e', harness + source + checks], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_configuration_and_forged_login(self):
        self.assertEqual(self.client.post('/login', data={'username': 'admin', 'password': 'test-password'}).status_code, 403)
        self.app.config['ADMIN_PASSWORD'] = ''
        self.assertEqual(self.client.get('/').status_code, 200)
        self.assertEqual(self.client.get('/login').status_code, 503)
        self.assertEqual(self.client.put('/api/status', json=self.change).status_code, 401)


if __name__ == '__main__':
    unittest.main()
