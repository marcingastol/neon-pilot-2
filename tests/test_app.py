"""Exercise real API boundaries, SQLite persistence, and the stage failure/retry path."""
import json
from html.parser import HTMLParser
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from neon_pilot import create_app


class Markup(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.assets=[]; self.token=None; self.inline=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='meta' and a.get('name')=='neon-token':self.token=a['content']
        if tag=='script':
            if 'src' not in a:self.inline=True
            else:self.assets.append(a['src'])
        if tag=='link':self.assets.append(a['href'])


class AppTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.app=create_app(self.tmp.name,testing=True)
        self.client=self.app.test_client()
        self.markup=Markup();self.markup.feed(self.client.get('/').text)
        self.headers={'X-Neon-Token':self.markup.token}
    def tearDown(self):
        self.app.extensions['neon_log'].close()
        self.tmp.cleanup()
    def post(self,path,body,**kwargs):
        return self.client.post(path,json=body,headers=self.headers,**kwargs)
    def run_id(self,control='keyboard'):
        return self.post('/api/runs',{'control':control}).get_json()['run_id']
    def payload(self,run=None,**kwargs):
        return dict(run_id=run or self.run_id(),name='Pilot Łukasz',score=120,elapsed_ms=1000,**kwargs)

    def test_page_assets_and_unique_ids(self):
        self.assertEqual(len(self.markup.ids),len(set(self.markup.ids)))
        self.assertFalse(self.markup.inline)
        self.assertGreater(len(self.markup.token),30)
        for asset in self.markup.assets:
            self.assertTrue(asset.startswith('/static/'))
            with self.client.get(asset) as response:self.assertEqual(response.status_code,200)

    def test_no_external_code_csp_and_camera_permission(self):
        response=self.client.get('/')
        self.assertIn("script-src 'self' 'wasm-unsafe-eval'",response.headers['Content-Security-Policy'])
        self.assertNotIn("'unsafe-eval'",response.headers['Content-Security-Policy'])
        self.assertIn('camera=(self)',response.headers['Permissions-Policy'])
        self.assertEqual(response.headers['X-Content-Type-Options'],'nosniff')

    def test_csrf_and_origin_rejected(self):
        self.assertEqual(self.client.post('/api/stage',json={'ranking_fault':True}).status_code,403)
        response=self.client.post('/api/stage',json={'ranking_fault':True},headers={**self.headers,'Origin':'https://untrusted.example'})
        self.assertEqual(response.status_code,403)
        self.assertFalse(self.client.get('/api/config').json['ranking_fault'])

    def test_host_rejected_and_static_traversal(self):
        self.assertEqual(self.client.get('/',headers={'Host':'untrusted.example'}).status_code,400)
        self.assertEqual(self.client.get('/static/../../data/stage.json').status_code,404)

    def test_stage_validation(self):
        for body in ({'ranking_fault':'false'},{'unknown':True},[],{'shield_enabled':1}):
            self.assertEqual(self.post('/api/stage',body).status_code,400)

    def test_fault_logs_and_retries_without_duplicate(self):
        body=self.payload()
        self.post('/api/stage',{'ranking_fault':True})
        failure=self.post('/api/scores',body)
        self.assertEqual(failure.status_code,503)
        self.assertEqual(failure.json['code'],'DEMO_RANKING_OFFLINE')
        self.assertTrue(failure.json['request_id'])
        self.assertIn('DEMO_RANKING_OFFLINE',self.client.get('/api/events').text)
        self.post('/api/stage',{'ranking_fault':False})
        self.assertEqual(self.post('/api/scores',body).status_code,200)
        self.assertEqual(self.post('/api/scores',body).status_code,200)
        board=self.client.get('/api/scores?mode=shield&control=keyboard').json
        self.assertEqual(board['count'],1)
        self.assertEqual(board['scores'][0]['score'],120)

    def test_run_category_is_pinned_before_stage_change(self):
        run=self.run_id('camera')
        self.post('/api/stage',{'shield_enabled':False})
        self.assertEqual(self.post('/api/scores',self.payload(run)).status_code,200)
        self.assertEqual(self.client.get('/api/scores?mode=shield&control=camera').json['count'],1)
        self.assertEqual(self.client.get('/api/scores?mode=classic&control=camera').json['count'],0)

    def test_persistent_settings_and_ranking(self):
        self.post('/api/scores',self.payload())
        self.post('/api/stage',{'shield_enabled':False})
        second=create_app(self.tmp.name,testing=True)
        try:
            client=second.test_client()
            self.assertFalse(client.get('/api/config').json['shield_enabled'])
            self.assertEqual(client.get('/api/scores?mode=shield&control=keyboard').json['count'],1)
        finally:second.extensions['neon_log'].close()

    def test_rejects_bad_score_name_duration_and_unknown_run(self):
        body=self.payload()
        for change in ({'score':True},{'score':-1},{'score':12001},{'score':float('nan')},
                       {'elapsed_ms':999999},{'name':'<script>'},{'name':''},{'name':'x'*21}):
            self.assertEqual(self.post('/api/scores',{**body,**change}).status_code,400)
        self.assertEqual(self.post('/api/scores',{**body,'run_id':'z'*32}).status_code,400)
        self.assertEqual(self.post('/api/scores',{**body,'elapsed_ms':60000}).status_code,400)

    def test_request_limit_and_mime(self):
        self.assertEqual(self.post('/api/scores',{'padding':'x'*5000}).status_code,413)
        with self.client.get('/static/rules.mjs') as res:self.assertIn('javascript',res.mimetype)
        with self.client.get('/static/vendor/wasm/vision_wasm_internal.wasm') as res:
            self.assertEqual(res.status_code,200);self.assertEqual(res.mimetype,'application/wasm')


if __name__=='__main__':unittest.main()
